# CI와 자동화에서 쓰기


저장소 CI에서 저장소가 기록한 프로필 버전과 맞는지(`check`), 에이전트가 지침 파일을 받는지(`explain`) 검사하는 방법을 다룬다. 스크립트나 에이전트가 확인 질문 없이 agctx를 실행하는 방법(`--yes`·`--dry-run`·`--json`)도 함께 다룬다.

## 목차

- [준비 사항](#준비-사항)
- [CI에서 확인하기](#ci에서-확인하기)
- [프로필 저장소가 비공개일 때](#프로필-저장소가-비공개일-때)
- [에이전트 전달을 CI에서 확인하기](#에이전트-전달을-ci에서-확인하기)
- [자동화와 스크립트에서 쓰기](#자동화와-스크립트에서-쓰기)
- [다음 단계](#다음-단계)

## 준비 사항

- **커밋된 적용 기록:** 검사할 저장소에 agctx가 만든 파일(`agctx.project.json`, `.agctx/base/`, 지침 파일)이 커밋되어 있어야 한다. `check`는 이 기록과 지금 파일을 비교한다.
- **러너 환경:** Node.js 22 이상이 필요하고, `--refresh`를 쓰려면 `git`도 필요하다. agctx는 설치하지 않고 `npx`로 실행해도 된다.

## CI에서 확인하기

<!-- agctx-doc-sources: src/check.ts, src/commands/output.ts -->
<!-- agctx-doc-sources-sha256: a9f2ee5b3eb2d990eadcfe79ab7defcfb88f837d92052f53838a616a2193d363 -->

`agctx check`는 프로필 보관함(프로필을 받아 두는 `~/.agctx/profiles` 폴더)이 없는 CI에서도 저장소 파일이 `agctx.project.json`에 기록한 프로필 버전과 맞는지 확인한다. 결과는 종료 코드로 알린다.

- **2:** 관리 영역(agctx가 다시 만드는 부분)을 agctx 밖에서 고쳤다.
- **3:** agctx가 관리하는 파일에 사람에게 보이지 않는 문자(숨은 문자)가 있다.
- **1:** `--refresh`를 붙였을 때, 프로필을 받아 온 원격 저장소에 기록보다 새 커밋이 있다.

0이 아닌 코드로 끝나면 CI 작업이 실패로 표시된다. 코드 전체의 뜻은 [종료 코드](../reference/exit-codes.md)에, 관리 영역은 [관리 영역과 확장 영역](../concepts/managed-and-extension-areas.md)에 있다.

```bash
$ agctx check /path/to/orders-api
/path/to/orders-api matches its recorded profile version.
The profile is not in this machine's profile store; run with --refresh to compare with the source repository.

$ agctx check --refresh /path/to/orders-api
behind            -  the source repository has a newer commit (ddf3742)
```

아래는 GitHub Actions 설정 예시다. 이 저장소의 CI에서 실행해 본 설정은 아니다.

```yaml
name: agctx
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx --yes agent-context-manager check --refresh .
```

- 프로필 저장소가 비공개면 `--refresh`의 `git ls-remote`가 그 저장소를 읽을 수 있어야 한다. 배포 키나 토큰을 Git 설정으로 제공하지 않으면 종료 코드 69로 끝난다. 방법은 아래 [프로필 저장소가 비공개일 때](#프로필-저장소가-비공개일-때)에 있다.
- 뒤처짐을 실패가 아니라 알림으로만 두려면 이 단계에 `continue-on-error: true`를 붙인다. 다만 그렇게 하면 충돌(2)과 숨은 문자(3)까지 함께 무시된다. 종료 코드를 나눠 처리하려면 `--json`(결과를 JSON 문서 하나로 출력하는 옵션) 결과의 `exitCode`를 읽는다.

## 프로필 저장소가 비공개일 때

비공개 저장소여도 검사 대부분은 자격 증명 없이 끝난다. 관리 영역 변조(2)와 숨은 문자(3)는 프로젝트 안의 파일과 `agctx.project.json`에 기록된 해시만 보므로 네트워크를 쓰지 않는다.

```bash
$ agctx check /path/to/orders-api
/path/to/orders-api: 기록한 프로필 버전과 일치합니다.

$ agctx check /path/to/orders-api   # 관리 영역을 agctx 밖에서 고친 뒤
conflict          AGENTS.md  프로필이 관리하는 영역을 직접 고쳤습니다
```

자격 증명이 필요한 것은 `--refresh` 하나다. `--refresh`는 `git ls-remote -- <프로필 저장소> refs/heads/<브랜치>`로 원격의 최신 커밋을 읽어 뒤처짐(1)을 판정하므로, git이 그 저장소를 읽지 못하면 69로 끝난다. 터미널이 아닌 환경에서는 agctx가 `GIT_TERMINAL_PROMPT=0`을 주므로 비밀번호를 물으며 멈추지 않고 바로 실패한다.

```bash
$ agctx check --refresh /path/to/orders-api
오류: Git 원격에 연결하거나 로그인하지 못했습니다:
  fatal: could not read Username for 'https://github.com': terminal prompts disabled
다음: git ls-remote <git-url>로 주소와 Git 인증을 확인한 뒤 다시 실행하세요.
```

자격 증명을 주는 방법은 두 가지다. 어느 쪽이든 agctx 설정이 아니라 git이 그 저장소를 읽게 만드는 것이다. 워크플로 저장소의 기본 `GITHUB_TOKEN`은 그 저장소로 한정되므로 다른 비공개 저장소에는 쓸 수 없고, 프로필 저장소를 읽을 수 있는 토큰이나 배포 키가 따로 있어야 한다([근거](../references.md#ci에서-비공개-프로필-저장소를-읽는-근거)).

아래 두 예시는 이 저장소의 CI에서 실행해 본 설정은 아니다. git 쪽 동작(주소를 바꿔 읽는 것, 자격 증명이 없을 때 69로 끝나는 것)만 로컬에서 확인했다.

**1. 토큰으로 읽기.** 프로필 저장소를 읽을 수 있는 PAT(개인 액세스 토큰)이나 GitHub App 토큰을 비밀값으로 두고, github.com 주소를 그 토큰이 붙은 주소로 바꾼다.

```yaml
      - run: git config --global url."https://x-access-token:${{ secrets.PROFILE_REPO_TOKEN }}@github.com/".insteadOf "https://github.com/"
      - run: npx --yes agent-context-manager check --refresh .
```

토큰이 러너의 `~/.gitconfig`에 남으므로, 러너를 여러 작업이 나눠 쓰는 self-hosted(직접 운영하는 러너) 환경이라면 아래 배포 키 쪽이 낫다.

**2. 배포 키로 읽기.** 프로필 저장소에 읽기 전용 배포 키(저장소 하나에만 등록하는 SSH 키)를 등록하고 개인 키를 비밀값으로 둔다. `ssh-agent`는 단계마다 사라지므로 키 등록과 검사를 한 단계에서 실행한다.

```yaml
      - run: |
          mkdir -p ~/.ssh
          ssh-keyscan github.com >> ~/.ssh/known_hosts
          eval "$(ssh-agent -s)"
          ssh-add - <<< "${{ secrets.PROFILE_DEPLOY_KEY }}"
          npx --yes agent-context-manager check --refresh .
```

배포 키는 SSH 주소에서만 쓰이므로 `agctx.project.json`의 `source.git`이 `git@github.com:<소유자>/<저장소>.git` 형식이어야 한다. HTTPS 주소로 기록된 프로젝트라면 `git config --global url."git@github.com:".insteadOf "https://github.com/"`로 주소를 바꾼다.

## 에이전트 전달을 CI에서 확인하기

<!-- agctx-doc-sources: src/explain.ts -->
<!-- agctx-doc-sources-sha256: f62d0a36f1de49132641f22e156f9ac59daf9f3668e333cc8c720347cf9b3a41 -->

`agctx explain <폴더>`는 그 폴더에서 시작한 에이전트마다 어떤 지침 파일을 왜 읽는지 보여 주는 명령이다. 에이전트를 실행하지 않으므로 CI 단계로 둘 수 있다. 확인한 에이전트(기본은 세 에이전트 모두, `--agent`로 고를 수 있다) 가운데 하나라도 받지 못하는 지침 파일이 있으면 그 줄에 `missing`을 표시하고 4로 끝난다. `verify`는 지침 파일이 실제로 에이전트에 들어갔는지 확인하는 명령인데, 개발자 컴퓨터의 세션 기록을 읽거나 에이전트를 실행하므로 CI 단계에는 맞지 않는다. 판정 방법은 [에이전트가 읽는 지침 파일](../concepts/agent-loading.md)에 있다.

## 자동화와 스크립트에서 쓰기

<!-- agctx-doc-sources: src/commands/options.ts -->
<!-- agctx-doc-sources-sha256: 66f3ecaed98d8751b7ae392a2cd2d158443dbf1b8cb992f3f79a97653dee518e -->

TUI(터미널에서 메뉴로 고르는 화면)를 쓸 수 없는 환경에서는 옵션을 플래그로 직접 넘긴다. 파일을 바꾸는 명령은 터미널이 아니면 확인을 물을 수 없어 멈추므로, 확인 없이 실행하는 `--yes`를 붙인다([확인과 `--yes`](../reference/cli.md#확인과---yes)).

```bash
npm install -g agent-context-manager
agctx profile create company --scope company
agctx profile setup company --tdd on --security on
agctx profile apply company /path/to/project --dry-run
agctx profile apply company /path/to/project --yes
```

- **계획 먼저 보기:** 되돌리기 어려운 작업 전에는 `--dry-run`으로 계획을 먼저 확인한다. 위 예시의 네 번째 줄이 그 단계다.
- **결과를 프로그램으로 읽기:** 스크립트나 에이전트가 결과를 읽어야 하면 `--json`을 붙인다. 표준 출력(stdout)에는 JSON 결과 문서 하나만 나오고, 성공·충돌·뒤처짐은 종료 코드로 구분한다([종료 코드](../reference/exit-codes.md)).
- **에이전트가 대신 실행할 때:** `--dry-run` 결과를 사용자에게 보여 주고 승인을 받은 뒤에 `--yes`를 붙인다.
- **표시 언어:** `--lang`, `AGCTX_LANG` 환경 변수, `agctx config lang` 가운데 하나로 정한다.
- **데이터 폴더:** agctx가 프로필과 설정을 두는 폴더(기본 `~/.agctx`)는 `AGCTX_HOME` 환경 변수로 바꿀 수 있다.

## 다음 단계

- 뒤처진 저장소에 새 버전을 PR로 자동으로 올리려면 [예약 봇으로 PR 열기](update-policies.md#예약-봇으로-pr-열기)를 본다.
- CI가 실패했을 때 종료 코드별 뜻은 [종료 코드](../reference/exit-codes.md)에, 대응은 [문제 해결](../reference/troubleshooting.md)에 있다.
