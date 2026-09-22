---
name: agctx-author
description: agctx 프로필을 만들고 바꾸고 배포한다. 새 프로필 만들기, 담을 지침 고르기, 저장소에 적용하기, Git에 연결해 받고 보내기, 관리 영역 충돌 해소하기, 그 프로필을 쓰는 저장소마다 pull request 열기를 다룬다. Create, change, and roll out an agctx profile. 사용자가 이 가운데 하나를 명시적으로 요청할 때만 쓴다.
disable-model-invocation: true
---

# agctx-author

이 스킬은 여러 저장소와 팀원이 받는 내용을 바꾸므로, 모든 push와 모든 pull request는 이 대화에서 사용자의 승인을 받아야 한다. 명령은 `agctx`로 실행하고, 설치되어 있지 않으면 `npx agent-context-manager`에 같은 인자를 붙인다.

## Pick the command

이 절의 모든 명령은 파일을 쓰거나 프로필 보관함을 바꾸거나 원격에 보낸다. `--dry-run`을 받는 명령은 먼저 그것으로 실행해 결과를 보여 주고, 사용자가 이 대화에서 승인한 뒤에만 `--yes`를 붙인다.

- "컨텍스트 프로필 만들어 줘." `agctx profile create <이름> --scope <scope>`를 실행하고, 이어서 지침 열 개 가운데 무엇을 켤지 사용자에게 물어 `agctx profile setup <이름> --<항목> on|off`를 실행한다. 항목을 대신 고르지 않는다.
- "이 저장소에 이 프로필 적용해 줘." `agctx profile apply <프로필> <프로젝트> --dry-run`으로 계획을 보여 준 뒤 `--yes`를 붙인다. 저장소를 지금 프로필 커밋에 고정하려면 `--pin`을 더한다.
- "이 저장소를 새 규칙으로 맞춰 줘." 프로필이 뒤처졌으면 `agctx profile pull <프로필>`을 먼저 실행하고, `agctx profile sync <프로젝트> --dry-run` 다음에 `--yes`를 붙인다.
- "누가 관리 영역을 고쳤어." `agctx profile resolve <프로젝트> --dry-run`을 실행하고 어떻게 해소할지 사용자에게 묻는다. `--discard`는 백업한 뒤 수정을 버리고, `--edit`은 병합 화면을 연다.
- "팀 프로필을 이 컴퓨터로 받아 줘." `agctx profile clone <git-url>`을 실행한다. 이미 있는 로컬 프로필을 원격에 연결하려면 `agctx profile connect <프로필> <git-url>`을 쓴다.
- "이미 쓰던 규칙 저장소를 프로필로 써 줘." 그 저장소 폴더를 넘겨 `agctx profile link <폴더> --dry-run`으로 계획을 보여 준 뒤 `--yes`를 붙인다. AGENTS.md가 여러 개라 멈추면 어느 파일이 규칙인지 사용자에게 물어 `--instructions <경로>`로 넘긴다. 이 명령은 커밋하지 않으므로, 팀과 나누려면 사용자가 그 폴더에서 `profile.json`을 커밋해 올려야 한다고 알린다.
- "내 프로필 변경을 배포해 줘." 아래 절차를 따라 `agctx profile push <프로필>`을 실행한다.
- "모든 저장소에 반영해 줘." `agctx repos list`로 등록된 저장소를 보고, 고정하지 않은 저장소에는 `agctx repos sync --profile <프로필>`, 고정한 저장소에는 `agctx repos pr --profile <프로필>`을 쓴다.

## Steps

1. 프로필과 바꿀 내용을 사용자와 확인한다. `agctx profile view <프로필>`과 `agctx profile status <프로필> --refresh`로 상태를 본다. 프로필이 원격보다 뒤처졌으면 `agctx profile pull <프로필>`을 먼저 실행한다.
2. 지침을 바꾼다. 기본 항목은 `agctx profile setup <프로필> --<항목> on|off`로, 그 밖의 내용은 프로필 폴더의 `AGENTS.md`에서 `agctx:guidance` 블록 밖에 직접 쓴다.
3. `git -C <프로필 폴더> diff`를 사용자에게 보여 준다. 사용자가 diff와 커밋 메시지를 승인한 뒤에만 `git -C <프로필 폴더> commit`으로 커밋한다. agctx는 대신 커밋하지 않는다.
4. `agctx profile push <프로필> --dry-run`으로 보낼 커밋을 보여 주고, 사용자가 승인하면 `agctx profile push <프로필> --yes`를 실행한다.
5. 배포한다. `agctx repos status --profile <프로필>`로 어느 저장소가 뒤처졌는지 본다. 고정한 저장소에는 `agctx repos pr --profile <프로필> --dry-run`으로 브랜치를 보여 준 뒤 승인받아 `--yes`로 실행한다. 고정하지 않은 저장소에는 사용자가 `agctx repos sync --profile <프로필> --dry-run` 다음 `--yes`를 택할 수 있다.

## Safety rules

- 바로 앞에 보여 준 dry-run 출력을 사용자가 승인하지 않았으면 `--yes`를 붙이지 않는다. Never add `--yes` on your own.
- force-push, 프로필 저장소 이력 다시 쓰기, 원격 브랜치 삭제는 하지 않는다.
- 프로필이 뒤처졌거나 커밋하지 않은 변경이 있어서 `profile push`가 멈추면 그 사실을 알리고 묻는다. reset으로 풀지 않는다.
- `repos pr`은 임시 worktree에서 동작하며 사용자의 작업 사본을 바꾸지 않는다. 어느 저장소에 pull request가 열렸고 어느 저장소는 브랜치만 push됐는지 알린다.
- 출력은 `--json`과 종료 코드로 읽는다. 0 정상, 1 뒤처짐, 2 관리 영역 충돌, 3 숨은 문자, 4 지침 파일이 에이전트에 닿지 않음, 64 사용법 오류, 69 외부 도구나 네트워크를 쓸 수 없음.

## Commands

<!-- agctx:commands:start -->
- `agctx profile create [--scope <scope>] [<name>]`: 초기 AGENTS.md가 있는 프로필을 만듭니다.
- `agctx profile list [--scope <scope>]`: scope별 프로필을 보고 하나를 관리합니다.
- `agctx profile view <name>`: 프로필의 scope와 규칙 파일(profile.json이 다른 파일을 가리키지 않으면 AGENTS.md)을 출력합니다.
- `agctx profile setup [--workflow <on|off>] [--context <on|off>] [--tdd <on|off>] [--review <on|off>] [--verification <on|off>] [--instructions <on|off>] [--docs <on|off>] [--security <on|off>] [--untrusted <on|off>] [--language <on|off>] [<name>]`: 프로필에 담을 지침 항목을 켜고 끕니다.
- `agctx profile apply [--dry-run] [--pin] [--yes] <name> [<project>]`: 프로필을 프로젝트에 적용해 에이전트 파일을 만들고 프로필 버전을 기록합니다. --pin은 다시 적용할 때까지 프로젝트를 지금 커밋에 고정합니다.
- `agctx profile sync [--dry-run] [--yes] [<project>]`: 프로젝트가 쓰는 프로필을 다시 적용합니다. 고정한 프로젝트는 기록한 커밋에 머뭅니다.
- `agctx profile resolve [--dry-run] [--discard] [--edit] [--yes] [<project>]`: 관리 영역 안에서 고친 내용을 밖으로 옮기고 관리 영역을 다시 만듭니다.
- `agctx profile clone [--branch <branch>] <git-url>`: 파일과 숨은 문자를 검사한 뒤 Git 저장소에서 프로필을 가져옵니다.
- `agctx profile link [--name <name>] [--scope <scope>] [--instructions <file>] [--dry-run] [--yes] [<path>]`: 이 컴퓨터에 있는 규칙 저장소 폴더를 프로필로 연결합니다. profile.json이 없으면 만들고, 커밋은 하지 않습니다.
- `agctx profile status [--refresh] [<name>]`: 프로필의 원격·브랜치·커밋·로컬 수정과 원격 대비 위치를 보여 줍니다. --refresh를 붙이면 먼저 fetch합니다.
- `agctx profile pull [--dry-run] <name>`: 프로필을 원격까지 fast-forward합니다. 저장소 파일은 바뀌지 않습니다.
- `agctx profile push [--dry-run] [--yes] <name>`: 이미 만든 커밋을 프로필의 원격으로 보냅니다.
- `agctx profile connect [--branch <branch>] <name> <git-url>`: 이미 Git 저장소인 프로필을 원격에 연결합니다. 커밋이나 push는 하지 않습니다.
- `agctx check [--refresh] [<project>]`: 프로젝트가 기록한 프로필 버전과 맞는지 검사합니다. 0 일치, 1 뒤처짐, 2 관리 영역 수정, 3 숨은 문자입니다. --refresh를 붙이면 원천 저장소와도 비교합니다.
- `agctx explain [--agent <codex|claude|antigravity|all>] [<path>]`: 폴더에서 시작한 Codex·Claude Code·Antigravity가 읽는 지침 파일을 보여 주고, 에이전트에 닿지 않는 파일이 있으면 종료 코드 4로 끝냅니다.
- `agctx verify [--agent <codex|claude|antigravity|all>] [--probe] [--yes] [<path>]`: explain이 기대하는 프로젝트 지침 파일을 Codex·Claude Code·Antigravity가 실제로 받았는지 세션 기록이나 --probe로 확인하고, 받지 못한 파일이 있으면 종료 코드 4로 끝냅니다.
- `agctx repos list [--profile <name>] [--prune]`: 이 컴퓨터에서 프로필을 적용한 저장소 목록을 보여 줍니다. --prune은 없어진 폴더를 목록에서 지웁니다.
- `agctx repos status [--profile <name>] [--refresh]`: 목록의 저장소를 모두 검사해 일치·뒤처짐·충돌·숨은 문자를 보여 줍니다. --refresh는 각 원천 저장소의 최신 커밋도 확인합니다.
- `agctx repos sync [--profile <name>] [--dry-run] [--yes]`: 고정하지 않은 목록의 저장소를 바뀔 내용을 보여 준 뒤 한 번에 동기화합니다. 관리 파일에 커밋하지 않은 변경이 있는 저장소는 건너뜁니다.
- `agctx repos pr [--profile <name>] [--targets <file>] [--base <branch>] [--draft] [--message <text>] [--dry-run] [--yes]`: 프로필이 바뀐 저장소마다 임시 worktree에서 새 브랜치에 커밋하고 push한 뒤 gh로 PR을 엽니다. --targets는 파일에서 경로나 clone URL을 읽습니다.
<!-- agctx:commands:end -->

명령의 옵션과 종료 코드는 `agctx help <명령>`으로 본다. 위 목록은 이 스킬을 설치한 시점의 저장소를 기준으로 한다.
