# TUI로 쓰기


명령과 옵션을 외우지 않고, 터미널 화면의 메뉴에서 골라 agctx를 쓰는 방법이다. 프로필을 만들고, 지침을 고르고, 프로젝트에 적용하고(커밋 고정 포함), 동기화하고, Git으로 주고받는 일부터 프로젝트 점검(`check`·`explain`·`verify`)과 여러 저장소 처리(`repos`)까지 agctx의 모든 명령을 TUI 메뉴에서 실행할 수 있다. 이 문서에 실은 화면은 실제로 실행한 결과에서 긴 경로만 `/work`로 바꾼 것이다. 대부분 표시 언어를 영어로 두고 찍었으며, 한국어로 표시할 때의 메뉴 이름은 [메뉴와 명령 대응표](#메뉴와-명령-대응표)에 함께 적었다.

## 목차

- [시작하기](#시작하기)
- [조작 방법](#조작-방법)
- [첫 화면](#첫-화면)
- [프로필 만들기](#프로필-만들기)
- [지침 고르기](#지침-고르기)
- [프로젝트에 적용하기](#프로젝트에-적용하기)
- [프로젝트 점검하기](#프로젝트-점검하기)
- [여러 저장소 다루기](#여러-저장소-다루기)
- [도움말 보기](#도움말-보기)
- [메뉴와 명령 대응표](#메뉴와-명령-대응표)
- [CLI에만 있는 옵션](#cli에만-있는-옵션)
- [다음 단계](#다음-단계)

## 시작하기

<!-- agctx-doc-sources: src/tui -->
<!-- agctx-doc-sources-sha256: 1233eeccf5f2fad9113fb38a6405fd6c325f9f6b7f116108adba0a8de301ad59 -->

1. agctx를 설치한다. 설치 명령은 [빠른 시작](../getting-started/quick-start.md#설치)에 있다.
2. 터미널에서 인자 없이 `agctx`를 실행한다. 첫 화면 메뉴가 열린다.

   ```bash
   agctx
   ```

- 처음 실행하면 표시 언어를 한 번 묻는다. 나중에 바꾸려면 첫 화면의 **언어 / Language**를 고른다.
- `agctx profile create`, `agctx profile setup`, `agctx profile list`처럼 이름이나 옵션 없이 실행해도 그 명령의 TUI 화면이 바로 열린다.
- TUI는 터미널에서만 열린다. CI나 스크립트에서는 [CI와 자동화에서 쓰기](ci.md)처럼 옵션을 직접 넘긴다.

## 조작 방법

<!-- agctx-doc-sources: src/commands/options.ts -->
<!-- agctx-doc-sources-sha256: 66f3ecaed98d8751b7ae392a2cd2d158443dbf1b8cb992f3f79a97653dee518e -->

화면 아래에 그 화면에서 쓰는 키가 나온다.

| 화면 | 키 |
| --- | --- |
| 목록에서 고르기 | `↑`/`↓`로 이동, `Enter`로 확정 |
| 이름 입력 | 글자를 입력하고 `Enter`로 확정 |
| 비워 둘 수 있는 입력(브랜치, PR 메시지 등) | 입력하지 않고 `Enter`를 누르면 질문에 적힌 기본값을 쓴다 |
| 프로젝트 경로 고르기 | 경로를 입력해 검색, `Tab`으로 자동 완성, `↑`/`↓`로 선택, `Enter`로 확정 |
| Yes / No 확인 | `←`/`→`로 Yes와 No를 바꾸고 `Enter`로 확정. `y`나 `n`을 누르면 바로 그 답으로 확정 |
| 취소 | `Esc` 또는 `Ctrl+C` |

> [!IMPORTANT]
> 프로젝트 파일을 쓰거나(적용·동기화·충돌 해결·여러 저장소 동기화), 프로필을 지우거나, 원격으로 보내거나(push·PR 열기), 에이전트를 실행하는(probe) 확인 질문은 **No가 기본으로 선택**되어 있다. 그대로 `Enter`를 누르면 `Nothing was changed.`가 나오고 아무것도 바뀌지 않는다. 진행하려면 `←`로 **Yes**를 고른 뒤 `Enter`를 누르거나 `y`를 누른다(`src/commands/options.ts`의 `confirmChange`<!--s:829d4d362537-->).

`Esc`나 `Ctrl+C`를 누르면 진행 중인 작업을 취소한다. 확인 질문에 답하기 전에 취소하면 파일은 바뀌지 않는다.

- **첫 화면에서 연 작업:** 작업을 취소하고 첫 화면으로 돌아간다. 예를 들어 적용 중에 누르면 `Project operation cancelled.`가 나온 뒤 첫 화면 메뉴가 다시 열린다.
- **첫 화면:** agctx를 끝낸다(`agctx exited.`).
- **`agctx profile create`처럼 명령으로 바로 연 화면:** 그 작업을 취소하고 agctx를 끝낸다(`Profile creation cancelled.`).

## 첫 화면

```text
┌  Agent Context Manager (agctx)
│
◆  What would you like to do?
│  ● Manage profiles (Select a profile, then configure, apply, sync, view, or delete)
│  ○ Check a project
│  ○ Repositories
│  ○ Create a new profile
│  ○ Clone a profile
│  ○ Configure profile guidance
│  ○ 언어 / Language
│  ○ Help
│  ○ Exit
│  ↑/↓ to navigate • Enter: confirm
└
```

처음 쓴다면 **Create a new profile**로 프로필을 만들고, **Configure profile guidance**로 지침을 고른 뒤, **Manage profiles**에서 프로젝트에 적용한다. 적용한 뒤에는 **Check a project**로 결과를 확인한다. 팀이 올려 둔 프로필을 쓴다면 만들지 않고 **Clone a profile**로 받는다. 받을 브랜치를 묻는 질문은 비워 두면 원격의 기본 브랜치를 받는다.

## 프로필 만들기

첫 화면에서 **Create a new profile**을 고른다.

1. 프로필 이름을 입력하고 `Enter`를 누른다. 이름은 소문자·숫자·하이픈으로 1~64자까지 쓸 수 있다.
2. 프로필의 용도(Personal·Company·Team·Workspace)를 고른다.
3. 만들 내용을 확인하고 **Yes**에서 `Enter`를 누른다. 이 질문은 Yes가 기본이다.

```text
┌  Create an agctx profile
│
◇  Enter a profile name.
│  team-backend
│
◇  Select what this profile is for.
│  Team
│
◇  Profile to create ──────────╮
│                              │
│  team-backend                │
│  Team: Team shared guidance  │
│                              │
├──────────────────────────────╯
│
◇  Create this profile?
│  Yes
Created profile: team-backend (team)
│
└  Profile created.
```

## 지침 고르기

<!-- agctx-doc-sources: src/i18n/messages-ko.ts, src/i18n/messages-en.ts -->
<!-- agctx-doc-sources-sha256: 5c4a23b701190cee55690a01e7a0208b0d248c29ebae60b6630292ad3050fdc5 -->

첫 화면에서 **Configure profile guidance**를 고르고 프로필을 고른다. 작업 흐름·맥락 관리·TDD·변경 검토·검증·지침 파일·문서화·보안·믿을 수 없는 입력·응답 언어 10개 항목이 하나씩 나오고, 항목마다 **On**과 **Off** 둘 중 하나를 고른다. 지금 설정된 값이 미리 선택되어 있으므로, 바꾸지 않을 항목은 `Enter`만 누르면 된다. 두 값의 뜻은 [지침 항목 켜고 끄기](../concepts/profiles.md#지침-항목-켜고-끄기)에 있다.

항목 화면은 항목 이름과 설명을 제목으로 두고 선택지 둘을 보여 준다. 선택지 이름과 설명은 `levelOptions`가 돌려주는 값이다(`src/i18n/index.ts`의 `levelOptions`<!--s:06d932e49129-->).

| 선택지 | 설명 |
| --- | --- |
| **On** | Include this guidance in the profile |
| **Off** | Exclude this guidance from the profile |

10개 항목을 모두 고르면 요약이 나온다. **Yes**에서 `Enter`를 누르면 프로필에 저장한다.

```text
◇  Guidance to apply to team-backend ─╮
│                                     │
│  Workflow: on                       │
│  TDD: on                            │
│  Change review: off                 │
│  Verification: on                   │
│  Instruction files: on              │
│  Security: on                       │
│                                     │
├─────────────────────────────────────╯
│
◇  Save these settings to the profile?
│  Yes
Configured profile: team-backend
│
└  Profile guidance configured.
```

## 프로젝트에 적용하기

1. 첫 화면에서 **Manage profiles**를 고른다.
2. 볼 범위로 **All scopes**를 고르고, 적용할 프로필(`team · team-backend`)을 고른다.
3. 작업 목록에서 **Apply to a project**를 고른다.

   ```text
   ◆  Select an action for team-backend.
   │  ● View details (Check the scope and current profile guidance)
   │  ○ Configure guidance
   │  ○ Apply to a project
   │  ○ Sync a project
   │  ○ Resolve project conflicts
   │  ○ Delete profile
   │  ○ Git status
   │  ○ Pull from Git
   │  ○ Push to Git
   │  ○ Connect to Git
   │  ↑/↓ to navigate • Enter: confirm
   └
   ```

4. 프로젝트 경로를 고른다. 현재 폴더에서 시작하며, 경로를 입력하면 맞는 폴더가 목록에 나온다. 폴더만 고를 수 있다.

   ```text
   ◆  Enter the project path to apply to.
   │
   │  Search: /work/sh█
   │  ● /work/shop
   │  ↑/↓ to select • Tab: complete • Enter: confirm • Type: to search
   └
   ```

5. 프로필이 Git 저장소면 프로젝트를 지금 프로필 커밋에 고정할지 묻는다. 고정하면 프로필 보관함이 새 커밋을 받아도 이 프로젝트는 기록한 커밋의 지침에 머문다. 고정과 고정하지 않음의 차이는 [갱신 방식 고르기](update-policies.md)에 있다. Git 저장소가 아닌 로컬 프로필이면 이 질문 없이 6단계로 넘어간다.

   ```text
   ◆  Pin the project to the current profile commit? A pinned project changes only when you
   │  apply with a pin again or merge a repos pr pull request.
   │  ○ Yes / ● No
   └
   ```

   - 처음 적용하는 프로젝트는 **No**가 미리 선택되어 있다. 고정하려면 `←`로 **Yes**를 고르고 `Enter`를 누른다. `agctx profile apply <name> <project> --pin`과 같다.
   - 이미 고정한 프로젝트는 **Yes**가 미리 선택되어 있어, `Enter`만 누르면 고정을 유지한 채 지금 프로필 커밋으로 옮긴다. **No**를 고르면 고정이 풀린다는 `Warning:` 줄이 나오고, 계획에 `update agctx.project.json`이 들어간다.
   - 프로필에 커밋하지 않은 수정이 있으면 고정할 수 없다. **Yes**를 고르면 `Profile team-backend has uncommitted changes, so a project cannot be pinned to a commit.` 오류가 나고 파일은 바뀌지 않는다. 프로필 폴더에서 수정을 커밋한 뒤 다시 적용한다.

6. 바뀔 파일 계획이 나오면 `←`로 **Yes**를 고르고 `Enter`를 누른다. 이 질문은 No가 기본이다.

   ```text
   Plan: 8 file(s) to change.
     create    AGENTS.md
     create    CLAUDE.md
     create    .agents/rules/agctx.md
     create    .agctx/base/AGENTS.md.base
     create    .agctx/base/CLAUDE.md.base
     create    .agctx/base/.agents/rules/agctx.md.base
     create    .agctx/.gitignore
     create    agctx.project.json
   │
   ◇  Write 8 file(s) in /work/shop?
   │  Yes
   Applied profile team-backend to /work/shop
   ```

만들어진 파일의 뜻과 커밋할 파일은 [빠른 시작](../getting-started/quick-start.md#3-프로젝트에-적용)에 있다. 고정을 골랐다면 `agctx.project.json`에 `"pin": true`가 기록된다. 프로필 지침을 바꾼 뒤에는 같은 작업 목록에서 **Sync a project**로 다시 적용한다. 고정한 프로젝트는 **Sync a project**로 새 커밋을 받지 않으므로, 새 커밋으로 옮기려면 **Apply to a project**에서 고정을 다시 고른다.

## 프로젝트 점검하기

적용한 프로젝트가 프로필 버전과 맞는지, 에이전트가 어떤 지침 파일을 읽는지를 확인한다. 첫 화면에서 **Check a project**를 고른 뒤 확인할 항목을 고른다.

| 항목 | 하는 일 | 이어서 묻는 것 |
| --- | --- | --- |
| **Profile version** | 프로젝트가 기록한 프로필 버전과 지금 파일이 맞는지 검사한다(`check`) | 프로젝트 경로, 프로필 Git 원격에 새 커밋이 있는지도 볼지(No 기본) |
| **Instruction files each agent reads** | 그 폴더에서 시작한 에이전트가 읽는 지침 파일과 이유를 보여 준다(`explain`) | 에이전트를 시작할 폴더, 볼 에이전트(**All agents** 기본) |
| **Delivery to agents** | 그 파일들이 에이전트에 실제로 들어갔는지 확인한다(`verify`) | 폴더, 에이전트, 증거를 찾을 곳 |

**Delivery to agents**의 증거는 둘 중 하나를 고른다.

- **Session logs:** 그 폴더에서 이미 시작한 세션 기록을 읽는다. 에이전트를 실행하지 않는다.
- **Run the agent once (probe):** 임시 사본에서 에이전트 CLI를 한 번씩 실행한다. 에이전트를 실제로 호출해 사용량이 늘기 때문에, 실행 전에 No가 기본인 확인을 한 번 더 묻는다.

아래는 프로필이 바뀐 뒤 아직 동기화하지 않은 프로젝트에서 **Profile version**을 고른 화면이다.

```text
◇  Select what to check.
│  Profile version
│
◇  Enter the project path to check.
│  /work/web-app
│
◇  Also ask the profile's Git remote for newer commits? This needs network access and Git
│  credentials.
│  No
behind            AGENTS.md  differs from the current profile; run agctx profile sync
│
◇  Result ───────────────╮
│                        │
│  behind (exit code 1)  │
│                        │
├────────────────────────╯
```

- 결과 줄은 CLI로 실행했을 때와 같다. 줄의 뜻은 [CLI Reference](../reference/cli.md#check)에 있다.
- 명령이 성공(종료 코드 0)으로 끝나지 않으면 **Result** 상자에 결과의 뜻과 종료 코드가 나온다. 종료 코드의 뜻은 [종료 코드](../reference/exit-codes.md)에 있다.

## 여러 저장소 다루기

이 컴퓨터에서 프로필을 적용한 저장소들을 한 번에 다룬다. 첫 화면에서 **Repositories**를 고른 뒤 할 일을 고른다.

| 항목 | 하는 일 | 이어서 묻는 것 |
| --- | --- | --- |
| **List** | 저장소 목록을 보여 준다(`repos list`) | 없어진 폴더가 있으면 목록에서 지울지(No 기본) |
| **Status** | 저장소마다 프로필보다 뒤처졌는지 보여 준다(`repos status`) | 프로필 Git 원격에 새 커밋이 있는지도 볼지(No 기본) |
| **Sync repositories that are not pinned** | 뒤처진 저장소에 프로필을 다시 적용한다(`repos sync`) | 바뀔 저장소 목록을 보여 준 뒤 한 번 확인(No 기본) |
| **Open pull requests** | 저장소마다 새 브랜치에 새 프로필 버전을 커밋하고 PR을 연다(`repos pr`) | 대상 저장소, base 브랜치, 초안 여부, 커밋 메시지, 마지막 확인(No 기본) |

- 목록에 프로필이 둘 이상이면 먼저 **Select whose repositories to include.**를 묻는다. **All profiles**는 모든 저장소를, 프로필 이름은 그 프로필의 저장소만 고른다.
- **Open pull requests**는 대상을 **Repositories on this computer's list**와 **Repositories in a targets file**(한 줄에 작업 폴더 경로나 clone URL 하나를 적은 파일) 가운데서 고른다. base 브랜치와 커밋 메시지는 비워 두면 기본값을 쓴다.
- PR을 열려면 `gh`가 설치되어 로그인되어 있어야 한다. 없으면 브랜치만 올리고 `pushed`로 끝난다.

아래는 **Status**를 고른 화면에서 경로만 짧게 바꾼 것이다. 결과 줄과 `Next:` 안내는 CLI와 같다.

```text
◇  Select what to do with the repositories on this computer's list.
│  Status
│
◇  Select whose repositories to include.
│  All profiles
│
◇  Also ask each profile's Git remote for newer commits? This needs network access and Git
│  credentials.
│  No
ok                personal         -      -               /work/blog
missing           personal         -      -               /work/gone
behind            team-backend     pinned 22c94c6→e7c1fe7 /work/orders-api
behind            team-backend     -      22c94c6         /work/web-app
Next: some listed folders no longer exist; run agctx repos list --prune to forget them.
Next: agctx profile pull team-backend, then agctx repos pr --profile team-backend
Next: agctx repos sync --profile team-backend
│
◇  Result ───────────────╮
│                        │
│  behind (exit code 1)  │
│                        │
├────────────────────────╯
```

`Next:` 줄의 명령은 같은 메뉴로 실행할 수 있다. 예를 들어 `repos list --prune`은 **List**에서 지울지 묻는 질문에 **Yes**를 고르는 것과 같다. 줄마다 적힌 값의 뜻은 [뒤처진 저장소 보기](multi-repo-individual.md#뒤처진-저장소-보기)에 있다.

## 도움말 보기

첫 화면에서 **Help**를 고르면 **All commands**와 명령 목록이 나온다. **All commands**는 전체 명령의 사용법을, 명령 하나를 고르면 그 명령의 사용법·설명·종료 코드를 보여 준다. `agctx help <명령>`과 같다.

## 메뉴와 명령 대응표

<!-- agctx-doc-sources: src/commands/registry.ts -->
<!-- agctx-doc-sources-sha256: 581ae751fceccf748d9dd3b2dc72e77588c325b71233d4d60b6b1cfcab12af0e -->

TUI 메뉴는 CLI 명령과 같은 일을 한다. 메뉴의 답은 CLI 옵션으로 바뀌어 같은 처리기로 실행된다. 가이드에 나오는 CLI 명령은 아래 메뉴로 바꿔 실행할 수 있다. 표시 언어를 한국어로 두면 메뉴 이름이 둘째 열처럼 나온다.

| TUI 메뉴(영어) | TUI 메뉴(한국어) | 같은 CLI 명령 |
| --- | --- | --- |
| 첫 화면 > **Create a new profile** | 첫 화면 > **새 프로필 생성** | `agctx profile create` |
| 첫 화면 > **Clone a profile** | 첫 화면 > **프로필 가져오기** | `agctx profile clone`, 브랜치를 입력하면 `--branch` |
| 첫 화면 > **Link a folder as a profile** | 첫 화면 > **폴더를 프로필로 연결** | `agctx profile link <path>`, 이름·용도·규칙 파일을 고르면 `--name`·`--scope`·`--instructions` |
| 첫 화면 > **Configure profile guidance** | 첫 화면 > **프로필 지침 설정** | `agctx profile setup` |
| 첫 화면 > **언어 / Language** | 첫 화면 > **언어 / Language** | `agctx config lang` |
| 첫 화면 > **Help** | 첫 화면 > **도움말** | `agctx help [<command>]` |
| **Manage profiles** > 프로필 > **View details** | **프로필 관리** > 프로필 > **상세 보기** | `agctx profile view` |
| **Manage profiles** > 프로필 > **Configure guidance** | **프로필 관리** > 프로필 > **지침 설정** | `agctx profile setup <name>` |
| **Manage profiles** > 프로필 > **Apply to a project** | **프로필 관리** > 프로필 > **프로젝트에 적용** | `agctx profile apply <name> <project>`, 고정을 고르면 `--pin` |
| **Manage profiles** > 프로필 > **Sync a project** | **프로필 관리** > 프로필 > **프로젝트 동기화** | `agctx profile sync <project>` |
| **Manage profiles** > 프로필 > **Resolve project conflicts** | **프로필 관리** > 프로필 > **프로젝트 충돌 해결** | `agctx profile resolve <project>` |
| **Manage profiles** > 프로필 > **Delete profile** | **프로필 관리** > 프로필 > **프로필 삭제** | `agctx profile remove <name>` |
| **Manage profiles** > 프로필 > **Git status** | **프로필 관리** > 프로필 > **Git 상태** | `agctx profile status <name>`, 원격에서 먼저 받기에 Yes(기본)면 `--refresh` |
| **Manage profiles** > 프로필 > **Pull from Git** | **프로필 관리** > 프로필 > **Git에서 받기** | `agctx profile pull <name>` |
| **Manage profiles** > 프로필 > **Push to Git** | **프로필 관리** > 프로필 > **Git으로 올리기** | `agctx profile push <name>` |
| **Manage profiles** > 프로필 > **Connect to Git** | **프로필 관리** > 프로필 > **Git에 연결** | `agctx profile connect <name> <git-url>`, 추적할 원격 브랜치를 입력하면 `--branch` |
| **Manage profiles** > 끊긴 링크 > **Link a folder again** | **프로필 관리** > 끊긴 링크 > **폴더를 다시 연결** | `agctx profile link <path> --name <name>`(이름은 묻지 않고 그 링크의 이름을 쓴다. `profile.json`이 다른 프로필 것인 링크에는 이 항목이 없다) |
| **Manage profiles** > 끊긴 링크 > **Remove the link** | **프로필 관리** > 끊긴 링크 > **링크 지우기** | `agctx profile remove <name>` |
| **Check a project** > **Profile version** | **프로젝트 점검** > **프로필 버전** | `agctx check <project>`, 원격 확인에 Yes면 `--refresh` |
| **Check a project** > **Instruction files each agent reads** | **프로젝트 점검** > **에이전트가 읽는 지침 파일** | `agctx explain <path>`, 에이전트 하나를 고르면 `--agent` |
| **Check a project** > **Delivery to agents** | **프로젝트 점검** > **에이전트 전달 확인** | `agctx verify <path>`, probe를 고르면 `--probe` |
| **Repositories** > **List** | **여러 저장소** > **목록 보기** | `agctx repos list`, 지우기에 Yes면 `--prune` |
| **Repositories** > **Status** | **여러 저장소** > **상태 보기** | `agctx repos status`, 원격 확인에 Yes면 `--refresh` |
| **Repositories** > **Sync repositories that are not pinned** | **여러 저장소** > **고정하지 않은 저장소 동기화** | `agctx repos sync` |
| **Repositories** > **Open pull requests** | **여러 저장소** > **PR 열기** | `agctx repos pr`, 답에 따라 `--targets`·`--base`·`--draft`·`--message` |

여러 저장소 메뉴에서 프로필 하나를 고르면 `--profile <name>`을 붙인 것과 같다.

## CLI에만 있는 옵션

agctx의 모든 명령은 CLI와 TUI에서 실행할 수 있어야 한다([ADR 0025](../adr/0025-every-command-in-cli-and-tui.md)). 다만 TUI는 사람이 화면을 보며 답하는 방식이라 아래 옵션은 CLI에만 있다. 그 밖의 옵션은 TUI가 질문으로 받는다.

- **`--dry-run`:** TUI는 파일을 쓰거나 원격으로 보내기 전에 계획을 먼저 보여 주고 확인을 묻는다. 확인 질문에서 **No**를 고르면 `--dry-run`과 같은 결과가 된다.
- **`--yes`:** 터미널이 아닌 곳(CI·스크립트·에이전트)에서 확인 질문을 건너뛰는 옵션이다. TUI는 확인 질문에 직접 답한다.
- **`--json`:** 스크립트와 에이전트가 읽는 결과 문서다. TUI는 사람이 읽는 결과 줄과 **Result** 상자를 보여 준다.
- **`--lang`:** 한 번만 다른 언어로 실행하는 옵션이다. TUI에서는 **언어 / Language**로 표시 언어를 바꿔 저장한다.

## 다음 단계

- 프로필 지침을 팀과 나눠 쓰려면 [팀과 Git으로 공유하기](team-sharing.md)를 본다. 각 단계의 명령은 위 대응표의 메뉴로 바꿔 실행할 수 있다.
- 확인 질문에서 `Enter`만 눌러 `Nothing was changed.`가 나오거나 오류가 나면 [문제 해결](../reference/troubleshooting.md)을 본다.
