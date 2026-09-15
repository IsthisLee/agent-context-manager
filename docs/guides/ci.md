# CI와 자동화에서 쓰기

<!-- agctx-doc-sources: src/check.ts, src/explain.ts, src/commands/options.ts, src/commands/output.ts -->
<!-- agctx-doc-sources-sha256: 7acd32cf6a0608f869ce771fbaf9183ae92e89896c7026a0d2c03eb223a14582 -->

## CI에서 확인하기

`agctx check`는 프로필 보관함이 없는 CI에서도 저장소가 기록한 버전과 맞는지 확인한다. 관리 영역을 밖에서 고쳤으면 2, 숨은 문자가 있으면 3, `--refresh`로 원격에 더 새로운 커밋이 보이면 1로 끝나므로 작업이 실패로 표시된다.

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

- 프로필 저장소가 비공개면 `--refresh`의 `git ls-remote`가 그 저장소를 읽을 수 있어야 한다. 배포 키나 토큰을 Git 설정으로 제공하지 않으면 종료 코드 69로 끝난다.
- 뒤처짐을 실패가 아니라 알림으로만 쓰려면 이 단계에 `continue-on-error: true`를 둔다. 충돌(2)과 숨은 문자(3)까지 무시하게 되므로 종료 코드를 나눠 처리하려면 `--json` 결과의 `exitCode`를 읽는다.

## 에이전트 전달을 CI에서 확인하기

`agctx explain <폴더>`는 에이전트를 실행하지 않으므로 CI 단계로 둘 수 있다. 어느 에이전트에도 닿지 않는 지침 파일이 있으면 4로 끝난다. `verify`는 개발자 컴퓨터의 세션 기록을 읽거나 에이전트를 실행하므로 CI 단계에는 맞지 않는다. 판정 방법은 [에이전트가 읽는 지침 파일](../concepts/agent-loading.md)에 있다.

## 자동화와 스크립트에서 쓰기

TUI가 없는 환경에서는 옵션을 플래그로 직접 넘긴다. 파일을 바꾸는 명령은 터미널이 아니면 묻지 않으므로 `--yes`를 붙인다.

```bash
npm install -g agent-context-manager
agctx profile create company --scope company
agctx profile setup company --tdd recommended --security strict
agctx profile apply company /path/to/project --dry-run
agctx profile apply company /path/to/project --yes
```

되돌리기 어려운 작업 전에는 `--dry-run`으로 계획을 먼저 확인한다. 스크립트나 에이전트가 결과를 읽어야 하면 `--json`을 붙인다. stdout에는 결과 문서 하나만 나오고, 성공·충돌·뒤처짐은 종료 코드로 구분한다([종료 코드](../reference/exit-codes.md)). 에이전트가 사용자 대신 실행한다면 `--dry-run` 결과를 사용자에게 보여 주고 승인을 받은 뒤 `--yes`를 붙인다. 표시 언어는 `--lang`·`AGCTX_LANG`·`config lang`으로 정한다. agctx 데이터 폴더(기본 `~/.agctx`)는 `AGCTX_HOME`으로 바꿀 수 있다.
