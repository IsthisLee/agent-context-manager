# TUI로 쓰기

<!-- agctx-doc-sources: src/tui, src/commands/options.ts, src/i18n/messages-en.ts, src/i18n/messages-ko.ts -->
<!-- agctx-doc-sources-sha256: 7062aff27cc7e9f391679b4d87eef867bf20d51d83d13385047b78a74f2710be -->

명령과 옵션을 외우지 않고, 터미널 화면의 메뉴에서 골라 agctx를 쓰는 방법이다. 프로필을 만들고, 지침을 고르고, 프로젝트에 적용하고(커밋 고정 포함), 동기화하고, Git으로 주고받는 일은 모두 TUI에서 할 수 있다. 이 문서의 화면은 실제로 실행한 화면에서 긴 경로만 `/work`로 바꿨다. 대부분 영어 표시 언어로 찍었고, 한국어로 표시할 때의 메뉴 이름은 [메뉴와 명령 대응표](#메뉴와-명령-대응표)에 함께 적었다.

## 목차

- [시작하기](#시작하기)
- [조작 방법](#조작-방법)
- [첫 화면](#첫-화면)
- [프로필 만들기](#프로필-만들기)
- [지침 고르기](#지침-고르기)
- [프로젝트에 적용하기](#프로젝트에-적용하기)
- [메뉴와 명령 대응표](#메뉴와-명령-대응표)
- [TUI에서 할 수 없는 일](#tui에서-할-수-없는-일)
- [다음 단계](#다음-단계)

## 시작하기

1. agctx를 설치한다. 설치 명령은 [빠른 시작](../getting-started/quick-start.md#설치)에 있다.
2. 터미널에서 인자 없이 `agctx`를 실행한다. 첫 화면 메뉴가 열린다.

   ```bash
   agctx
   ```

- 처음 실행하면 표시 언어를 한 번 묻는다. 나중에 바꾸려면 첫 화면의 **언어 / Language**를 고른다.
- `agctx profile create`, `agctx profile setup`, `agctx profile list`처럼 이름이나 옵션 없이 실행해도 그 명령의 TUI 화면이 바로 열린다.
- TUI는 터미널에서만 열린다. CI나 스크립트에서는 [CI와 자동화에서 쓰기](ci.md)처럼 옵션을 직접 넘긴다.

## 조작 방법

화면 아래에 그 화면에서 쓰는 키가 나온다.

| 화면 | 키 |
| --- | --- |
| 목록에서 고르기 | `↑`/`↓`로 이동, `Enter`로 확정 |
| 이름 입력 | 글자를 입력하고 `Enter`로 확정 |
| 프로젝트 경로 고르기 | 경로를 입력해 검색, `Tab`으로 자동 완성, `↑`/`↓`로 선택, `Enter`로 확정 |
| Yes / No 확인 | `←`/`→`로 Yes와 No를 바꾸고 `Enter`로 확정. `y`나 `n`을 누르면 바로 그 답으로 확정 |
| 취소 | `Esc` 또는 `Ctrl+C` |

> [!IMPORTANT]
> 프로젝트 파일을 쓰거나(적용·동기화·충돌 해결), 프로필을 지우거나, 원격으로 보내는(push) 확인 질문은 **No가 기본으로 선택**되어 있다. 그대로 `Enter`를 누르면 `Nothing was changed.`가 나오고 아무것도 바뀌지 않는다. 진행하려면 `←`로 **Yes**를 고른 뒤 `Enter`를 누르거나 `y`를 누른다(`src/commands/options.ts:69`).

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
│  ○ Repository status
│  ○ Create a new profile
│  ○ Clone a profile
│  ○ Configure profile guidance
│  ○ 언어 / Language
│  ○ Help
│  ○ Exit
│  ↑/↓ to navigate • Enter: confirm
└
```

처음 쓴다면 **Create a new profile**로 프로필을 만들고, **Configure profile guidance**로 지침을 고른 뒤, **Manage profiles**에서 프로젝트에 적용한다. 팀이 올려 둔 프로필을 쓴다면 만들지 않고 **Clone a profile**로 받는다.

## 프로필 만들기

첫 화면에서 **Create a new profile**을 고른다.

1. 프로필 이름을 입력하고 `Enter`를 누른다. 이름은 소문자·숫자·하이픈 1-64자다.
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

첫 화면에서 **Configure profile guidance**를 고르고 프로필을 고른다. 작업 흐름·TDD·변경 검토·검증·지침 파일·보안 6개 항목이 하나씩 나오고, 항목마다 **Off**·**Recommended**·**Strict** 가운데 하나를 고른다. 지금 설정된 수준이 미리 선택되어 있으므로, 바꾸지 않을 항목은 `Enter`만 누르면 된다. 수준의 뜻은 [지침 수준](../concepts/profiles.md#지침-수준)에 있다.

```text
◆  TDD — Red → Green → Refactor order and the rules that keep tests honest
│  ○ Off
│  ● Recommended (The default. Follow it as a rule; when a sound reason calls for an
│  exception, make it and record why.)
│  ○ Strict
│  ↑/↓ to navigate • Enter: confirm
└
```

6개 항목을 모두 고르면 요약이 나온다. **Yes**에서 `Enter`를 누르면 프로필에 저장한다.

```text
◇  Guidance to apply to team-backend ─╮
│                                     │
│  Workflow: recommended              │
│  TDD: strict                        │
│  Change review: recommended         │
│  Verification: recommended          │
│  Instruction files: recommended     │
│  Security: strict                   │
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

## 메뉴와 명령 대응표

TUI 메뉴는 CLI 명령과 같은 일을 한다. 가이드에 나오는 CLI 명령은 아래 메뉴로 바꿔 실행할 수 있다. 표시 언어를 한국어로 두면 메뉴 이름이 둘째 열처럼 나온다.

| TUI 메뉴(영어) | TUI 메뉴(한국어) | 같은 CLI 명령 |
| --- | --- | --- |
| 첫 화면 > **Create a new profile** | 첫 화면 > **새 프로필 생성** | `agctx profile create` |
| 첫 화면 > **Clone a profile** | 첫 화면 > **프로필 가져오기** | `agctx profile clone` |
| 첫 화면 > **Configure profile guidance** | 첫 화면 > **프로필 지침 설정** | `agctx profile setup` |
| 첫 화면 > **Repository status** | 첫 화면 > **저장소 상태** | `agctx repos status` |
| 첫 화면 > **언어 / Language** | 첫 화면 > **언어 / Language** | `agctx config lang` |
| 첫 화면 > **Help** | 첫 화면 > **도움말** | `agctx help` |
| **Manage profiles** > 프로필 > **View details** | **프로필 관리** > 프로필 > **상세 보기** | `agctx profile view` |
| **Manage profiles** > 프로필 > **Configure guidance** | **프로필 관리** > 프로필 > **지침 설정** | `agctx profile setup <name>` |
| **Manage profiles** > 프로필 > **Apply to a project** | **프로필 관리** > 프로필 > **프로젝트에 적용** | `agctx profile apply <name> <project>`, 고정을 고르면 `--pin`을 붙인 것과 같다 |
| **Manage profiles** > 프로필 > **Sync a project** | **프로필 관리** > 프로필 > **프로젝트 동기화** | `agctx profile sync <project>` |
| **Manage profiles** > 프로필 > **Resolve project conflicts** | **프로필 관리** > 프로필 > **프로젝트 충돌 해결** | `agctx profile resolve <project>` |
| **Manage profiles** > 프로필 > **Delete profile** | **프로필 관리** > 프로필 > **프로필 삭제** | `agctx profile remove <name>` |
| **Manage profiles** > 프로필 > **Git status** | **프로필 관리** > 프로필 > **Git 상태** | `agctx profile status --refresh <name>` |
| **Manage profiles** > 프로필 > **Pull from Git** | **프로필 관리** > 프로필 > **Git에서 받기** | `agctx profile pull <name>` |
| **Manage profiles** > 프로필 > **Push to Git** | **프로필 관리** > 프로필 > **Git으로 올리기** | `agctx profile push <name>` |
| **Manage profiles** > 프로필 > **Connect to Git** | **프로필 관리** > 프로필 > **Git에 연결** | `agctx profile connect <name> <git-url>` |

## TUI에서 할 수 없는 일

아래 명령은 CLI로만 실행한다. 특정 프로필 하나가 아니라 저장소나 CI를 다루는 명령이라 CLI만 제공하도록 정했다([ADR 0016](../adr/0016-command-contract.md)).

- **저장소 검사와 전달 확인:** `agctx check`, `agctx explain`, `agctx verify`.
- **여러 저장소 한 번에 처리:** `agctx repos list`, `agctx repos sync`, `agctx repos pr`. 첫 화면의 **Repository status**는 상태만 보여 준다.

`--dry-run`(파일을 쓰지 않고 계획만 보기) 옵션도 TUI에는 없다. 대신 TUI는 파일을 쓰기 전에 계획을 보여 주고 확인을 묻는다. 확인 질문에서 **No**를 고르면 아무것도 바뀌지 않는다.

## 다음 단계

- 프로필 지침을 팀과 나눠 쓰려면 [팀과 Git으로 공유하기](team-sharing.md)를 본다. 각 단계의 명령은 위 대응표의 메뉴로 바꿔 실행할 수 있다.
- 확인 질문에서 `Enter`만 눌러 `Nothing was changed.`가 나오거나 오류가 나면 [문제 해결](../reference/troubleshooting.md)을 본다.
