# 문제 해결

<!-- agctx-doc-sources: src/i18n/messages-en.ts, src/profile/apply.ts -->
<!-- agctx-doc-sources-sha256: 2939d416f93d64539735c4f9f0f4f87987a2af10924df1def12ef08b5e25f784 -->

agctx의 오류는 `Error:` 줄(무엇이 잘못됐는지)과 `Next:` 줄(바로 실행할 명령)을 함께 출력한다. `Next:` 줄로 풀리지 않을 때 아래를 본다. 종료 코드의 뜻은 [종료 코드](exit-codes.md)에 있다.

## 관리 영역 충돌

`Managed file changed outside agctx`로 멈췄다면 [관리 영역을 고쳐서 멈췄을 때](../concepts/managed-and-extension-areas.md#관리-영역을-고쳐서-멈췄을-때)의 순서로 푼다.

## 그 밖의 오류

- **TUI에서 적용·동기화·PR 열기 등을 골랐는데 `Nothing was changed.`만 나옴**: 파일을 쓰거나 원격으로 보내거나 에이전트를 실행하는 확인 질문은 No가 기본으로 선택되어 있다. `←`로 **Yes**를 고른 뒤 `Enter`를 누른다([TUI로 쓰기](../guides/tui.md#조작-방법)).
- **`command not found: agctx`**: 전역 bin 경로가 PATH에 없을 때다. `npm prefix -g`로 위치를 확인해 PATH에 추가한다.
- **`profile sync requires a project already applied`**: 아직 `apply`하지 않은 프로젝트다. 먼저 `agctx profile apply <name> <project>`를 실행한다.
- **`Profile not found`**: 이름이 틀렸거나 다른 `AGCTX_HOME`을 쓰고 있다. `agctx profile list`로 확인한다.
- **`cannot ask for confirmation here`**: 터미널이 아닌 환경에서 파일을 바꾸는 명령을 `--yes` 없이 실행했다. `--dry-run`으로 계획을 확인한 뒤 `Next:` 줄의 명령을 실행한다.
- **`is not a Git repository yet`**: 로컬 프로필을 원격에 연결하려 했다. `Next:` 줄의 `git init`·`add`·`commit`을 실행한 뒤 다시 `profile connect`한다.
- **`has uncommitted changes, so a project cannot be pinned to a commit`**(종료 코드 64): 프로필의 `AGENTS.md`나 `profile.json`에 커밋하지 않은 수정이 있어 고정할 커밋을 정할 수 없다. `Next:` 줄에 적힌 프로필 폴더에서 수정을 커밋하거나 되돌린 뒤 다시 적용한다. TUI에서 고정 질문에 **Yes**를 골랐을 때도 같은 오류가 나고 파일은 바뀌지 않는다.
- **`is not a Git repository, so a project cannot be pinned to it`**(종료 코드 64): Git 저장소가 아닌 로컬 프로필은 고정할 수 없다. 프로필 폴더에서 `git init`과 첫 커밋을 만든 뒤 다시 `--pin`으로 적용한다. 팀과 나눠 쓸 프로필이면 `Next:` 줄의 `profile connect`로 원격에도 연결한다([팀과 Git으로 공유하기](../guides/team-sharing.md)).
- **`does not have the pinned commit`**(종료 코드 69): 저장소가 고정한 커밋이 이 컴퓨터의 프로필 보관함에 없다. 다른 사람이 더 새 커밋으로 고정해 올린 저장소를 받았는데 아직 `profile pull`을 하지 않았을 때 생긴다. `agctx profile pull <name>`으로 받은 뒤 다시 실행한다.
- **`pull`·`push`가 커밋하지 않은 변경으로 멈춤**: 프로필 폴더에서 `git status`로 확인하고 커밋하거나 되돌린 뒤 다시 실행한다.
- **CI의 `check --refresh`가 1로 실패**: 저장소가 기록한 커밋보다 새 커밋이 프로필 원격에 있다. 적용 담당이 자기 컴퓨터에서 `agctx profile pull <name>`으로 받은 뒤, 고정하지 않은 프로젝트는 `profile sync <project>`, 고정한 프로젝트는 `profile apply <name> <project> --pin`을 실행하고 바뀐 파일을 커밋해 올린다. 고정한 저장소가 여럿이면 `repos pr`로 저장소마다 PR을 연다([갱신 방식 고르기](../guides/update-policies.md)).
- **`repos sync`가 `dirty`로 건너뜀**: 그 저장소에서 agctx가 관리하는 파일(`AGENTS.md`·`CLAUDE.md` 등)에 커밋하지 않은 변경이 있다. 동기화가 그 변경을 덮지 않도록 건너뛴 것이다. 커밋하거나 `git stash`로 치운 뒤 다시 실행한다.
- **`repos pr`이 `branch-exists`로 끝남**: 같은 이름의 브랜치가 원격에 남아 있다. PR로 병합하거나, 닫힌 PR의 브랜치라면 지운 뒤 다시 실행한다.
- **`repos pr`이 `pushed`로 끝남**: 브랜치는 올라갔지만 `gh`가 PR을 만들지 못했다. `gh auth status`로 인증을 확인하거나 안내된 브랜치로 PR을 직접 연다.
- **`APM generated AGENTS.md in its default mode`**(종료 코드 2): APM 기본 모드가 만든 파일이다. [APM과 함께 쓰기](../guides/apm-coexistence.md)의 순서로 `managed_section`으로 바꾼 뒤 다시 적용한다.
- **`does not import AGENTS.md` 경고**: 사람이 둔 하위 `CLAUDE.md`가 옆의 `AGENTS.md`를 가져오지 않는다. 그 파일에 `@AGENTS.md`를 더하면 경고가 사라진다.
- **`explain`이 4로 끝남**: `missing` 줄의 파일이 그 에이전트에 닿지 않는다. 줄에 적힌 조치(같은 폴더에 `@AGENTS.md`를 담은 `CLAUDE.md` 두기, 규칙을 `trigger: always_on`으로 바꾸기)를 한 뒤 다시 실행한다.
- **`verify`가 `no-evidence`만 보여 줌**: 그 폴더에서 에이전트를 시작한 세션 기록이 없거나, 에이전트가 지침을 읽은 뒤에 지침 파일이 바뀌어 그 기록을 증거로 쓸 수 없다. Antigravity는 기록을 읽지 못해 항상 `no-evidence`다. 에이전트를 그 폴더에서 다시 시작하거나 `agctx verify --probe`를 실행한다.
- **`verify --probe`가 69로 끝남**: 에이전트 CLI가 PATH에 없거나 로그인하지 않았다. 터미널에서 그 CLI를 한 번 실행해 로그인한 뒤 다시 실행한다.
- **하위 폴더에서 시작한 Claude Code가 루트 규칙을 따르지 않음**: 하위 폴더에서 시작하면 루트 `CLAUDE.md`가 `@AGENTS.md`로 가져오는 루트 `AGENTS.md`는 시작 폴더 밖의 파일이 된다. Claude Code는 이런 가져오기를 사용자가 승인해야 읽는다. 그 프로젝트를 대화형으로 시작해 승인 창에서 허용하거나, 저장소 루트에서 시작한다.
- **`Git is not installed`**(종료 코드 69): Git 프로필 명령과 `check --refresh`에는 `git`이 필요하다. 로컬 프로필만 쓰면 `git` 없이 동작한다.
