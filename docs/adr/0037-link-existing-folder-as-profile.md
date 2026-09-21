# 0037. 이미 있는 규칙 저장소 폴더를 포인터로 보관함에 잇는다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-21
* **결정자:** 제품 소유자
* **근거:** 외부 근거 없음: agctx 자신의 보관함 구조와 명령 동작만 다루며, 판단 근거는 논의 문서의 실측 출력이다.
* **관련:** [기존 저장소 폴더를 프로필로 연결하기](../discussion/architecture/topics/profile-link.md)의 제안을 구현한다. [ADR 0007](0007-profile-home-layout.md)이 정한 "프로필은 `profiles/<이름>` 폴더"에 포인터로 된 프로필을 더하고, [ADR 0017](0017-git-profile-sharing.md)의 `pull`·`push`·`connect`를 연결한 프로필에서는 쓰지 않게 한다. 규칙 파일 경로는 [ADR 0036](0036-profile-json-names-rules-file.md)을 따른다.

## 배경 (Context)

- 기존 규칙 저장소를 프로필로 쓰려면 `profile.json`을 손으로 쓰고, 커밋해 원격에 올리고, `profile clone`으로 다시 받아야 했다. `clone`은 커밋된 것만 받으므로 시험하려 해도 브랜치를 따서 커밋해야 했다.
- 보관함에 폴더를 운영체제 심볼릭 링크로 이어 붙이면 커밋 없이 적용됐다. 그러나 폴더를 옮기면 프로필이 목록에서 조용히 사라지고, `profile sync`는 원인을 알리지 않고 "프로필을 찾을 수 없습니다"로 멈추며, `profile remove`로도 지울 수 없었다.
- `profile remove`는 프로필 폴더를 재귀로 지운다. Windows 정션에서 이것이 링크 너머의 폴더까지 지우는지 확인할 수 없었다.

## 검토한 대안 (Options)

| 항목 | 대안 | 판단 |
| --- | --- | --- |
| 연결을 적는 방식 | 운영체제 심볼릭 링크·정션 | 읽는 코드는 그대로지만 Windows 권한과 재귀 삭제의 범위를 보장할 수 없고, 끊긴 링크의 원래 경로를 알리기 어렵다 |
| | 보관함 폴더에 경로를 적은 `link.json` | **채택.** 운영체제 기능에 기대지 않고, 삭제가 보관함 폴더 밖에 닿지 않으며, 끊긴 경로를 파일에서 읽어 알린다 |
| 연결한 프로필의 `pull`·`push`·`connect` | 사본 프로필처럼 허용 | 사용자가 작업하는 폴더에 agctx가 merge·push하거나 추적 설정을 바꾸는 두 번째 경로가 생긴다 |
| | 막고 그 폴더에서 git을 쓰라고 안내 | **채택** |
| 명령 이름 | `profile init` | `profile create`와 둘 다 "만들기"로 읽혀 헷갈린다 |
| | `profile link` | **채택.** 폴더를 잇는다는 뜻이 드러나고 `clone`과 짝이 맞는다 |
| 한 명령으로 받고 적용하기 | `profile.json` 없이 `clone`하거나 `apply`가 Git 주소를 받는다 | 관리자가 막히는 `profile.json` 작성과 커밋 전 시험을 풀지 못하거나, 이름과 규칙 파일을 추측하게 된다 |

## 결정 (Decision)

1. **명령:** `agctx profile link [<path>] [--name <name>] [--scope <scope>] [--instructions <file>] [--dry-run] [--yes]`를 둔다. 폴더에 `profile.json`이 없으면 만들고, 보관함에 포인터를 둔다. 커밋과 push는 하지 않는다. 사용자의 저장소에 파일을 쓰므로 계획을 보여 주고 확인을 받으며, 등록부에서 `changes: 'repository'`라 에이전트 정책은 `ask`다. CLI, TUI 첫 화면, 프로필 목록 메뉴에서 실행한다.
2. **규칙 파일:** `--instructions`가 없으면 루트의 `AGENTS.md`, 없으면 `.git`과 `node_modules`를 뺀 폴더 안에 하나뿐인 `AGENTS.md`를 쓴다. 여럿이면 추측하지 않고 후보를 보여 주며 멈춘다. 규칙 파일이 루트의 `AGENTS.md`면 `schemaVersion` 1, 아니면 2와 `instructions`로 `profile.json`을 만든다.
3. **이미 있는 `profile.json`:** 새로 쓰지 않고 그 이름·용도·규칙 파일을 쓴다. 옵션으로 준 값이 다르면 멈춘다.
4. **포인터:** `profiles/<이름>/link.json`에 `{ "schemaVersion": 1, "path": "<절대 경로>" }`만 둔다. `link.json`이 있고 `profile.json`이 없는 보관함 폴더만 포인터로 본다. 받아 온 저장소가 자기 `link.json`을 가지고 있어도 사본 프로필로 남는다. `readProfile`은 포인터가 있으면 그 폴더에서 `profile.json`과 규칙 파일을 읽는다. 폴더나 그 폴더의 `profile.json`이 없으면 가리키던 경로를 알리며 멈춘다.
5. **연결한 프로필의 명령:** `view`·`apply`·`sync`·`setup`·`check`는 그 폴더를 직접 읽고 쓴다. 커밋하지 않은 수정이 섞이면 지금처럼 `uncommitted`로 기록하고 `--pin`을 거부한다. `status`는 읽기만 하고 연결한 경로를 보여 준다. `--refresh`를 줘도 그 폴더에서 `fetch`하지 않는다. `pull`·`push`·`connect`는 아무것도 바꾸지 않고 멈춘다. `remove`는 보관함 폴더만 지운다. 연결한 프로필에서 나는 오류와 다음 단계 안내는 막힌 명령 대신 그 폴더에서 쓸 git 명령을 알린다.
6. **끊긴 링크:** 폴더가 없어졌거나, 그 폴더의 `profile.json`이 없어졌거나 다른 프로필의 것이거나, 포인터를 읽을 수 없는 링크다. 자동으로 따라가지 않는다. `profile list`가 이유와 함께 따로 보여 주고(`--json`이면 `brokenLinks`의 `reason`), `check`는 보관함에 없는 프로필로 보고 경고를 붙이며, `remove`로 지울 수 있다. TUI 목록에서 고르면 다시 연결과 삭제만 있는 메뉴가 열린다. 같은 이름으로 다른 폴더를 `link`하면 지금 가리키는 폴더를 밝혀 확인을 받은 뒤 포인터를 옮긴다. 이름이 같은 사본 프로필이 있으면 멈춘다.
7. **용도 기본값:** `profile create`처럼 `personal`이다.

## 결과 및 영향 (Consequences)

- 관리자는 규칙 저장소 폴더에서 `profile link` 한 번으로 바로 적용해 볼 수 있다. 팀과 나누는 경로는 그대로 커밋·push·`clone`이다.
- 보관함의 프로필 폴더에는 사본(`profile.json`과 규칙 파일)과 포인터(`link.json`) 두 종류가 생긴다. `profile list --json`의 `profiles` 항목에는 연결한 프로필에만 `link`가 붙고, 끊긴 링크는 `brokenLinks`로 따로 나온다.
- 평가: `evals/profile-link.test.ts`(16개), TUI의 판단은 `evals/tui-link.test.ts`(5개). 운영체제 링크를 쓰지 않으므로 Windows에서도 건너뛰지 않는다.
- 한계:
  - 폴더를 옮기면 사용자가 다시 `link`해야 한다.
  - 연결한 프로필은 그 폴더의 작업 트리를 그대로 읽으므로, 다른 브랜치를 체크아웃하면 그 브랜치의 규칙이 적용된다. 제품 저장소에는 그때의 브랜치와 커밋이 기록된다.
  - 용도를 바꾸는 명령은 없다. 연결한 프로필은 그 폴더의 `profile.json`을 고쳐 바꾼다.
