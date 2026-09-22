# CLI Reference

`agent-context-manager` 패키지는 `agctx` 명령으로 실행한다. 아래 문서는 현재 구현된 명령어와 옵션을 기준으로 한다. 명령 목록과 사용법 줄은 명령 등록부(`src/commands/registry.ts`)에서 나오며, `agctx <명령> --help`가 같은 사용법을 출력한다.


## 설치와 실행

<!-- agctx-doc-sources: src/agctx.ts, src/shared -->
<!-- agctx-doc-sources-sha256: 2d6615dd38c80c2af27610f84e364e6b46af0a74897ce227c3dd106dda62f3c3 -->

```bash
npm install --global agent-context-manager
agctx install
```

`agctx install`은 패키지에 든 에이전트용 스킬을 설치된 에이전트의 스킬 폴더에 복사한다([`install`](#install)). 명령 목록은 `agctx help`로 본다.

저장소를 직접 개발할 때는 `pnpm install` 후 `node src/agctx.ts help`로 설치 없이 같은 CLI를 실행할 수 있다.

저장소 개발 환경에서는 고정된 pnpm 버전을 사용한다. Git 프로필 명령과 `check --refresh`는 `git`이 설치돼 있어야 한다.

## 공통 규칙

<!-- agctx-doc-sources: src/i18n -->
<!-- agctx-doc-sources-sha256: c323936d7639c627652140dd1f8d53f7b8b704ec912df74ba05b3935d97dc093 -->

- `<값>`은 사용자가 입력하는 필수 위치 인자, `[값]`은 생략할 수 있는 선택 인자다. 사용법 줄은 옵션을 앞에 적지만 옵션과 위치 인자의 순서는 섞어도 된다.
- 프로필 관리·적용·공유 명령은 `profile` 하위 명령, 저장소 검사는 `check`, 에이전트 전달 확인은 `explain`·`verify`, 여러 저장소를 한 번에 다루는 명령은 `repos` 하위 명령이다.
- 모든 명령은 전역 옵션 `--json`, `--lang <en|ko>`, `--help`를 받는다. 명령이 받지 않는 옵션을 주거나 위치 인자가 많으면 종료 코드 64로 멈춘다.
- `on`과 `off`는 지침 항목을 켜고 끄는 값이며 대소문자를 구분한다.

### 도움말

`agctx help`는 전체 명령의 사용법을, `agctx <명령> --help`(또는 `agctx help <명령>`)는 명령 하나의 사용법·설명·종료 코드를 출력한다.

```bash
$ agctx profile apply --help
Usage: agctx profile apply [--dry-run] [--pin] [--yes] <name> [<project>]

Apply a profile to a project: create the agent files and record the profile version. --pin keeps the project on the current commit until you apply again.

Exit codes: 0 success, 64 usage error, 70 other error, 2 conflict, 3 hidden characters, 69 external tool or network unavailable
```

### 확인과 `--yes`

프로젝트 파일을 바꾸거나 원격으로 보내는 명령(`profile apply`·`sync`·`resolve`·`remove`·`push`, `repos sync`·`pr`)은 계획을 출력한 뒤 확인을 받는다. 에이전트 CLI를 실행해 요금제·API 사용량을 쓰는 `verify --probe`도 같은 규칙으로 확인을 받는다. `verify`에는 `--dry-run`이 없으므로 터미널이 아니면 `--yes`를 붙인다.

- 터미널에서는 질문에 답한다.
- 터미널이 아니거나(CI·스크립트·에이전트) `--json`을 주면 묻지 않는다. `--yes`가 없으면 아무것도 쓰지 않고 종료 코드 64로 멈추며 `--yes`를 붙인 명령을 알려 준다.
- `--dry-run`은 확인 없이 계획만 출력한다. 에이전트가 사용자 대신 실행한다면 `--dry-run` 결과를 사용자에게 보여 주고 승인을 받은 뒤 `--yes`를 붙인다.

```bash
$ agctx profile push team-backend      # 터미널이 아닌 환경
1 commit(s) of profile team-backend will go to /work/team-backend.git:
  39ca6e1 Add team-backend profile
Error: This command changes files or sends data, and it cannot ask for confirmation here.
Next: Review the plan with --dry-run, then run: agctx profile push team-backend --yes
```

### 오류 문구

모든 오류는 무엇이 잘못됐는지(`Error:`)와 바로 실행할 명령이나 조치(`Next:`)를 함께 출력하며 선택한 로케일을 따른다. 잘못 입력한 명령은 비슷한 명령을 제안한다.

```bash
$ agctx prifile lst
Error: Unknown command: prifile lst
Next: Did you mean agctx profile list?
```

### 종료 코드

명령이 돌려주는 코드와 뜻은 [종료 코드](exit-codes.md)에 있다. 명령 하나가 돌려줄 수 있는 코드는 `agctx <명령> --help`의 마지막 줄에 있다. 결과가 여러 개 겹치면 3 > 2 > 1 순서로 가장 심각한 코드를 돌려준다.

### `--json` 출력

`--json`을 주면 stdout에는 JSON 문서 하나만 쓰고, 사람용 안내와 경고는 stderr로 보낸다. TUI를 열지 않고 stdin에서 답을 읽지도 않는다.

| 필드 | 뜻 |
| --- | --- |
| `schemaVersion` | 결과 문서 형식 버전. 현재 1이며 필드를 빼거나 뜻을 바꿀 때만 올린다 |
| `command` | 실행한 명령(`profile apply`, `check` 등) |
| `exitCode` | 종료 코드와 같은 값 |
| `ok` | `exitCode`가 0이면 `true` |
| `data` | 명령별 결과. 실패하면 `null` |
| `warnings` | 경고 문장 목록 |
| `errors` | `{ code, message, hint }` 목록. `code`는 `confirm.required`·`profile.not-found`처럼 로케일과 무관한 식별자다 |

아래는 CI에서 실행한 `check`의 stdout이다. stderr로 나간 사람용 줄은 생략했다.

```bash
$ agctx check --refresh --json /work/orders-api
{
  "schemaVersion": 1,
  "command": "check",
  "exitCode": 1,
  "ok": false,
  "data": {
    "project": "/work/orders-api",
    "profile": "team-backend",
    "pinned": true,
    "commit": "39ca6e115f85ffa4178c86326f24c313253a4c9e",
    "latestCommit": "ddf374259a82f01dc73ff0e77e932998287b655b",
    "findings": [
      {
        "kind": "behind",
        "file": null,
        "detail": "the source repository has a newer commit (ddf3742)"
      }
    ],
    "warnings": [],
    "exitCode": 1
  },
  "warnings": [],
  "errors": []
}
```

## 메인 TUI

<!-- agctx-doc-sources: src/tui -->
<!-- agctx-doc-sources-sha256: dfad427acea3246ceab055bd4a9ad92a1aed71d1bbe6fa6c5fd4d6ce13179ec6 -->

```bash
agctx
```

인자 없이 터미널에서 실행하면 메인 TUI(명령 대신 메뉴에서 골라 진행하는 터미널 화면)가 열린다.

- **첫 화면:** 프로필 관리, 프로젝트 점검, 여러 저장소, 새 프로필 생성, Git에서 프로필 가져오기, 프로필 지침 설정, 에이전트 스킬 설치·제거, 언어 변경, 도움말 중에서 고른다. 설치된 스킬이 CLI와 버전이 다르면 첫 화면 위에 그 사실을 알린다.
- **프로젝트 점검:** 경로를 고른 뒤 `check`·`explain`·`verify`를 실행한다. 원격 확인(`--refresh`), 에이전트(`--agent`), probe(`--probe`)는 질문으로 고른다.
- **여러 저장소:** `repos list`·`status`·`sync`·`pr`을 실행한다. 목록에 프로필이 둘 이상이면 프로필(`--profile`)을 먼저 고르고, PR은 대상 파일·base 브랜치·초안·메시지를 묻는다.
- **도움말:** 전체 사용법이나 명령 하나의 사용법·종료 코드를 보여 준다.
- **프로필 관리 메뉴:** 프로필을 고른 뒤 설정·프로젝트 적용·동기화·충돌 해결·상세 보기·삭제를 실행한다. Git 프로필이면 Git 상태 보기·받기(pull)·올리기(push)·원격 연결도 여기서 한다.

```bash
agctx --tui
```

메뉴의 답은 CLI 옵션으로 바뀌어 같은 옵션 검사와 처리기로 실행되고, 종료 코드가 0이 아니면 결과의 뜻과 종료 코드를 보여 준다. 메뉴와 명령의 대응은 [TUI로 쓰기](../guides/tui.md#메뉴와-명령-대응표)에 있다.

`--tui`는 메인 TUI를 명시적으로 여는 선택적 플래그다. 터미널이 아니거나 `--json`을 주면 TUI 대신 도움말을 출력한다. 자동화 환경에서는 아래 CLI 명령과 옵션을 사용한다.

## 명령어

<!-- agctx-doc-sources: src/commands, src/profile, src/project, src/repos, src/verify, src/check.ts, src/explain.ts -->
<!-- agctx-doc-sources-sha256: 04a00c1357e84ab75976357a48b975d5fed8314e8689b2f0596ebf83cc6042db -->

아래 표와 명령마다의 사용법·종료 코드 줄은 명령 등록부(`src/commands/registry.ts`)에서 `node tools/generate-reference.ts`가 만든다.

<!-- agctx:generated:commands:start -->
| 명령 | 하는 일 | 바꾸는 것 | 쓸 수 있는 곳 |
| --- | --- | --- | --- |
| [`profile create`](#profile-create) | 초기 AGENTS.md가 있는 프로필을 만듭니다. | 프로필 보관함 | CLI · TUI · 프로필 메뉴 |
| [`profile list`](#profile-list) | scope별 프로필을 보고 하나를 관리합니다. | 없음 | CLI · TUI · 프로필 메뉴 |
| [`profile view`](#profile-view) | 프로필의 scope와 규칙 파일(profile.json이 다른 파일을 가리키지 않으면 AGENTS.md)을 출력합니다. | 없음 | CLI · TUI · 프로필 메뉴 |
| [`profile setup`](#profile-setup) | 프로필에 담을 지침 항목을 켜고 끕니다. | 프로필 보관함 | CLI · TUI · 프로필 메뉴 |
| [`profile apply`](#profile-apply) | 프로필을 프로젝트에 적용해 에이전트 파일을 만들고 프로필 버전을 기록합니다. --pin은 다시 적용할 때까지 프로젝트를 지금 커밋에 고정합니다. | 저장소 파일 | CLI · TUI · 프로필 메뉴 |
| [`profile sync`](#profile-sync) | 프로젝트가 쓰는 프로필을 다시 적용합니다. 고정한 프로젝트는 기록한 커밋에 머뭅니다. | 저장소 파일 | CLI · TUI · 프로필 메뉴 |
| [`profile resolve`](#profile-resolve) | 관리 영역 안에서 고친 내용을 밖으로 옮기고 관리 영역을 다시 만듭니다. | 저장소 파일 | CLI · TUI · 프로필 메뉴 |
| [`profile remove`](#profile-remove) | 프로필을 지웁니다. 프로젝트에 적용한 파일은 남습니다. | 프로필 보관함 | CLI · TUI · 프로필 메뉴 |
| [`profile clone`](#profile-clone) | 파일과 숨은 문자를 검사한 뒤 Git 저장소에서 프로필을 가져옵니다. | 프로필 보관함 | CLI · TUI · 프로필 메뉴 |
| [`profile status`](#profile-status) | 프로필의 원격·브랜치·커밋·로컬 수정과 원격 대비 위치를 보여 줍니다. --refresh를 붙이면 먼저 fetch합니다. | 없음 | CLI · TUI · 프로필 메뉴 |
| [`profile pull`](#profile-pull) | 프로필을 원격까지 fast-forward합니다. 저장소 파일은 바뀌지 않습니다. | 프로필 보관함 | CLI · TUI · 프로필 메뉴 |
| [`profile push`](#profile-push) | 이미 만든 커밋을 프로필의 원격으로 보냅니다. | Git 원격 | CLI · TUI · 프로필 메뉴 |
| [`profile connect`](#profile-connect) | 이미 Git 저장소인 프로필을 원격에 연결합니다. 커밋이나 push는 하지 않습니다. | 프로필 보관함 | CLI · TUI · 프로필 메뉴 |
| [`check`](#check) | 프로젝트가 기록한 프로필 버전과 맞는지 검사합니다. 0 일치, 1 뒤처짐, 2 관리 영역 수정, 3 숨은 문자입니다. --refresh를 붙이면 원천 저장소와도 비교합니다. | 없음 | CLI · TUI |
| [`explain`](#explain) | 폴더에서 시작한 Codex·Claude Code·Antigravity가 읽는 지침 파일을 보여 주고, 에이전트에 닿지 않는 파일이 있으면 종료 코드 4로 끝냅니다. | 없음 | CLI · TUI |
| [`verify`](#verify) | explain이 기대하는 프로젝트 지침 파일을 Codex·Claude Code·Antigravity가 실제로 받았는지 세션 기록이나 --probe로 확인하고, 받지 못한 파일이 있으면 종료 코드 4로 끝냅니다. | 없음 | CLI · TUI |
| [`repos list`](#repos-list) | 이 컴퓨터에서 프로필을 적용한 저장소 목록을 보여 줍니다. --prune은 없어진 폴더를 목록에서 지웁니다. | 프로필 보관함 | CLI · TUI |
| [`repos status`](#repos-status) | 목록의 저장소를 모두 검사해 일치·뒤처짐·충돌·숨은 문자를 보여 줍니다. --refresh는 각 원천 저장소의 최신 커밋도 확인합니다. | 없음 | CLI · TUI |
| [`repos sync`](#repos-sync) | 고정하지 않은 목록의 저장소를 바뀔 내용을 보여 준 뒤 한 번에 동기화합니다. 관리 파일에 커밋하지 않은 변경이 있는 저장소는 건너뜁니다. | 저장소 파일 | CLI · TUI |
| [`repos pr`](#repos-pr) | 프로필이 바뀐 저장소마다 임시 worktree에서 새 브랜치에 커밋하고 push한 뒤 gh로 PR을 엽니다. --targets는 파일에서 경로나 clone URL을 읽습니다. | Git 원격 | CLI · TUI |
| [`install`](#install) | 이 패키지의 agctx 스킬을 이 컴퓨터에 있는 에이전트마다 스킬 폴더에 복사합니다. | 에이전트 스킬 폴더 | CLI · TUI |
| [`uninstall`](#uninstall) | agctx install이 둔 agctx 스킬을 지웁니다. | 에이전트 스킬 폴더 | CLI · TUI |
| [`config lang`](#config-lang) | 표시·생성 언어를 저장합니다. | 없음 | CLI · TUI |
<!-- agctx:generated:commands:end -->

### `profile create`

새 프로필과 초기 `AGENTS.md`를 만든다. 프로필은 기본적으로 `~/.agctx/profiles/<name>`에 저장된다.

<!-- agctx:generated:usage:profile.create:start -->
```bash
agctx profile create [--scope <scope>] [<name>]
```

종료 코드: `0` 성공 · `64` 사용법 오류 · `70` 기타 오류
<!-- agctx:generated:usage:profile.create:end -->

| 인자·옵션 | 설명 | 기본값·허용값 |
| --- | --- | --- |
| `<name>` | 프로필 이름 | TUI에서 입력; 소문자·숫자·하이픈 1-64자 |
| `--scope <scope>` | 프로필의 용도 분류 | 기본 `personal`; `personal`, `company`, `team`, `workspace` |

이름을 생략하면 TUI에서 이름과 scope를 선택하고 생성 여부를 확인한다. 표준 입력이 터미널이 아닌 환경에서 이름을 생략하면 표준 입력의 첫 줄을 이름으로, 둘째 줄을 scope로 읽는다. 읽은 이름이 비었거나 `--json`을 주면 종료 코드 64로 멈춘다.

### `profile list`

등록된 프로필을 scope별로 표시한다. 터미널에서는 프로필을 선택한 뒤 관리 작업까지 이어서 실행할 수 있다.

<!-- agctx:generated:usage:profile.list:start -->
```bash
agctx profile list [--scope <scope>]
```

종료 코드: `0` 성공 · `64` 사용법 오류 · `70` 기타 오류
<!-- agctx:generated:usage:profile.list:end -->

터미널에서는 먼저 전체 또는 `personal`, `company`, `team`, `workspace` scope를 선택한다. 선택한 범위의 프로필 목록과 전체 개수를 표시한 뒤 프로필을 고르거나 새 프로필을 만들거나 Git에서 프로필을 가져온다. `--scope`를 전달하면 범위 선택을 건너뛴다. 프로필을 고르면 다음 작업을 선택한다.

- 상세 보기
- 지침 설정
- 프로젝트에 적용
- 프로젝트 동기화
- 프로젝트 충돌 해결
- 프로필 삭제
- Git 상태
- Git에서 받기
- Git으로 올리기
- Git에 연결

파이프·스크립트 환경에서는 읽기 쉬운 scope별 텍스트 목록만 출력한다. `--json`이면 `data.profiles`에 프로필 메타데이터 목록을 담는다.

```bash
agctx profile list --scope company
```

scope가 없는 프로필을 임의로 선택하지 않으며, 해당 scope에 프로필이 없으면 생성 방법을 안내한다.

프로젝트 적용·동기화·충돌 해결 메뉴에서는 현재 작업 폴더를 기준으로 디렉터리 탐색형 경로 선택기를 사용한다. 파일은 선택할 수 없으며, 존재하는 프로젝트 폴더만 제출할 수 있다.

### `profile view`

프로필의 scope와 현재 규칙 파일 내용을 출력한다. 규칙 파일은 `AGENTS.md`이고, `profile.json`의 `instructions`가 있으면 그 파일이다([파일 형식](file-formats.md#profilejson)).

<!-- agctx:generated:usage:profile.view:start -->
```bash
agctx profile view <name>
```

종료 코드: `0` 성공 · `64` 사용법 오류 · `70` 기타 오류
<!-- agctx:generated:usage:profile.view:end -->

`profile list`의 관리 메뉴에서는 `상세 보기`를 선택해 같은 내용을 TUI에서 확인할 수 있다.

### `profile remove`

프로필 보관함에서 선택한 프로필 폴더(`profile.json`·규칙 파일, Git 프로필이면 `.git`까지)를 통째로 삭제한다. 원격 Git 저장소와, 이미 프로젝트에 적용해 둔 파일은 바꾸지 않는다.

<!-- agctx:generated:usage:profile.remove:start -->
```bash
agctx profile remove [--yes] [<name>]
```

종료 코드: `0` 성공 · `64` 사용법 오류 · `70` 기타 오류
<!-- agctx:generated:usage:profile.remove:end -->

| 인자·옵션 | 설명 |
| --- | --- |
| `<name>` | 삭제할 프로필 이름; TUI에서 선택 가능 |
| `--yes` | 자동화 환경에서 삭제 확인을 명시적으로 승인 |

터미널에서 이름과 `--yes`를 생략하면 TUI에서 프로필을 선택하고 삭제 대상·영향을 보여 준 뒤 최종 확인한다. 터미널이 아니거나 `--json`이면 `<name>`과 `--yes`가 모두 필요하다.

### `profile setup`

프로필에 담을 공통 개발 지침 10개 항목을 켜고 꺼서 프로필 규칙 파일(기본 `AGENTS.md`)의 `<!-- agctx:guidance:start -->` 블록에 쓴다. 프로젝트 파일은 변경하지 않는다. 두 값의 뜻은 [지침 항목 켜고 끄기](../concepts/profiles.md#지침-항목-켜고-끄기)에 있다.

<!-- agctx:generated:usage:profile.setup:start -->
```bash
agctx profile setup [--workflow <on|off>] [--context <on|off>] [--tdd <on|off>] [--review <on|off>] [--verification <on|off>] [--instructions <on|off>] [--docs <on|off>] [--security <on|off>] [--untrusted <on|off>] [--language <on|off>] [<name>]
```

종료 코드: `0` 성공 · `64` 사용법 오류 · `70` 기타 오류
<!-- agctx:generated:usage:profile.setup:end -->

| 인자·옵션 | 설정 대상 |
| --- | --- |
| `<name>` | 설정할 프로필; 생략하면 TUI에서 `scope · 이름` 목록으로 선택 |
| `--workflow <on|off>` | 작업 흐름 지침 |
| `--context <on|off>` | 맥락 관리 지침 |
| `--tdd <on|off>` | TDD 지침 |
| `--review <on|off>` | 변경 검토 지침 |
| `--verification <on|off>` | 검증 지침 |
| `--instructions <on|off>` | 지침 파일 지침 |
| `--docs <on|off>` | 문서화 지침 |
| `--security <on|off>` | 보안 지침 |
| `--untrusted <on|off>` | 믿을 수 없는 입력 지침 |
| `--language <on|off>` | 응답 언어 지침 (기본값 `off`) |

모든 지침 옵션의 `<on|off>`는 `on` 또는 `off`다. 기본값은 각 항목의 기존 설정이며, 최초 설정에서는 응답 언어가 `off`이고 나머지는 `on`이다. ADR 0028 이전에 저장된 `recommended`·`strict`는 `on`으로 읽는다.

지침 옵션을 하나라도 전달하면 `<name>`이 필요하고, 전달한 항목만 바꾼다. 지침 옵션을 하나도 전달하지 않으면 TUI가 열린다. `<name>`도 없으면 먼저 프로필을 고르고, 그다음 각 지침의 설명과 현재값을 확인해 수준을 고른다. 마지막에 전체 설정 요약을 보여 주며, 사용자가 승인한 경우에만 프로필에 저장한다.

표준 입력이 터미널이 아닌 환경에서 지침 옵션 없이 실행하면 표준 입력을 줄 단위로 읽는다. 이름을 생략했다면 첫 줄을 프로필 번호 또는 이름으로 읽는다. 이어지는 줄은 작업 흐름·맥락 관리·TDD·변경 검토·검증·지침 파일·문서화·보안·믿을 수 없는 입력·응답 언어 순서의 수준이다. 빈 줄은 기존 설정을 유지한다. `--json`을 주면 표준 입력을 읽지 않고 종료 코드 64로 멈춘다.

`setup`은 지침 구역을 프로필의 규칙 파일에 쓴다. Git 프로필이면 `setup`이 바꾼 규칙 파일과 `profile.json`은 커밋하지 않은 변경으로 남는다. 팀과 공유하려면 프로필 폴더에서 커밋한 뒤 `profile push`한다.

```bash
agctx profile setup
agctx profile setup company --tdd on --security on
```

### `profile apply`

선택한 프로필을 대상 프로젝트에 적용한다. 프로필 이름을 반드시 지정하므로, 프로젝트에 적용된 프로필을 처음 정하거나 다른 프로필로 전환하는 명령이다.

<!-- agctx:generated:usage:profile.apply:start -->
```bash
agctx profile apply [--dry-run] [--pin] [--yes] <name> [<project>]
```

종료 코드: `0` 성공 · `2` 충돌 · `3` 숨은 문자 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:profile.apply:end -->

| 옵션·인자 | 설명 |
| --- | --- |
| `<name>` | 적용할 프로필 이름; 필수 |
| `<project>` | 적용할 프로젝트 경로; 생략하면 현재 디렉터리 |
| `--dry-run` | 변경 계획만 출력하고 파일은 변경하지 않음 |
| `--pin` | Git 프로필의 현재 커밋에 프로젝트를 고정 |
| `--yes` | 터미널이 아닌 환경에서 적용을 승인 |

- **만드는 파일:** 프로젝트에 `AGENTS.md`, 에이전트별 포인터 파일(`CLAUDE.md`·`.agents/rules/agctx.md`), `agctx.project.json`을 만든다. 마지막으로 쓴 관리 영역 원문은 `.agctx/base/<경로>.base`에 기록하고, `.agctx/.gitignore`로 `backups/`를 커밋에서 뺀다.
- **보존하는 내용:** 기존 `AGENTS.md`의 프로젝트 규칙 확장 섹션과, 포인터 파일의 관리 블록 밖 내용은 건드리지 않는다.
- **다시 실행할 때:** 이미 적용된 프로젝트에 같은 프로필로 다시 실행하면 관리 영역만 갱신한다. 다른 프로필 이름을 주면 그 프로필로 전환한다.
- **여러 번 실행해도 같음:** 같은 프로필을 몇 번 다시 적용해도 결과가 같다. 바뀔 파일이 없으면 확인을 묻지 않고 `already up to date`로 끝난다.

**하위 폴더 연결 파일:** Claude Code는 `AGENTS.md`를 직접 읽지 않으므로, 프로젝트 루트 아래의 `AGENTS.md`마다 같은 폴더에 `@AGENTS.md`를 가져오는 관리 블록 `CLAUDE.md`를 만든다.

- 프로젝트가 Git 저장소 루트면 `.gitignore`로 무시한 파일은 빼고 아직 커밋하지 않은 새 파일은 넣는다. `node_modules`·`dist`·`build`·`vendor`·`.venv`·`target`·`coverage` 폴더와 중첩된 Git 저장소는 보지 않는다.
- 같은 폴더에 사람이 둔 `CLAUDE.md`나 `.claude/CLAUDE.md`(심볼릭 링크 포함)가 있으면 쓰지 않는다. 그 파일이 `AGENTS.md`를 가져오지 않으면 경고한다. 경고는 stderr로 나가고 `--json`이면 `warnings`에 담긴다.
- 연결 파일도 관리 영역 hash와 `.agctx/base/`를 기록하므로, 블록 안을 고치면 다른 관리 파일처럼 충돌로 멈춘다.
- 관리하던 연결 파일 옆의 `AGENTS.md`가 없어지면 파일은 지우지 않고 관리 기록에서만 빼며 경고한다.

```bash
$ agctx profile apply team-backend . --dry-run
packages/web/CLAUDE.md does not import AGENTS.md, so Claude Code never reads packages/web/AGENTS.md. Add an import of it, such as @AGENTS.md.
Dry-run: 12 file(s) to change.
  create    AGENTS.md
  create    CLAUDE.md
  create    .agents/rules/agctx.md
  create    services/orders/CLAUDE.md
  create    services/payments/CLAUDE.md
  create    .agctx/base/AGENTS.md.base
  …
  create    agctx.project.json
Dry-run: no files were changed.

$ cat services/payments/CLAUDE.md
<!-- agctx:managed:start -->
# Claude Code instructions for this folder

Claude Code reads CLAUDE.md, not AGENTS.md, so this file brings in the AGENTS.md next to it.

@AGENTS.md
<!-- agctx:managed:end -->
```

**APM이 만든 파일:** Microsoft APM의 기본 모드가 만든 `AGENTS.md`나 `CLAUDE.md`(처음 다섯 줄에 APM 생성 표시)에는 쓰지 않고 종료 코드 2로 멈춘다. 다음 `apm compile`이 agctx가 쓴 내용을 덮어쓰기 때문이다. `AGENTS.md`의 프로젝트 영역에 둔 APM `managed_section` 블록(`<!-- apm:start -->`~`<!-- apm:end -->`)은 그대로 둔다. 함께 쓰는 절차는 [APM과 함께 쓰기](../guides/apm-coexistence.md)에 있다.

```bash
$ agctx profile apply team-backend . --dry-run
Error: APM generated AGENTS.md in its default mode, so the next apm compile would overwrite what agctx writes there.
Next: Set compilation.agents_md.mode: managed_section in apm.yml, move AGENTS.md aside, and run agctx profile apply again. Then put <!-- apm:start --> and <!-- apm:end --> below the project rule extensions heading and run apm compile.
```

적용한 프로필 버전은 `agctx.project.json`에 기록한다.

- **Git 프로필:** 프로필 폴더가 Git 저장소이면 `source`에 원격 URL·브랜치·커밋을 적는다. URL에 들어 있는 사용자 정보와 토큰은 지운다. 로컬 프로필은 `source`를 기록하지 않는다.
- **추가 표시:** 프로필의 규칙 파일·`profile.json`에 커밋하지 않은 수정이 섞였으면 `uncommitted: true`를, `--pin`을 주면 `pin: true`를 더한다.
- **프로젝트 이름:** `AGENTS.md`에 쓴 프로젝트 이름(`projectName`)도 기록한다. 그래서 다른 이름의 폴더로 clone한 저장소나 임시 worktree에서도 같은 파일이 나온다. 이름은 `package.json`에 `name`이 있으면 그 값을 먼저 쓴다.
- **저장소 목록:** 적용한 저장소는 이 컴퓨터의 저장소 목록에도 기록된다([`repos list`](#repos-list)).

기록하는 필드와 예시는 [파일 형식과 저장 위치](file-formats.md#agctxprojectjson)에 있다.

- **`--pin`:** Git 프로필이고 커밋하지 않은 수정이 없어야 한다. 아니면 종료 코드 64로 멈추고 연결하거나 커밋할 명령을 안내한다. 고정한 프로젝트의 `sync`는 기록한 커밋을 유지하므로, 새 커밋으로 옮기려면 `apply --pin`을 다시 실행한다.
- **고정 해제:** 고정한 프로젝트에 `--pin` 없이 `apply`하면 고정이 풀린다는 경고를 먼저 출력한다.

  ```bash
  $ agctx profile apply team-backend /work/orders-api
  Warning: /work/orders-api is pinned to a profile commit. Applying without --pin removes the pin, so later profile sync follows the profile store. Add --pin to keep it pinned.
  Plan: 1 file(s) to change.
  …
    update    agctx.project.json
  ```

- **TUI:** 관리 메뉴의 적용은 Git 프로필이면 고정할지 묻고, Yes를 고르면 `--pin`을 준 것과 같다. 이미 고정한 프로젝트는 Yes가 미리 선택되어 있다([TUI로 쓰기](../guides/tui.md#프로젝트에-적용하기)).
- 적용할 프로필 내용에 숨은 문자가 있으면 파일을 쓰지 않고 종료 코드 3으로 멈춘다.
- `AGENTS.md`의 관리 영역은 파일 처음부터 `<!-- agctx:managed:end -->`까지다. 그 아래는 사용자 것이므로 처음 적용할 때 써 주는 `## 4. 프로젝트 규칙 확장 (SSOT)`(ko)·`## 4. Project rule extensions (SSOT)`(en) 제목을 바꿔도 된다. 마커가 없는 기존 파일은 이 제목으로 경계를 찾으며 두 로케일을 모두 인식한다.
- 확장 섹션이 없는 기존 `AGENTS.md`는 내용을 `## Existing project guidance` 아래로 옮겨 보존한다.
- 기록된 관리 영역을 밖에서 고친 프로젝트에서는 `apply`도 `sync`와 같이 파일을 쓰지 않고 `프로필이 관리하는 영역을 직접 고친 파일이 있습니다: <파일 목록>`과 종료 코드 2로 멈춘다. 다음 단계로 차이를 볼 명령(`profile sync --dry-run`)과 푸는 명령(`profile resolve`)을 알려 준다. 푸는 절차는 [관리 영역과 확장 영역](../concepts/managed-and-extension-areas.md#관리-영역을-고쳐서-멈췄을-때)에 있다.

### `profile sync`

프로젝트가 이미 적용받은 프로필을 최신 지침으로 다시 적용한다. `sync`는 프로필을 **전환하지 않는다**. 프로필 이름이나 `--profile`을 주면 종료 코드 64로 거부하며, 전환하려면 `profile apply <name> <project>`를 쓴다.

<!-- agctx:generated:usage:profile.sync:start -->
```bash
agctx profile sync [--dry-run] [--yes] [<project>]
```

종료 코드: `0` 성공 · `2` 충돌 · `3` 숨은 문자 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:profile.sync:end -->

| 옵션·인자 | 설명 |
| --- | --- |
| `<project>` | 동기화할 프로젝트 경로; 생략하면 현재 디렉터리 |
| `--dry-run` | 변경 계획만 출력하고 파일은 변경하지 않음 |
| `--yes` | 터미널이 아닌 환경에서 동기화를 승인 |

대상 프로필은 프로젝트의 `agctx.project.json`에 기록된 값을 사용한다. 아직 적용되지 않은 프로젝트에서 실행하면 `profile apply <name> <project>`로 먼저 적용하라는 오류(64)로 끝난다. 프로젝트 `AGENTS.md`의 프로젝트 규칙 확장 섹션과 포인터 파일의 관리 블록 밖 내용은 보존하고, agctx가 관리하는 영역만 갱신한다. 적용한 뒤에 생긴 하위 폴더 `AGENTS.md`에는 이때 연결 파일을 만든다([`profile apply`](#profile-apply)).

- **고정한 프로젝트:** 기록한 커밋의 `AGENTS.md`로 다시 만든다. 보관함의 프로필을 pull한 뒤에도 결과는 바뀌지 않는다. 그 커밋이 이 컴퓨터의 프로필 저장소에 없으면 종료 코드 69로 멈추고 `profile pull`을 안내한다.
- **고정하지 않은 프로젝트:** 보관함의 현재 프로필로 다시 만들고 버전 기록을 갱신한다.

`--dry-run`을 사용하면 실제 파일을 바꾸지 않고 계획만 출력한다. `apply --dry-run`도 같다.

- **파일 상태:** 파일마다 `create`(새로 만듦)·`update`(고침)·`unchanged`(그대로)·`conflict`(관리 영역을 밖에서 고쳐 쓰지 못함) 중 하나를 붙인다.
- **충돌 파일의 diff:** `conflict` 파일은 diff를 함께 출력한다. 마지막 적용본(`.agctx/base/`)이 있으면 그 뒤에 사람이 관리 영역 안에서 고친 부분과 agctx가 새로 쓸 프로필·템플릿 변경을 나눠 보여 준다. 없으면 지금의 관리 영역과 agctx가 쓸 내용을 비교한다.
- **종료 코드:** 충돌이 하나라도 있으면 계획을 끝까지 출력한 뒤 종료 코드 2로 끝난다.
- **TUI:** 프로젝트 적용·동기화를 고르면 계획을 보여 준 뒤 적용할지 묻고, 충돌로 멈추면 충돌 해결로 이어갈지 묻는다.

### `profile resolve`

관리 영역 충돌을 푼다. 대상 프로필은 `sync`처럼 프로젝트의 `agctx.project.json`에 기록된 값을 사용한다.

<!-- agctx:generated:usage:profile.resolve:start -->
```bash
agctx profile resolve [--dry-run] [--discard] [--edit] [--yes] [<project>]
```

종료 코드: `0` 성공 · `2` 충돌 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:profile.resolve:end -->

| 옵션·인자 | 설명 |
| --- | --- |
| `<project>` | 충돌을 풀 프로젝트 경로; 생략하면 현재 디렉터리 |
| `--dry-run` | 파일별로 옮길 줄·되살릴 줄·백업 경로만 출력하고 파일은 변경하지 않음 |
| `--discard` | 마지막 적용본을 알 수 없는 충돌에서 현재 파일을 `.agctx/backups/<시각>/`에 복사한 뒤 관리 영역을 새로 만듦 |
| `--edit` | 마지막 적용본을 아는 충돌마다 VS Code 3-way merge 편집기(`code --wait --merge`)를 엶 |
| `--yes` | 터미널이 아닌 환경에서 해결을 승인 |

- 충돌이 없으면 `Nothing to resolve`를 출력하고 파일을 바꾸지 않는다.
- 파일마다 할 일(옮김·다시 만듦·백업 뒤 다시 만듦·편집기에서 병합)을 출력한 뒤 확인을 받는다. `--edit`은 확인한 뒤에 편집기를 연다.
- **마지막 적용본을 아는 경우:** `.agctx/base/`의 원문 hash가 기록과 같거나 지금 다시 만든 관리 영역의 hash가 기록과 같은 경우다. 관리 영역 안에서 추가·수정한 줄을 관리 영역 밖으로 옮긴다. 포인터 파일은 관리 블록 바로 아래, `AGENTS.md`는 마커 아래 파일 끝이다. 관리 영역은 현재 프로필로 새로 만들며 그 사이 프로필이 바뀌었어도 같다. 관리 영역 안에서 지운 줄은 되살아나고 파일별 개수를 알린다. 줄을 고친 경우에는 고친 줄이 밖으로 옮겨지고 원래 줄이 되살아나므로 비슷한 문장이 두 번 남을 수 있다.
- **파일이 없는 경우:** 다시 만든다.
- **마지막 적용본을 모르는 경우:** base가 없는 상태에서 프로필까지 바뀐 경우다. 사용자 편집과 프로필 변경을 가려낼 수 없으므로 diff를 보여 주고 종료 코드 2로 멈춘다. `--discard`를 주면 백업한 뒤 새로 만든다.
- **`--edit`:** 아래쪽 Result 창은 자동 해결과 같은 내용, 곧 관리 영역 안에서 추가·수정한 줄을 밖으로 옮긴 파일로 열린다. 위쪽 창에서 변경을 받아들이지 않아도 되며, Result 창을 확인하고 고친 뒤 저장한다. 편집기를 열기 전에 터미널이 확인 순서를 안내한다. 위쪽 `current-<파일>` 창의 강조 영역은 원래 고친 위치이므로 수락하지 않는다. 탭을 닫을 때 VS Code가 처리되지 않은 충돌 경고를 띄우면 Result 창을 다시 확인하고 `충돌과 함께 닫기`(Close with Conflicts)를 누른다. 편집기를 닫으면 결과 파일에서 관리 영역 **밖**의 내용만 가져오고 관리 영역은 agctx가 새로 만든다. 저장할 때 포매터가 관리 영역을 바꿔도 적용된다. 결과의 관리 영역 안에 남은 변경은 적용하지 않고 diff와 보존한 결과 파일 경로로 알린다. 결과 파일에서 관리 마커가 사라졌으면 결과 파일 경로를 알려 주고 종료 코드 2로 멈춘다. `code` 명령을 실행할 수 없으면 설치 방법을 안내하고 종료 코드 69로 멈춘다. 근거는 [ADR 0010](../adr/0010-edit-merge-regenerates-managed-area.md)이다.
- 풀 수 없는 충돌이 하나라도 남으면 어떤 파일도 쓰지 않는다. 쓸 때는 관리 hash와 `.agctx/base/`를 함께 갱신한다.

`profile list`의 관리 메뉴에서는 `프로젝트 충돌 해결`을 고른다. 경로를 고르면 계획을 먼저 보여 주고 자동 해결·VS Code에서 병합·백업 후 다시 생성 중 하나를 선택한다. 결정 근거는 [ADR 0008](../adr/0008-managed-conflict-recovery.md)에 있다.

### `profile clone`

Git 원격에 있는 프로필 저장소를 받아 프로필로 등록한다. 프로젝트 파일은 바꾸지 않는다.

<!-- agctx:generated:usage:profile.clone:start -->
```bash
agctx profile clone [--branch <branch>] <git-url>
```

종료 코드: `0` 성공 · `3` 숨은 문자 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:profile.clone:end -->

| 옵션·인자 | 설명 |
| --- | --- |
| `<git-url>` | 프로필 저장소 주소. HTTPS·SSH·로컬 경로 등 `git clone`이 받는 형식 |
| `--branch <branch>` | 받을 브랜치; 생략하면 원격의 기본 브랜치 |

- 프로필 폴더 안의 임시 경로에 `git clone --no-recurse-submodules`로 받는다. 저장소 루트에 일반 파일 `profile.json`이 있고, 그것이 가리키는 규칙 파일(`instructions`, 없으면 루트의 `AGENTS.md`)이 일반 파일이며, 메타데이터가 올바를 때만 등록한다(아니면 64). 규칙 파일이나 거쳐 가는 폴더가 심볼릭 링크여도 64다. `instructions`의 규칙은 [파일 형식](file-formats.md#profilejson)에 있다.
- 두 파일에 숨은 문자가 있으면 등록하지 않고 종료 코드 3으로 멈춘다.
- 프로필 이름은 `profile.json`의 `name`을 쓴다. 같은 이름의 프로필이 이미 있으면 종료 코드 64로 멈춘다. 저장소 하나에 프로필 하나를 둔다.
- 인증은 사용자의 Git 설정(SSH 키·credential helper)을 그대로 쓴다. 터미널이 아니면 인증 질문을 띄우지 않으므로 인증이 없으면 종료 코드 69로 끝난다.
- TUI에서는 메인 화면의 `프로필 가져오기`나 프로필 목록의 `Git에서 프로필 가져오기`에서 주소와 브랜치를 입력한다. 브랜치를 비워 두면 `--branch`를 주지 않은 것과 같다.

```bash
$ agctx profile clone /work/team-backend.git
Cloned profile team-backend at commit 39ca6e1.
Next: agctx profile apply team-backend <project>
```

### `profile status`

Git 프로필의 원격·브랜치·커밋·수정 여부와 원격 대비 앞섬·뒤처짐을 보여 준다.

<!-- agctx:generated:usage:profile.status:start -->
```bash
agctx profile status [--refresh] [<name>]
```

종료 코드: `0` 성공 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:profile.status:end -->

| 옵션·인자 | 설명 |
| --- | --- |
| `<name>` | 확인할 프로필; 생략하면 모든 프로필 |
| `--refresh` | 원격에서 fetch한 뒤 비교; 생략하면 네트워크에 접속하지 않고 마지막으로 받은 원격 정보로 비교 |

한 줄은 `이름`, `원격 브랜치@커밋`(원격 브랜치는 현재 브랜치가 추적하는 브랜치), `clean` 또는 커밋하지 않은 변경 수, `ahead N, behind N`을 탭으로 구분한다. Git 저장소가 아닌 프로필은 `not connected to Git`, 추적 브랜치가 없으면 `no remote branch`로 표시한다. 뒤처졌으면 `profile pull`, 앞섰으면 `profile push`를 다음 명령으로 알려 준다. TUI의 `Git 상태`는 원격에서 먼저 받을지 묻고, Yes(기본)면 `--refresh`로 실행한다.

```bash
$ agctx profile status --refresh team-backend
team-backend	/work/team-backend.git main@39ca6e1	clean	ahead 0, behind 1
  Next: agctx profile pull team-backend
```

### `profile pull`

추적 원격의 새 커밋을 프로필에 받는다. 프로필 보관함만 바꾸므로 확인을 묻지 않는다.

<!-- agctx:generated:usage:profile.pull:start -->
```bash
agctx profile pull [--dry-run] <name>
```

종료 코드: `0` 성공 · `2` 충돌 · `3` 숨은 문자 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:profile.pull:end -->

| 옵션·인자 | 설명 |
| --- | --- |
| `<name>` | 받을 프로필 |
| `--dry-run` | 들어올 커밋만 보여 주고 프로필은 바꾸지 않음 |

- fetch한 뒤 fast-forward만 한다. merge·rebase·reset은 하지 않는다.
- 다음 경우에는 받지 않고 멈춘다: Git에 연결되지 않았거나 추적 브랜치가 없음(64), 커밋하지 않은 변경이 있음(2), 로컬과 원격이 갈라짐(2), 받을 `profile.json`이나 그것이 가리키는 규칙 파일이 프로필 형식이 아님(64), 받을 내용에 숨은 문자가 있음(3).
- 프로젝트 파일은 바꾸지 않는다. 받은 뒤 고정하지 않은 프로젝트는 `profile sync`, 고정한 프로젝트는 `profile apply <name> <project> --pin`으로 반영한다.
- TUI의 `Git에서 받기`는 들어올 커밋을 보여 준 뒤 받을지 묻는다.

```bash
$ agctx profile pull team-backend
Pulled 1 commit(s) into profile team-backend:
  ddf3742 Make TDD strict
Next: run agctx profile sync <project> in projects that use team-backend. A project pinned with --pin stays on its commit until you run agctx profile apply team-backend <project> --pin.
```

### `profile push`

프로필 폴더에서 이미 만든 커밋을 추적 원격으로 보낸다.

<!-- agctx:generated:usage:profile.push:start -->
```bash
agctx profile push [--dry-run] [--yes] <name>
```

종료 코드: `0` 성공 · `2` 충돌 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:profile.push:end -->

| 옵션·인자 | 설명 |
| --- | --- |
| `<name>` | 보낼 프로필 |
| `--dry-run` | 보낼 커밋만 보여 주고 보내지 않음 |
| `--yes` | 터미널이 아닌 환경에서 전송을 승인 |

- agctx는 `git add`·`git commit`을 실행하지 않는다. 커밋하지 않은 변경이 있으면 빠지는 파일을 보여 주고 종료 코드 2로 멈춘다.
- 원격보다 뒤처졌으면 종료 코드 2로 멈추고 `profile pull`을 먼저 안내한다. Git에 연결되지 않았거나 브랜치가 없는 HEAD면 64다.
- 보낼 커밋 목록을 출력한 뒤 확인을 받고, 현재 브랜치가 추적하는 원격 브랜치로 `git push <원격> HEAD:refs/heads/<원격 브랜치>`를 실행한다. 추적 설정이 없으면 현재 브랜치와 같은 이름으로 보낸다. 보낼 커밋이 없으면 알리고 0으로 끝난다. 보호 브랜치 규칙처럼 원격이 거부하면 Git의 오류를 그대로 보여 준다.

```bash
$ agctx profile push --yes team-backend
1 commit(s) of profile team-backend will go to /work/team-backend.git:
  39ca6e1 Add team-backend profile
Pushed profile team-backend.
```

### `profile connect`

로컬에서 만든 프로필을 Git 원격에 연결한다. 커밋과 push는 하지 않는다.

<!-- agctx:generated:usage:profile.connect:start -->
```bash
agctx profile connect [--branch <branch>] <name> <git-url>
```

종료 코드: `0` 성공 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:profile.connect:end -->

| 옵션·인자 | 설명 |
| --- | --- |
| `<name>` | 연결할 프로필 |
| `<git-url>` | 원격 저장소 주소 |
| `--branch <branch>` | 현재 브랜치가 추적하고 push할 원격 브랜치; 생략하면 현재 브랜치와 같은 이름 |

- 추적 설정은 현재 브랜치(`branch.<현재 브랜치>.remote`·`merge`)에 쓴다. 예를 들어 로컬 브랜치가 `master`이고 팀 원격 브랜치가 `main`이면 `--branch main`으로 연결한다. 그 뒤 `status`는 `main`과 비교하고, `pull`은 `main`에서 받고, `push`는 `main`으로 보낸다. 분리된 HEAD처럼 현재 브랜치가 없으면 64로 멈춘다.
- TUI의 `Git에 연결`은 주소와 추적할 원격 브랜치를 묻는다. 비워 두면 `--branch`를 주지 않은 것과 같다.
- 프로필 폴더가 Git 저장소가 아니면 첫 커밋을 만드는 명령을 알려 주고 종료 코드 64로 멈춘다.

  ```bash
  $ agctx profile connect team-backend /work/team-backend.git
  Error: Profile team-backend is not a Git repository yet.
  Next: Create the first commit, then connect again:
    git -C "/work/admin/profiles/team-backend" init -b main
    git -C "/work/admin/profiles/team-backend" add -A
    git -C "/work/admin/profiles/team-backend" commit -m "Add team-backend profile"
  ```

- `origin`이 이미 다른 주소를 가리키면 64로 멈추고 주소를 바꾸는 명령을 알려 준다.
- `git ls-remote`로 원격에 접근할 수 있는지 확인한다(실패하면 69). 그 뒤 `origin`과 브랜치의 추적 설정을 기록한다.

```bash
$ agctx profile connect team-backend /work/team-backend.git
Connected profile team-backend to /work/team-backend.git (branch main).
Next: agctx profile push team-backend
```

### `check`

프로젝트가 기록한 프로필 버전과 지금 파일이 맞는지 확인한다. 파일을 바꾸지 않는다. TUI에서는 **프로젝트 점검** > **프로필 버전**으로 실행한다.

<!-- agctx:generated:usage:check:start -->
```bash
agctx check [--refresh] [<project>]
```

종료 코드: `0` 성공 · `1` 뒤처짐 · `2` 충돌 · `3` 숨은 문자 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:check:end -->

| 옵션·인자 | 설명 |
| --- | --- |
| `<project>` | 확인할 프로젝트; 생략하면 현재 디렉터리 |
| `--refresh` | `agctx.project.json`의 `source`가 가리키는 원격 브랜치의 최신 커밋과 비교 |

| 결과 | 출력 종류 | 종료 코드 |
| --- | --- | --- |
| 관리 파일이 없거나 관리 영역을 밖에서 고침 | `conflict` | 2 |
| 관리 파일에 숨은 문자가 있음(`파일:줄:열 U+XXXX 종류`) | `hidden-characters` | 3 |
| 커밋하지 않은 프로필 수정으로 적용함(`uncommitted`) | `behind` | 1 |
| 이 컴퓨터의 프로필로 다시 만든 결과와 다름 | `behind` | 1 |
| 고정한 프로젝트인데 이 컴퓨터의 프로필 보관함에 기록보다 새 커밋이 있음 | `behind` | 1 |
| `--refresh`: 원격 브랜치에 기록보다 새 커밋이 있음 | `behind` | 1 |

- 이 컴퓨터에 프로필이 있으면 기록한 버전(고정했으면 기록한 커밋)으로 다시 만든 결과와 비교한다.
- CI처럼 프로필이 없으면 그 비교를 건너뛰고 경고한다. Git 프로필로 적용한 저장소라면 `--refresh`로 원격과 비교한다. 원격 접근이 실패하면 69다.
- 아직 적용하지 않은 프로젝트는 64로 끝나고 `profile apply`를 안내한다.
- CI 설정 예시는 [CI와 자동화에서 쓰기](../guides/ci.md#ci에서-확인하기)에 있다.

```bash
$ agctx check /work/orders-api          # 프로필이 없는 CI
/work/orders-api matches its recorded profile version.
The profile is not in this machine's profile store; run with --refresh to compare with the source repository.

$ agctx check --refresh /work/orders-api
behind            -  the source repository has a newer commit (ddf3742)
```

### `explain`

한 폴더에서 시작한 Codex·Claude Code·Antigravity가 읽는 지침 파일과 그 이유를 보여 준다. 에이전트를 실행하지 않고 파일도 바꾸지 않는다. TUI에서는 **프로젝트 점검** > **에이전트가 읽는 지침 파일**로 실행한다.

<!-- agctx:generated:usage:explain:start -->
```bash
agctx explain [--agent <codex|claude|antigravity|all>] [<path>]
```

종료 코드: `0` 성공 · `4` 전달 누락 · `64` 사용법 오류 · `70` 기타 오류
<!-- agctx:generated:usage:explain:end -->

| 옵션·인자 | 설명 |
| --- | --- |
| `<path>` | 에이전트를 시작할 폴더. 파일을 주면 그 파일이 있는 폴더, 생략하면 현재 폴더 |
| `--agent` | 볼 에이전트. 쉼표로 여러 개를 주거나 `all`(기본) |

시작 폴더가 속한 Git 저장소의 루트를 프로젝트 루트로 삼고, 파일마다 상태를 하나 붙인다.

| 상태 | 뜻 |
| --- | --- |
| `read` | 세션을 시작할 때 읽는다 |
| `on-demand` | 그 폴더의 파일을 읽을 때 읽는다(Claude Code의 시작 폴더 아래 `CLAUDE.md`, 그리고 `CLAUDE.md`가 없는 하위 폴더의 `AGENTS.md`) |
| `conditional` | 조건이 맞을 때만 읽는다. Claude Code의 `paths` 규칙과 승인이 필요한 가져오기, Antigravity의 `always_on`·`glob`이 아닌 규칙과 하위 폴더 `AGENTS.md` |
| `shadowed` | 다른 파일을 대신 읽어서 이 파일이 빠진다. Codex는 같은 폴더의 `AGENTS.override.md`를, Claude Code는 시작 폴더나 그 위의 `CLAUDE.md` 계열 파일을 대신 읽는다 |
| `not-read` | 이 폴더에서 시작하면 읽지 않는다 |

파일 목록 아래에는 판정이 붙는다.

- `missing`: 프로젝트 지침 파일이 이 에이전트에 닿지 않는다. 하나라도 있으면 종료 코드 4다. 커밋되는 `CLAUDE.md`가 가리는데 그 파일이 가져오지도 않는 `AGENTS.md`(Claude Code), `trigger: glob`이거나 `trigger` frontmatter가 없는 규칙(Antigravity)이 여기에 해당한다. `CLAUDE.local.md`만 가리는 경우는 개인 파일이라 `warning`으로 둔다.
- `warning`: 시작 위치나 한 번의 승인에 따라 달라지는 경우다. 종료 코드는 바꾸지 않는다. 루트에서 시작한 Codex가 건너뛰는 하위 폴더 `AGENTS.md`, 합산 32 KiB를 넘어 빠지는 파일, 하위 폴더에서 시작한 Claude Code가 승인해야 읽는 시작 폴더 밖 가져오기, Antigravity가 세션 시작에 받지 않은 하위 폴더 `AGENTS.md`, 규칙으로 보이는 줄을 3줄 이상 함께 담은 두 파일(하나는 세션 시작에 읽는 파일)이 같은 에이전트에 들어가는 중복이 여기에 해당한다.
- Codex·Claude Code·Antigravity가 읽지 않는 다른 도구의 규칙 파일(`.cursorrules`, `.cursor/rules`, `.github/copilot-instructions.md`, `.windsurfrules`, `.clinerules`, `.agent/rules`)은 마지막에 목록으로 보여 준다.
- 사용자 수준 파일(`~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md` 등)도 함께 보여 주지만 `missing`으로 판정하지 않는다. `CODEX_HOME`·`CLAUDE_CONFIG_DIR`를 설정했으면 그 폴더를 본다.
- 판정 규칙의 근거는 [에이전트 지침 로드와 전달 확인 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)와 [에이전트 규칙 파일 로드 근거](../references.md#에이전트-규칙-파일-로드-근거)에 있다. Codex의 `project_doc_fallback_filenames`·`project_doc_max_bytes` 설정과 Claude Code의 `claudeMdExcludes` 설정은 반영하지 않는다. Claude Code가 `AGENTS.md`를 읽을지 정하는 `instructionFiles` 설정은 `explain`을 실행하는 사람의 `~/.claude/settings.json`에서 읽는다([ADR 0035](../adr/0035-claude-code-reads-agents-md.md)).

아래는 `team-backend` 프로필을 적용한 모노레포에 `services/payments/AGENTS.md`, `trigger: glob` 규칙 `.agents/rules/payments.md`, `.cursorrules`를 더한 뒤 실행한 결과다.

```bash
$ agctx explain services/payments
Codex · started in services/payments
  read         AGENTS.md  one file per folder from the project root to the start folder
  read         services/payments/AGENTS.md  one file per folder from the project root to the start folder

Claude Code · started in services/payments
  read         CLAUDE.md  start folder or a folder above it, read at launch
  conditional  AGENTS.md  imported by CLAUDE.md from outside the start folder; read only after external imports are approved
  shadowed     services/payments/AGENTS.md  CLAUDE.md is read instead, so this file is not
  warning      CLAUDE.md imports AGENTS.md from outside the start folder. Claude Code reads it only after someone approves external imports for this project once in an interactive session; starting at the project root needs no approval.
  missing      Claude Code never reads services/payments/AGENTS.md. Run agctx profile sync to add a CLAUDE.md that imports it, or add one with @AGENTS.md yourself.

Antigravity · started in services/payments
  read         AGENTS.md  workspace root file (measured)
  read         .agents/rules/agctx.md  trigger: always_on
  not-read     .agents/rules/payments.md  trigger: glob is not delivered at session start (measured)
  conditional  services/payments/AGENTS.md  AGENTS.md in a subfolder; not delivered at session start (measured), and not verified whether Antigravity reads it later
  missing      Antigravity does not load .agents/rules/payments.md at session start. Use trigger: always_on for rules every task needs.
  warning      Antigravity did not receive services/payments/AGENTS.md at session start when measured. Put rules every task needs in the root AGENTS.md or a trigger: always_on rule.

Not read by Codex, Claude Code, or Antigravity:
  .cursorrules  rule file of another tool

$ agctx explain --agent codex .
Codex · started in the project root
  read         AGENTS.md  one file per folder from the project root to the start folder
  not-read     services/payments/AGENTS.md  below the start folder; read only when Codex starts there
  warning      Codex reads services/payments/AGENTS.md only when started in services/payments.
…
```

첫 명령은 `missing`이 있어 4로, 둘째 명령은 경고만 있어 0으로 끝난다. `agctx profile sync`로 `services/payments/CLAUDE.md` 연결 파일을 만들고 규칙을 `trigger: always_on`으로 바꾸면 첫 명령도 0으로 끝난다.

`--json`이면 `data`에 `path`(시작 폴더)·`root`·`agents[]`·`unsupported[]`·`exitCode`가 들어간다. `agents[]`는 `agent`·`startDir`·`files[]`·`findings[]`를 담고, `files[]`의 `scope`는 `project`·`user`·`managed-policy`, `origin`은 agctx가 관리하는 파일이면 `agctx-managed`다.

```bash
$ agctx explain --json --agent claude services/payments
{
  "schemaVersion": 1,
  "command": "explain",
  "exitCode": 4,
  "ok": false,
  "data": {
    "path": "/work/shop/services/payments",
    "root": "/work/shop",
    "agents": [
      {
        "agent": "claude",
        "startDir": "services/payments",
        "files": [
          …
          {
            "path": "AGENTS.md",
            "absolutePath": "/work/shop/AGENTS.md",
            "status": "conditional",
            "scope": "project",
            "reason": "imported by CLAUDE.md from outside the start folder; read only after external imports are approved",
            "origin": "agctx-managed"
          },
          …
        ],
        "findings": [
          …
          {
            "kind": "missing",
            "file": "services/payments/AGENTS.md",
            "message": "Claude Code never reads services/payments/AGENTS.md. Run agctx profile sync to add a CLAUDE.md that imports it, or add one with @AGENTS.md yourself."
          }
        ]
      }
    ],
    "unsupported": [
      …
    ],
    "exitCode": 4
  },
  "warnings": [],
  "errors": []
}
```

### `verify`

`explain`이 읽는다고 판정한 프로젝트 지침 파일이 에이전트에 실제로 들어갔는지 확인한다. 파일을 바꾸지 않는다. TUI에서는 **프로젝트 점검** > **에이전트 전달 확인**으로 실행하고, 증거로 세션 기록이나 probe를 고른다.

<!-- agctx:generated:usage:verify:start -->
```bash
agctx verify [--agent <codex|claude|antigravity|all>] [--probe] [--yes] [<path>]
```

종료 코드: `0` 성공 · `4` 전달 누락 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:verify:end -->

| 옵션·인자 | 설명 |
| --- | --- |
| `<path>` | 에이전트를 시작한 폴더. 생략하면 현재 폴더 |
| `--agent` | 확인할 에이전트. 쉼표로 여러 개를 주거나 `all`(기본) |
| `--probe` | 세션 기록 대신 에이전트 CLI를 한 번씩 실행해 확인. 실행 전에 확인을 받는다 |
| `--yes` | 터미널이 아닌 환경에서 probe를 승인 |

- **기대 파일:** `explain`에서 상태가 `read`인 프로젝트 파일이다. `conditional`·`on-demand` 파일은 요구하지 않지만, 들어온 증거가 있으면 `delivered`에 함께 적는다.
- **세션 기록(기본):**
  - Codex는 `$CODEX_HOME/sessions`(기본 `~/.codex/sessions`)에서 시작 폴더가 같은 가장 새 기록을 찾고, 가장 최근에 넣은 지침 본문에 파일 내용이 들어 있는지 본다.
  - Claude Code는 `$CLAUDE_CONFIG_DIR/projects`(기본 `~/.claude/projects`)에서 시작 폴더의 가장 새 기록을 찾고, 가장 최근에 불러온 지침 파일 목록과 그 뒤에 불러온 하위 폴더 지침에 파일 경로가 있는지 본다. 대화를 압축해 지침을 다시 불러온 세션은 다시 불러온 목록으로 판정한다.
  - Antigravity는 agctx가 읽을 수 있는 기록이 없어 `no-evidence`다.
  - 기록이 없거나, 지침을 불러온 뒤에 파일이 바뀌었으면(`stale`) `no-evidence`로 표시하고 종료 코드는 바꾸지 않는다. 기록은 가장 새 파일 300개 안에서 찾는다.
- **probe(`--probe`):** 프로젝트 지침 파일을 임시 Git 저장소에 복사해 파일마다 `agctx probe marker: AGCTX-PROBE-…` 줄을 붙인다. 그런 다음 시작 폴더에 해당하는 사본 폴더에서 에이전트 CLI를 도구 없이 한 번씩 실행해, 컨텍스트에 있는 표지 줄을 그대로 출력하게 한다. 실제 저장소는 바꾸지 않고 임시 저장소는 끝나면 지운다.

| 에이전트 | 실행 명령 |
| --- | --- |
| Codex | `codex exec --sandbox read-only --skip-git-repo-check --ephemeral -C <사본 시작 폴더> <질문>` |
| Claude Code | `claude -p <질문> --tools "" --no-session-persistence` |
| Antigravity | `agy -p <질문> --add-dir <사본 루트>` |

- probe는 에이전트 요금제나 API 사용량을 쓰고, 에이전트마다 로그인돼 있어야 한다. 한 에이전트가 5분 안에 끝나지 않으면 실패로 처리한다. CLI가 PATH에 없거나 오류로 끝나면 그 에이전트는 `error`이고 종료 코드는 69다.

| 결과 | 뜻 | 종료 코드 |
| --- | --- | --- |
| `pass` | 기대 파일이 모두 들어옴 | 0 |
| `fail` | 들어오지 않은 파일(`missing`)이 있음 | 4 |
| `no-evidence` | 판정할 기록이 없거나 오래됨 | 0 |
| `error` | probe를 실행하지 못함 | 69 |

아래는 `explain` 예시와 같은 저장소에서 실행한 결과다. 마지막 명령은 설치된 Codex·Claude Code·Antigravity CLI로 실제로 실행했다. Claude Code는 루트 `AGENTS.md`를 받지 않았지만 승인이 필요한 `conditional` 파일이라 `pass`다.

```bash
$ agctx verify services/payments
codex        no-evidence  no session log for this folder
claude       no-evidence  no session log for this folder
antigravity  no-evidence  agctx cannot read Antigravity session logs
Next: start an agent (Codex, Claude Code) in this folder once, or run agctx verify --probe to ask directly.
Next: run agctx verify --probe to ask Antigravity directly.

$ agctx verify services/payments --probe          # 터미널이 아닌 환경
Error: --probe runs Codex, Claude Code, Antigravity once each, which uses your agent plan or API credits, and it cannot ask for confirmation here.
Next: Run it with --yes: agctx verify services/payments --probe --yes

$ agctx verify services/payments --probe --yes
codex        pass         asked codex with marker lines in a scratch copy
  delivered  AGENTS.md
  delivered  services/payments/AGENTS.md
claude       pass         asked claude with marker lines in a scratch copy
  delivered  CLAUDE.md
antigravity  pass         asked agy with marker lines in a scratch copy
  delivered  AGENTS.md
  delivered  .agents/rules/agctx.md
```

Claude Code를 쓴 저장소에서는 세션 기록으로 판정한다. 아래 출력은 실제 결과에서 경로만 바꿨다.

```bash
$ agctx verify --agent claude /work/shop
claude       pass         session log /Users/me/.claude/projects/-work-shop/0f1c2d3e-….jsonl
  delivered  CLAUDE.md
  delivered  AGENTS.md
```

`--json`이면 `data.agents[]`에 `agent`·`status`·`evidence`(`session-log`·`probe`·`none`)·`source`(기록 파일이나 실행한 명령)·`exitCode`·`expected`·`delivered`·`missing`·`stale`·`error`가 들어간다. 결정 근거는 [ADR 0019](../adr/0019-explain-verify-and-agent-skills.md)다.

### `repos list`

이 컴퓨터에서 프로필을 적용한 저장소 목록을 보여 준다. `profile apply`·`profile sync`가 파일을 썼거나 이미 최신이면 저장소의 실제 경로·프로필·고정 여부를 `~/.agctx/repos.json`에 기록한다. dry-run과 확인 거절은 기록하지 않는다.

<!-- agctx:generated:usage:repos.list:start -->
```bash
agctx repos list [--profile <name>] [--prune]
```

종료 코드: `0` 성공 · `64` 사용법 오류 · `70` 기타 오류
<!-- agctx:generated:usage:repos.list:end -->

| 옵션 | 설명 |
| --- | --- |
| `--profile <name>` | 이 프로필을 쓰는 저장소만 보여 줌 |
| `--prune` | 폴더가 없어진 저장소를 목록에서 지움 |

```bash
$ agctx repos list
ok       personal         -      /work/blog
ok       client-a         -      /work/client-a-api
missing  personal         -      /work/notes
Next: some listed folders no longer exist; run agctx repos list --prune to forget them.

$ agctx repos list --prune
Removed 1 missing repository(ies) from the list.
  /work/notes
ok       personal         -      /work/blog
ok       client-a         -      /work/client-a-api
```

목록은 컴퓨터마다 따로 있고 어떤 저장소에도 커밋하지 않는다. `--json`이면 `data.repos`에 `path`·`profile`·`pinned`·`missing`을 담는다.

### `repos status`

목록의 저장소마다 `check`를 실행해 한 줄씩 보여 준다. 파일은 바꾸지 않는다. TUI에서는 **여러 저장소** > **상태 보기**로 실행한다.

<!-- agctx:generated:usage:repos.status:start -->
```bash
agctx repos status [--profile <name>] [--refresh]
```

종료 코드: `0` 성공 · `1` 뒤처짐 · `2` 충돌 · `3` 숨은 문자 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:repos.status:end -->

| 옵션 | 설명 |
| --- | --- |
| `--profile <name>` | 이 프로필을 쓰는 저장소만 확인 |
| `--refresh` | 프로필을 받아 온 원격 저장소의 최신 커밋과도 비교. 같은 저장소·브랜치는 한 번만 조회 |

- **한 줄의 형식:** 왼쪽부터 상태(`ok`·`behind`·`conflict`·`hidden-characters`·`missing`·`error`), 프로필, 고정 여부, `기록한 커밋→새 커밋`, 경로다.
- **종료 코드:** 저장소 가운데 가장 심각한 값을 돌려준다. 폴더가 없어진 저장소(`missing`)는 0으로 친다.
- **다음 명령:** 뒤처진 저장소가 있으면 고정 여부에 맞는 다음 명령을 stderr로 알려 준다. 고정하지 않은 저장소는 `repos sync`, 고정한 저장소는 `profile pull` 뒤 `repos pr`이다.

```bash
$ agctx repos status
behind            personal         -      -               /work/blog
ok                client-a         -      -               /work/client-a-api
behind            personal         -      -               /work/notes
Next: agctx repos sync --profile personal

$ agctx repos status --profile team-backend
behind            team-backend     pinned e086802→19c2988 /work/orders-api
Next: agctx profile pull team-backend, then agctx repos pr --profile team-backend
```

### `repos sync`

고정하지 않은 목록의 저장소를 보관함의 현재 프로필로 한 번에 동기화한다.

<!-- agctx:generated:usage:repos.sync:start -->
```bash
agctx repos sync [--profile <name>] [--dry-run] [--yes]
```

종료 코드: `0` 성공 · `1` 뒤처짐 · `2` 충돌 · `3` 숨은 문자 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:repos.sync:end -->

| 옵션 | 설명 |
| --- | --- |
| `--profile <name>` | 이 프로필을 쓰는 저장소만 동기화 |
| `--dry-run` | 저장소마다 바뀔 파일만 보여 주고 쓰지 않음 |
| `--yes` | 터미널이 아닌 환경에서 동기화를 승인 |

모든 저장소의 계획을 먼저 출력하고, 확인은 한 번만 받은 뒤 쓴다. 아래 표에서 `pinned`·`dirty`·`conflict`·`missing` 상태인 저장소는 건너뛴다. 한 저장소가 실패해도 나머지 저장소는 계속 처리하고, 종료 코드는 모든 저장소 가운데 가장 심각한 값이다.

| 상태 | 뜻 | 종료 코드 |
| --- | --- | --- |
| `update` → `updated` | 바뀔 파일이 있어 동기화함 | 0 |
| `up-to-date` | 바꿀 것이 없음 | 0 |
| `pinned` | 고정한 저장소. `repos pr`로 갱신 | 0 |
| `dirty` | `AGENTS.md`·`CLAUDE.md`·`.agents/rules/agctx.md`·`agctx.project.json`에 커밋하지 않은 변경이 있음 | 1 |
| `conflict` | 관리 영역을 밖에서 고침. `profile resolve`로 해결 | 2 |
| `missing` | 폴더가 없어짐 | 0 |
| `error` | 그 저장소에서 난 오류(숨은 문자 3, 외부 도구 69 등) | 오류의 코드 |

```bash
$ agctx repos sync --profile personal --dry-run
update      /work/blog  2 file(s): AGENTS.md, agctx.project.json
update      /work/notes  2 file(s): AGENTS.md, agctx.project.json
Dry-run: no files were changed.

$ agctx repos sync --profile personal --yes
update      /work/blog  2 file(s): AGENTS.md, agctx.project.json
update      /work/notes  2 file(s): AGENTS.md, agctx.project.json
updated     /work/blog  wrote 2 file(s): AGENTS.md, agctx.project.json
updated     /work/notes  wrote 2 file(s): AGENTS.md, agctx.project.json

$ agctx repos sync --profile team-backend --yes
pinned      /work/orders-api  pinned to e086802; update it with agctx repos pr --profile team-backend
```

바뀐 파일의 커밋은 사람이 한다.

### `repos pr`

프로필이 바뀐 저장소마다 갱신을 새 브랜치에 커밋해 push하고 `gh`로 PR을 연다. 사용자의 작업 폴더·체크아웃·로컬 브랜치는 바꾸지 않는다.

<!-- agctx:generated:usage:repos.pr:start -->
```bash
agctx repos pr [--profile <name>] [--targets <file>] [--base <branch>] [--draft] [--message <text>] [--dry-run] [--yes]
```

종료 코드: `0` 성공 · `2` 충돌 · `3` 숨은 문자 · `64` 사용법 오류 · `69` 외부 도구·네트워크 사용 불가 · `70` 기타 오류
<!-- agctx:generated:usage:repos.pr:end -->

| 옵션 | 설명 |
| --- | --- |
| `--profile <name>` | 이 프로필을 쓰는 저장소만 처리 |
| `--targets <file>` | 저장소 목록 대신 파일의 저장소를 처리. 한 줄에 하나씩 작업 폴더 경로나 clone URL, `#`으로 시작하는 줄은 무시 |
| `--base <branch>` | PR이 향할 브랜치. 생략하면 `origin/HEAD`, 현재 브랜치의 추적 브랜치, 현재 브랜치 순서로 정함 |
| `--draft` | 초안 PR로 엶 |
| `--message <text>` | 커밋 메시지와 PR 제목. 생략하면 `chore(agctx): update <프로필> profile to <커밋 7자리>` |
| `--dry-run` | 열 PR만 보여 주고 아무것도 push하지 않음 |
| `--yes` | 터미널이 아닌 환경에서 push와 PR 생성을 승인 |

- 저장소마다 원격 base 브랜치를 가져와 임시 worktree에 분리된 상태로 체크아웃하고 그곳에서 계획한다. `--targets`의 경로는 대상 파일이 있는 폴더 기준이며, bare 저장소 경로와 URL은 임시 폴더에 clone한다. 임시 작업 공간은 끝나면 지운다.
- 고정한 저장소는 프로필의 현재 커밋으로 다시 고정하고, 고정하지 않은 저장소는 보관함 내용으로 동기화한다. 고정한 저장소는 프로필 보관함에 커밋하지 않은 변경이 없어야 한다.
- 브랜치 이름은 `agctx/<프로필>-<커밋 7자리>`다. 바뀐 것이 없으면 `up-to-date`, 그 브랜치에 열린 PR이 있으면 `pr-exists`, 원격에 그 브랜치가 이미 있으면 `branch-exists`로 끝나고 아무것도 만들지 않는다. 그래서 예약 실행을 반복해도 PR이 쌓이지 않는다.
- 열 PR 목록을 출력한 뒤 한 번 확인하고, 분리된 HEAD에서 커밋해 `git push origin HEAD:refs/heads/<브랜치>`로 올린 다음 `gh pr create`를 실행한다. PR 본문에는 버전 범위·프로필 커밋·바뀐 파일이 들어간다. 성공하면 `opened`와 PR 주소를 보여 준다.
- `gh`가 없거나 인증되지 않았거나 원격이 GitHub가 아니면 push까지 한 상태를 `pushed`로 알리고 PR을 직접 열 방법을 안내한다(원격이 GitHub이면 비교 페이지 주소도 함께). 커밋 작성자는 실행한 환경의 Git 설정(`user.name`·`user.email`)을 따른다.
- 종료 코드는 저장소 가운데 가장 심각한 값이다(`conflict` 2, 그 저장소의 오류 코드).

아래는 로컬 원격을 쓰는 저장소에서 실행한 결과라, `gh`가 PR을 만들지 못하고 push까지 한 경우다.

```bash
$ agctx repos pr --profile team-backend --dry-run
would-open    /work/orders-api  agctx/team-backend-19c2988 into main: 2 file(s)
Dry-run: no files were changed.

$ agctx repos pr --profile team-backend --yes
would-open    /work/orders-api  agctx/team-backend-19c2988 into main: 2 file(s)
pushed        /work/orders-api  pushed agctx/team-backend-19c2988. Open a pull request from agctx/team-backend-19c2988 into main. none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`

$ agctx repos pr --targets targets.txt --profile team-backend --yes
branch-exists /work/remotes/orders-api.git  branch agctx/team-backend-19c2988 already exists on the remote; merge or delete it first
```

`--targets` 파일 예시다.

```text
# repositories that use team-backend
remotes/orders-api.git
../billing-api
git@github.com:acme/payments-api.git
```

### `install`

이 패키지에 든 agctx 스킬을 이 컴퓨터에 있는 에이전트의 사용자 전역 스킬 폴더에 복사한다. 확인 질문 없이 실행한다. TUI에서는 첫 화면의 **에이전트 스킬 설치**로 실행한다.

<!-- agctx:generated:usage:install:start -->
```bash
agctx install [--agent <claude|codex|antigravity|all>] [--force] [--dry-run]
```

종료 코드: `0` 성공 · `64` 사용법 오류 · `70` 기타 오류
<!-- agctx:generated:usage:install:end -->

| 옵션 | 설명 |
| --- | --- |
| `--agent <claude\|codex\|antigravity\|all>` | 이 에이전트에만 둔다. 설정 폴더가 없어도 둔다. `antigravity`는 앱·IDE와 CLI 두 곳, `all`은 네 곳 모두 |
| `--force` | agctx가 두지 않았거나 그 뒤로 바뀐 스킬 폴더도 바꾼다 |
| `--dry-run` | 계획만 출력하고 아무것도 쓰지 않는다 |

- 옵션이 없으면 설정 폴더가 있는 에이전트에만 둔다. Claude Code `~/.claude/skills/`(`~/.claude`), Codex `~/.agents/skills/`(`CODEX_HOME` 또는 `~/.codex`), Antigravity 앱·IDE `~/.gemini/config/skills/`(`~/.gemini/config`), Antigravity CLI `~/.gemini/antigravity-cli/skills/`(`~/.gemini/antigravity-cli`)다. 하나도 찾지 못하면 확인한 폴더를 알리며 64로 멈춘다.
- 스킬 폴더마다 한 줄을 출력한다. `create`는 새로 두고, `update`는 agctx가 둔 폴더를 새 버전으로 바꾸고, `unchanged`는 그대로 두고, `skipped`는 찾지 못한 에이전트다.
- `blocked`는 설치 기록([`.agctx-install.json`](file-formats.md#agctx-installjson))이 없거나 파일이 기록과 다른 폴더, 또는 심볼릭 링크다. 하나라도 있으면 아무것도 쓰지 않고 64로 멈추며 `--force`를 안내한다.
- 이 명령과 `uninstall`을 뺀 모든 명령은, 설치 기록의 버전이 지금 CLI와 다르면 `agctx install`을 다시 실행하라고 stderr에 한 줄로 알린다. `--json`이면 `warnings`에 담는다.
- `--json`의 `data`는 `items`(`target`·`skill`·`dir`·`state`·`reason`), `skipped`(`target`·`dir`·`marker`), `written`이다.

```bash
$ agctx install
create     ~/.claude/skills/agctx
create     ~/.claude/skills/agctx-author
create     ~/.agents/skills/agctx
create     ~/.agents/skills/agctx-author
skipped    ~/.gemini/config/skills  not found: ~/.gemini/config
skipped    ~/.gemini/antigravity-cli/skills  not found: ~/.gemini/antigravity-cli
Installed the agctx skills. Start a new agent session to load them.
```

### `uninstall`

`agctx install`이 둔 agctx 스킬을 지운다. 확인 질문 없이 실행한다. TUI에서는 첫 화면의 **에이전트 스킬 제거**로 실행한다.

<!-- agctx:generated:usage:uninstall:start -->
```bash
agctx uninstall [--agent <claude|codex|antigravity|all>] [--dry-run]
```

종료 코드: `0` 성공 · `64` 사용법 오류 · `70` 기타 오류
<!-- agctx:generated:usage:uninstall:end -->

- 옵션이 없으면 네 곳을 모두 본다. `--agent`는 `install`과 같다.
- 설치 기록과 같은 폴더는 `remove`로 지우고, 기록이 없거나 고친 폴더는 `kept`로 알리고 남긴다. 지울 것이 없으면 그렇다고 알린다.

```bash
$ agctx uninstall
kept       ~/.claude/skills/agctx  changed since agctx install wrote it: SKILL.md
remove     ~/.claude/skills/agctx-author
remove     ~/.agents/skills/agctx
remove     ~/.agents/skills/agctx-author
```

### `config lang`

CLI와 생성 지침의 언어를 저장한다.

<!-- agctx:generated:usage:config.lang:start -->
```bash
agctx config lang <en|ko>
```

종료 코드: `0` 성공 · `64` 사용법 오류 · `70` 기타 오류
<!-- agctx:generated:usage:config.lang:end -->

허용값은 `en`, `ko`이며 기본은 `en`이다. 표시 언어는 아래 순서로 먼저 찾은 값을 쓴다.

1. `--lang` 옵션
2. `AGCTX_LANG` 환경 변수
3. `config lang`으로 저장한 선택
4. 저장한 선택이 없을 때: 터미널에서 대화형으로 처음 실행하면 한 번 물어 저장한다. 터미널이 아니거나 `--json`이면 `en`을 쓴다.

`--lang`과 `AGCTX_LANG`에 허용되지 않는 값을 주면 오류로 끝난다. 저장된 값이 잘못됐으면 무시하고 다음 순서로 넘어간다.

## 저장 위치

프로필·언어 설정·저장소 목록·프로젝트에 생기는 파일의 위치와 형식은 [파일 형식과 저장 위치](file-formats.md)에 있다.

## TUI와 자동화 선택

일반 사용자는 다음처럼 TUI를 사용한다.

```bash
agctx profile create
agctx profile setup
agctx profile remove
```

반복 실행·CI·스크립트에서는 필요한 값을 플래그로 전달하고, 파일을 바꾸는 명령에는 계획을 확인한 뒤 `--yes`를 붙인다.

```bash
agctx profile create company --scope company
agctx profile setup company --tdd on --security on
agctx profile apply company /path/to/project --dry-run
agctx profile apply company /path/to/project --yes
agctx check --refresh /path/to/project --json
agctx explain /path/to/project --json
agctx profile remove company --yes
```

## 관련 문서

- [빠른 시작](../getting-started/quick-start.md)
- [사용 흐름](../README.md#사용-흐름)
- [현재 아키텍처](../contributing/architecture.md)
- [제품 방향](../contributing/product-direction.md)
