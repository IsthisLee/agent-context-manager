# 0018. 적용한 저장소를 목록으로 관리하고 동기화·PR을 한 번에 확인한 뒤 실행한다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-15
* **결정자:** 제품 소유자
* **근거:** [CLI 계약과 지침 공급망 근거](../references.md#cli-계약과-지침-공급망-근거)의 GitHub CLI·`git worktree` 항목
* **관련:** 종료 코드와 확인은 [ADR 0016](0016-command-contract.md), 적용 버전 기록과 고정은 [ADR 0017](0017-git-profile-sharing.md)을 따른다. [Git 기반 프로필 관리](../discussion/architecture/topics/git-profile-management.md)가 비범위로 둔 "프로필 변경을 감지한 자동 PR 생성"은 여전히 하지 않고, 사람이나 예약 봇이 명시적으로 실행하는 명령으로 제공한다.

## 배경 (Context)

- 공유 프로필이 바뀌면 그 프로필을 쓰는 저장소를 하나씩 열어 `profile sync`하거나 PR을 만들어야 했다. 고객사가 여럿이거나 서비스 저장소가 수십 개인 팀은 어느 저장소가 뒤처졌는지 알기도 어려웠다.
- 고정한 저장소는 설계상 `sync`로 바뀌지 않는다. 새 버전을 들이려면 저장소마다 브랜치를 만들고 `apply --pin`·커밋·push·PR을 반복해야 했다.
- `AGENTS.md`의 프로젝트 이름을 폴더 이름으로 정했기 때문에, 팀원이 저장소를 다른 이름의 폴더로 clone하면 `sync`가 파일을 바꾸고 `check`가 뒤처짐으로 판정했다. 임시 폴더에서 렌더링하는 PR 작업도 같은 이유로 매번 파일을 바꾸게 된다.

## 검토한 대안 (Options)

| 항목 | 대안 | 판단 |
| --- | --- | --- |
| 저장소 찾기 | 디스크를 뒤져 `agctx.project.json`을 찾는다 | 느리고 사용자가 모르는 폴더까지 다룬다 |
| | `apply`·`sync`가 기록한 목록(`repos.json`)을 쓴다 | **채택.** 사용자가 직접 적용한 저장소만 다룬다 |
| | 목록 파일만 받는다 | 개인 사용자가 파일을 따로 관리해야 한다. 봇을 위해 `--targets`로 함께 제공한다 |
| PR 작업 위치 | 사용자 작업 폴더에서 브랜치를 바꿔 커밋한다 | 진행 중인 작업과 섞이고 체크아웃이 바뀐다 |
| | 임시 worktree(URL 대상은 임시 clone)에서 커밋한다 | **채택.** 사용자 폴더·체크아웃·로컬 브랜치를 건드리지 않는다 |
| PR 만들기 | GitHub API를 직접 호출한다 | 토큰을 따로 받아 관리해야 한다 |
| | `gh`를 실행한다 | **채택.** 사용자의 gh 인증을 쓰고, 쓸 수 없으면 push까지 하고 안내한다 |
| 확인 | 저장소마다 묻는다 | 저장소가 수십 개면 쓸 수 없다 |
| | 계획을 모두 보여 준 뒤 한 번 묻고, 터미널이 아니면 `--yes`를 요구한다 | **채택** |
| 프로젝트 이름 | 폴더 이름 | 폴더가 달라지면 결과가 달라진다 |
| | `package.json`의 `name` → 기록한 `projectName` → 폴더 이름 | **채택** |

## 결정 (Decision)

1. **목록:** `$AGCTX_HOME/repos.json`에 저장소의 실제 경로·프로필·고정 여부를 둔다. `profile apply`·`sync`가 파일을 썼거나 이미 최신일 때 기록하고, dry-run과 확인 거절은 기록하지 않는다. 목록을 쓰지 못해도 적용은 성공으로 끝나고 경고만 남긴다. `agctx repos list [--profile <name>] [--prune]`으로 보고, `--prune`은 폴더가 없어진 항목만 지운다.
2. **상태:** `agctx repos status [--profile <name>] [--refresh]`는 저장소마다 `check`를 실행하고 가장 심각한 종료 코드를 돌려준다. 폴더가 없으면 `missing`(0)과 `--prune` 안내를 낸다. `--refresh`의 원격 조회는 원천과 브랜치 쌍마다 한 번만 한다.
3. **동기화:** `agctx repos sync [--profile <name>] [--dry-run] [--yes]`는 고정한 저장소(`pinned`, 0), 관리 파일(`AGENTS.md`·`CLAUDE.md`·`.agents/rules/agctx.md`·`agctx.project.json`)에 커밋하지 않은 변경이 있는 저장소(`dirty`, 1), 충돌이 있는 저장소(`conflict`, 2)를 건너뛴다. 계획을 모두 출력한 뒤 한 번 확인하고, 한 저장소가 실패해도 나머지를 계속한다. 종료 코드는 가장 심각한 값이다.
4. **PR:** `agctx repos pr [--profile <name>] [--targets <file>] [--base <branch>] [--draft] [--message <text>] [--dry-run] [--yes]`는 저장소마다 원격 base 브랜치를 분리 worktree(`--targets`의 URL·bare 저장소는 임시 clone)에 체크아웃하고 계획한다. 고정한 저장소는 프로필의 현재 커밋으로 다시 고정하고 나머지는 동기화한다. 바뀐 것이 없거나, 브랜치 `agctx/<프로필>-<커밋 7자리>`에 열린 PR이 있거나, 원격에 그 브랜치가 있으면 아무것도 만들지 않는다. 확인한 뒤 분리된 HEAD에서 `chore(agctx): update <프로필> profile to <커밋 7자리>`(또는 `--message`)로 커밋하고, `HEAD:refs/heads/<브랜치>`로 push하고, `gh pr create`로 PR을 연다. PR 본문에는 버전 범위·프로필 커밋·바뀐 파일을 적는다. `gh`로 PR을 열지 못하면 push한 상태(`pushed`)와 PR을 만들 방법을 알린다. 임시 작업 공간은 항상 지운다.
5. **check:** 고정한 프로젝트라도 이 컴퓨터의 프로필 보관함 HEAD가 기록한 커밋보다 앞서 있으면 뒤처짐(1)으로 판정한다.
6. **프로젝트 이름:** `agctx.project.json`에 `projectName`을 기록하고, `package.json`의 `name`이 없으면 이 값을 폴더 이름보다 먼저 쓴다.
7. **표면:** `repos` 명령은 저장소 단위 기능(`repository`)이라 CLI만 필수다. 사람이 보기 좋도록 TUI 메인 메뉴에 읽기 전용 `저장소 상태`를 둔다.

## 결과 및 영향 (Consequences)

- 고객사·팀 프로필이 바뀌면 `profile pull` 뒤에 `repos status`로 뒤처진 저장소를 보고, `repos sync` 또는 `repos pr` 한 번으로 반영한다. 예약 봇은 `repos pr --targets <file> --yes`만으로 동작하며 새 커밋이 없으면 아무것도 바꾸지 않는다.
- `agctx.project.json`에 `projectName`이 더해진다. 기존 프로젝트는 다음 `apply`·`sync`에서 한 번 이 필드가 기록된다.
- 평가: `evals/repos.test.ts` 5개(목록 기록·missing·prune, status 종료 코드와 안내, sync의 dry-run·확인·건너뛰기, 임시 worktree PR과 사용자 작업 폴더 보존·열린 PR 중복 방지, `--targets` 임시 clone과 gh 실패 시 push 안내), `evals/command-contract.test.ts`의 다른 폴더 이름 복사본 1개. gh는 PATH에 둔 가짜 명령으로 평가한다.
- 한계:
  - 목록은 컴퓨터마다 따로 있다. 다른 컴퓨터의 저장소는 `--targets`로 넘긴다.
  - 목록 파일과 저장소 작업에 잠금이 없어 두 `repos` 명령을 동시에 실행하면 결과가 섞일 수 있다.
  - GitHub가 아닌 호스트에서는 PR을 만들지 않고 push까지만 한다.
  - 닫힌 PR의 브랜치가 원격에 남아 있으면 새 PR을 만들지 않으므로 그 브랜치를 먼저 지워야 한다.
  - `--message`는 모든 저장소에 같은 커밋 메시지와 PR 제목을 쓰고, PR 본문은 실행한 사람의 로케일을 따른다.
  - Windows에서는 gh를 셸로 실행하므로 `--message`에 `%`가 들어가면 환경 변수로 해석될 수 있다.
  - 실제 GitHub 저장소에 PR을 만드는 흐름은 가짜 gh 평가와 로컬 원격 실행으로만 확인했다.
