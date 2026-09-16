# 문제 해결

<!-- agctx-doc-sources: src/i18n/messages-en.ts, src/profile/apply.ts -->
<!-- agctx-doc-sources-sha256: ea42c9dc68db4e002623591f9b6e353c55293673ac15b2b587771fa5ea6b8a33 -->

agctx의 오류는 `Error:` 줄(무엇이 잘못됐는지)과 `Next:` 줄(바로 실행할 명령)을 함께 출력한다. `Next:` 줄로 풀리지 않을 때 아래를 본다. 종료 코드의 뜻은 [종료 코드](exit-codes.md)에 있다.

## 관리 영역 충돌

`Managed file changed outside agctx`로 멈췄다면 [관리 영역을 고쳐서 멈췄을 때](../concepts/managed-and-extension-areas.md#관리-영역을-고쳐서-멈췄을-때)의 순서로 푼다.

## 그 밖의 오류

- **`command not found: agctx`**: 전역 bin 경로가 PATH에 없을 때다. `npm prefix -g`로 위치를 확인해 PATH에 추가한다.
- **`profile sync requires a project already applied`**: 아직 `apply`하지 않은 프로젝트다. 먼저 `agctx profile apply <name> <project>`를 실행한다.
- **`Profile not found`**: 이름이 틀렸거나 다른 `AGCTX_HOME`을 쓰고 있다. `agctx profile list`로 확인한다.
- **`cannot ask for confirmation here`**: 터미널이 아닌 환경에서 파일을 바꾸는 명령을 `--yes` 없이 실행했다. `--dry-run`으로 계획을 확인한 뒤 `Next:` 줄의 명령을 실행한다.
- **`is not a Git repository yet`**: 로컬 프로필을 원격에 연결하려 했다. `Next:` 줄의 `git init`·`add`·`commit`을 실행한 뒤 다시 `profile connect`한다.
- **`pull`·`push`가 커밋하지 않은 변경으로 멈춤**: 프로필 폴더에서 `git status`로 확인하고 커밋하거나 되돌린 뒤 다시 실행한다.
- **CI의 `check`가 1로 실패**: 프로필 원격에 새 커밋이 있다. `agctx profile pull <name>` 후 고정하지 않은 프로젝트는 `profile sync`, 고정한 프로젝트는 `profile apply <name> <project> --pin`을 실행하고 결과를 커밋한다.
- **`repos sync`가 `dirty`로 건너뜀**: 그 저장소의 관리 파일에 커밋하지 않은 변경이 있다. 커밋하거나 stash한 뒤 다시 실행한다.
- **`repos pr`이 `branch-exists`로 끝남**: 같은 이름의 브랜치가 원격에 남아 있다. PR로 병합하거나, 닫힌 PR의 브랜치라면 지운 뒤 다시 실행한다.
- **`repos pr`이 `pushed`로 끝남**: 브랜치는 올라갔지만 `gh`가 PR을 만들지 못했다. `gh auth status`로 인증을 확인하거나 안내된 브랜치로 PR을 직접 연다.
- **`APM generated AGENTS.md in its default mode`**(종료 코드 2): APM 기본 모드가 만든 파일이다. [APM과 함께 쓰기](../guides/apm-coexistence.md)의 순서로 `managed_section`으로 바꾼 뒤 다시 적용한다.
- **`does not import AGENTS.md` 경고**: 사람이 둔 하위 `CLAUDE.md`가 옆의 `AGENTS.md`를 가져오지 않는다. 그 파일에 `@AGENTS.md`를 더하면 경고가 사라진다.
- **`explain`이 4로 끝남**: `missing` 줄의 파일이 그 에이전트에 닿지 않는다. 줄에 적힌 조치(같은 폴더에 `@AGENTS.md`를 담은 `CLAUDE.md` 두기, 규칙을 `trigger: always_on`으로 바꾸기)를 한 뒤 다시 실행한다.
- **`verify`가 `no-evidence`만 보여 줌**: 그 폴더에서 에이전트를 시작한 기록이 없거나 지침을 읽은 뒤 파일이 바뀌었다. 에이전트를 그 폴더에서 다시 시작하거나 `agctx verify --probe`를 실행한다.
- **`verify --probe`가 69로 끝남**: 에이전트 CLI가 PATH에 없거나 로그인하지 않았다. 터미널에서 그 CLI를 한 번 실행해 로그인한 뒤 다시 실행한다.
- **하위 폴더에서 시작한 Claude Code가 루트 규칙을 따르지 않음**: 루트 `CLAUDE.md`의 `@AGENTS.md`가 시작 폴더 밖 가져오기라 승인이 필요하다. 대화형으로 시작해 승인 창에서 허용하거나 루트에서 시작한다.
- **`Git is not installed`**(종료 코드 69): Git 프로필 명령과 `check --refresh`에는 `git`이 필요하다. 로컬 프로필만 쓰면 `git` 없이 동작한다.
