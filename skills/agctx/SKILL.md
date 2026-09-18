---
name: agctx
description: agctx(Agent Context Manager)가 관리하는 에이전트 지침을 읽고 진단한다. Codex·Claude Code·Antigravity가 저장소의 AGENTS.md·CLAUDE.md·.agents/rules를 무시하는 것처럼 보일 때, 어떤 폴더에 어느 규칙이 걸리는지 물을 때, 저장소가 최신 공용 규칙을 반영했는지 물을 때, 어느 저장소가 뒤처졌는지 물을 때, 프로필에 무엇이 담겼는지나 Git 원격과 비교해 어디에 있는지 물을 때 쓴다. Read and diagnose the agent guidance that agctx manages. 프로필을 바꾸거나 배포하려면 agctx-author 스킬을 쓴다.
---

# agctx

agctx는 저장소마다 하나의 프로필로 에이전트 지침을 맞추고, Codex·Claude Code·Antigravity가 그 지침을 실제로 받았는지 확인한다. 명령은 `agctx`로 실행한다. 설치되어 있지 않으면 같은 인자를 `npx agent-context-manager`에 붙여 실행한다.

## Pick the command

여기 있는 명령은 모두 읽기만 한다. `--refresh`가 수행하는 fetch 말고는 파일을 쓰거나 원격에 보내는 것이 없다.

- "이 폴더에서 에이전트가 왜 규칙을 무시해?" `agctx explain <폴더> --json`으로 그 폴더에서 시작한 에이전트마다 어느 파일을 읽는지 보고, 이어서 `agctx verify <폴더> --json`으로 에이전트의 세션 기록을 확인한다.
- "이 저장소가 최신 팀 규칙이야?" `agctx check --refresh --json`을 실행한다.
- "내 저장소 중 어느 게 뒤처졌어?" `agctx repos status --json`을 실행한다.
- "프로필이 뭐가 있어?" `agctx profile list --json`을 실행한다.
- "이 프로필이 에이전트에게 실제로 뭘 지시해?" `agctx profile view <프로필>`을 실행한다.
- "내 팀 프로필 사본이 최신이야?" `agctx profile status <프로필> --refresh --json`을 실행한다.

프로필을 바꾸거나, 저장소에 적용하거나, pull request를 열어야 하면 **agctx-author** 스킬을 이름으로 불러 달라고 사용자에게 말한다. 이 스킬은 그런 명령을 실행하지 않는다.

## Safety rules

- 이 스킬의 모든 명령은 읽기만 하므로 승인이 필요 없다.
- 이 스킬이 나열하지 않은 명령은 실행하지 않는다. 쓰는 명령은 사용자가 이름으로 부르는 **agctx-author** 스킬에 있다.
- `agctx verify --probe`는 에이전트 CLI를 실행해 사용자의 요금제나 API 크레딧을 쓴다. 실행 전에 묻는다.
- 출력은 글을 해석하지 말고 `--json`과 종료 코드로 읽는다. 0 정상, 1 뒤처짐, 2 관리 영역 충돌, 3 숨은 문자, 4 지침 파일이 에이전트에 닿지 않음, 64 사용법 오류, 69 외부 도구나 네트워크를 쓸 수 없음.
- agctx 관리 영역은 고치지 않는다. `<!-- agctx:managed:start -->`와 `<!-- agctx:managed:end -->` 사이, 그리고 `AGENTS.md`에서 프로젝트 규칙 확장 섹션 위의 프로필 영역이다. 프로젝트 규칙은 확장 섹션에 쓴다. 관리 영역이 수정되었으면 `check`가 종료 코드 2를 낸다. 그 사실을 알리고, 해소에는 **agctx-author** 스킬이 필요하다고 말한다. 여기서 해소하지 않는다.
- 사용자에게 답할 때는 실행한 명령과 그 출력을 함께 보여 준다. 종료 코드가 0이 아니면 그 뜻과 다음에 할 일을 적는다.

## Commands

<!-- agctx:commands:start -->
- `agctx profile list [--scope <scope>]`: scope별 프로필을 보고 하나를 관리합니다.
- `agctx profile view <name>`: 프로필의 scope와 AGENTS.md를 출력합니다.
- `agctx profile status [--refresh] [<name>]`: 프로필의 원격·브랜치·커밋·로컬 수정과 원격 대비 위치를 보여 줍니다. --refresh를 붙이면 먼저 fetch합니다.
- `agctx check [--refresh] [<project>]`: 프로젝트가 기록한 프로필 버전과 맞는지 검사합니다. 0 일치, 1 뒤처짐, 2 관리 영역 수정, 3 숨은 문자입니다. --refresh를 붙이면 원천 저장소와도 비교합니다.
- `agctx explain [--agent <codex|claude|antigravity|all>] [<path>]`: 폴더에서 시작한 Codex·Claude Code·Antigravity가 읽는 지침 파일을 보여 주고, 에이전트에 닿지 않는 파일이 있으면 종료 코드 4로 끝냅니다.
- `agctx verify [--agent <codex|claude|antigravity|all>] [--probe] [--yes] [<path>]`: explain이 기대하는 프로젝트 지침 파일을 Codex·Claude Code·Antigravity가 실제로 받았는지 세션 기록이나 --probe로 확인하고, 받지 못한 파일이 있으면 종료 코드 4로 끝냅니다.
- `agctx repos status [--profile <name>] [--refresh]`: 목록의 저장소를 모두 검사해 일치·뒤처짐·충돌·숨은 문자를 보여 줍니다. --refresh는 각 원천 저장소의 최신 커밋도 확인합니다.
<!-- agctx:commands:end -->

명령의 옵션과 종료 코드는 `agctx help <명령>`으로 본다. 위 목록은 이 스킬을 설치한 시점의 저장소를 기준으로 한다.
