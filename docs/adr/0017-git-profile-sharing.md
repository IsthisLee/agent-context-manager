# 0017. 프로필을 Git 원격으로 공유하고 적용한 버전을 기록한다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-15
* **결정자:** 제품 소유자
* **근거:** [CLI 계약과 지침 공급망 근거](../references.md#cli-계약과-지침-공급망-근거)
* **관련:** [Git 기반 프로필 관리](../discussion/architecture/topics/git-profile-management.md)의 제안을 구현한다. 종료 코드와 확인 규칙은 [ADR 0016](0016-command-contract.md)을 따른다.

## 배경 (Context)

- 프로필이 한 컴퓨터의 `~/.agctx/profiles/`에만 있어서 팀이 같은 지침을 공유하거나 변경 이력을 함께 검토할 수 없었다.
- 프로젝트에 어떤 버전의 프로필이 적용됐는지 기록이 없었다. 그래서 CI나 다른 팀원이 저장소가 최신 지침을 반영했는지 확인할 수 없었다.
- 받은 프로필의 `AGENTS.md`는 에이전트의 행동을 바꾼다. 사람이 리뷰 화면에서 보지 못하는 문자(양방향 제어 문자, 태그 문자)로 지시를 숨길 수 있다.
- 여러 팀이 한 프로필을 쓰면 공유 프로필이 바뀌는 대로 따라가려는 팀과, 검토한 버전에 머물다가 PR로 옮기려는 팀이 함께 있다.

## 검토한 대안 (Options)

| 항목 | 대안 | 판단 |
| --- | --- | --- |
| 공유 수단 | agctx 전용 레지스트리·서버 | 인증·권한·이력을 새로 만들어야 한다 |
| | npm 패키지로 프로필 배포 | 지침 한 줄을 고칠 때마다 게시해야 하고 조직 비공개 배포 설정이 늘어난다 |
| | 표준 Git 원격과 사용자의 Git 인증 | **채택.** 권한·리뷰·이력을 Git 호스트가 이미 제공한다 |
| 갱신 방식 | 항상 보관함의 최신 프로필을 따른다 | 검토한 버전에 머물 수 없다 |
| | 항상 커밋에 고정한다 | 개인 사용자도 프로필을 고칠 때마다 다시 고정해야 한다 |
| | 기본은 고정하지 않고 `--pin`을 주면 고정한다 | **채택** |
| 적용 버전 기록 | 제안의 `profileRevision { kind, remote, branch, commit }` | 로컬 프로필은 기록하지 않으므로 `kind`가 필요 없다 |
| | `source { git, branch, commit }`와 `pin`·`uncommitted` | **채택** |
| clone한 프로필 이름 | `--name`으로 새 이름을 준다 | 팀원마다 이름이 달라지면 저장소에 기록한 `profile`과 맞지 않는다 |
| | `profile.json`의 이름을 쓴다 | **채택.** 같은 이름이 이미 있으면 64로 멈춘다 |
| 커밋하지 않은 변경이 있을 때 push | `--allow-dirty`로 허용한다 | 무엇이 빠졌는지 모른 채 보내기 쉽다 |
| | 멈추고 빠지는 파일을 보여 준다 | **채택** |

## 결정 (Decision)

1. **명령:** `profile clone <git-url> [--branch <branch>]`, `profile status [<name>] [--refresh]`, `profile pull <name> [--dry-run]`, `profile push <name> [--dry-run] [--yes]`, `profile connect <name> <git-url> [--branch <branch>]`를 둔다. 다섯 명령은 프로젝트 파일을 읽거나 쓰지 않는다. 등록부에서 `profile` 표면이므로 CLI·TUI·프로필 관리 메뉴에서 실행한다.
2. **Git 실행:** 셸을 거치지 않고 인자를 나눠 `git`을 실행하며 사용자의 Git 설정과 인증을 그대로 쓴다. 터미널이 아니면 `GIT_TERMINAL_PROMPT=0`으로 인증 질문을 막는다. `git`이 없거나 원격 접근·인증이 실패하면 69로 끝낸다.
3. **clone:** 프로필 폴더 안의 임시 경로에 `git clone --no-recurse-submodules`로 받는다. `profile.json`과 `AGENTS.md`를 검증하고 숨은 문자를 검사한 뒤에만 이름을 바꿔 등록한다. 저장소 하나에 프로필 하나를 둔다.
4. **status·pull·push·connect:** `status`는 기본적으로 네트워크에 접속하지 않고 `--refresh`일 때만 fetch한다. `pull`은 커밋하지 않은 변경이 있거나 갈라졌으면 2로 멈추고, 들어올 `profile.json`·`AGENTS.md`를 먼저 검사한 뒤 fast-forward만 한다. `push`는 이미 만든 커밋만 보내고, 커밋하지 않은 변경이 있거나 원격보다 뒤처졌으면 2로 멈춘다. `connect`는 Git 저장소가 아닌 프로필이면 `git init`과 첫 커밋 명령을 안내하고 멈춘다. agctx는 stage·commit을 하지 않는다.
5. **숨은 문자:** U+202A–U+202E, U+2066–U+2069, U+200B–U+200D, U+2060, 파일 맨 앞이 아닌 U+FEFF, U+E0000–U+E007F, U+E0100–U+E01EF를 `파일:줄:열 U+XXXX 종류` 형식으로 보고하고 3으로 멈춘다. clone·pull로 받을 프로필, apply·sync가 쓸 프로필 내용, `check`가 읽는 관리 파일에 적용한다.
6. **버전 기록:** `apply`·`sync`는 `agctx.project.json`(`schemaVersion` 2)에 `source { git, branch, commit }`를 기록한다. `git` URL에서는 사용자 정보와 토큰을 지운다. 커밋하지 않은 프로필 수정이 섞였으면 `uncommitted: true`를 적는다. Git 저장소가 아닌 프로필은 `source`를 기록하지 않는다.
7. **고정:** `profile apply --pin`은 프로필에 커밋하지 않은 변경이 없을 때만 HEAD 커밋에 고정하고 `pin: true`를 기록한다. 고정한 프로젝트의 `sync`는 기록한 커밋의 `AGENTS.md`(`git show <commit>:AGENTS.md`)로 다시 만들고, 그 커밋이 로컬에 없으면 69와 `profile pull` 안내로 멈춘다. 새 버전으로 옮기려면 `apply --pin`을 다시 실행한다. 고정한 프로젝트에 `--pin` 없이 `apply`하면 고정이 풀린다고 경고한다.
8. **check:** `agctx check [<project>] [--refresh]`는 관리 파일이 없거나 관리 영역이 바뀌었으면 2, 관리 파일에 숨은 문자가 있으면 3, `uncommitted: true`면 결과를 재현할 수 없으므로 1을 돌려준다. 프로필이 보관함에 있으면 기록한 버전으로 다시 만든 결과와 비교해 다르면 1이다. 보관함이 없는 CI에서는 `--refresh`를 주면 `git ls-remote`로 원천 브랜치에 더 새로운 커밋이 있는지 보고 있으면 1이다. 파일을 바꾸지 않으며 `repository` 표면이므로 CLI만 제공한다.

## 결과 및 영향 (Consequences)

- 팀은 Git 호스트의 권한·리뷰로 프로필을 관리하고 구성원은 `clone`·`pull`로 받는다. CI는 프로필 보관함 없이 `check --refresh`로 저장소가 뒤처졌는지 확인한다.
- `agctx.project.json`이 `schemaVersion` 2가 된다. 1로 기록된 프로젝트도 그대로 읽고 다음 `apply`·`sync`에서 2로 기록한다.
- 로컬 프로필은 이전처럼 `git` 없이 동작한다. 프로필 폴더에 `.git`이 없으면 `git`을 실행하지 않는다.
- 평가: `evals/git-profile.test.ts`(bare 원격과 관리자·구성원 두 홈으로 clone·status·pull·push·`apply --pin`·`check --refresh`, 고정한 프로젝트의 `sync`, 로컬 수정이 있을 때 pull 중단), `evals/hidden-chars.test.ts`, `evals/command-contract.test.ts`의 `check` 시나리오.
- 한계:
  - Git 작업에 잠금 파일이 없다. 같은 프로필에 두 명령을 동시에 실행하면 Git의 오류가 그대로 나온다.
  - 네트워크 제한 시간을 두지 않는다. `GIT_TERMINAL_PROMPT=0`은 인증 질문에서 멈추는 것만 막는다.
  - 저장소 하나에 프로필 하나만 받는다.
  - 숨은 문자 검사는 프로필의 `profile.json`과 `AGENTS.md`만 대상으로 한다. 프로필 저장소의 다른 파일은 agctx가 프로젝트로 전달하지 않기 때문이다.
  - 여러 저장소를 한 번에 갱신하는 명령과 PR 자동화는 후속 단계에서 다룬다.
