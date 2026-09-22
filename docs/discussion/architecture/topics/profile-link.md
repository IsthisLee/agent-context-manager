# 기존 저장소 폴더를 프로필로 연결하기

<!-- agctx:generated:status:start -->
**상태:** Implemented
<!-- agctx:generated:status:end -->

## 제안 요약

### 목적과 이유

| 항목 | 내용 |
| --- | --- |
| 제안 목표 | 이미 컴퓨터에 받아 둔 규칙 저장소 폴더에서 `agctx profile link` 한 번으로 `profile.json`을 만들고 그 폴더를 프로필 보관함에 연결해, 커밋하지 않고도 바로 `apply`로 적용해 볼 수 있게 한다. |
| 제안 이유 | 기존 규칙 저장소를 프로필로 쓰려면 `profile.json`을 손으로 쓰고, 커밋해서 원격에 올리고, `profile clone`으로 다시 받아야 한다. 시험해 보려고 해도 브랜치를 따서 커밋해야 한다. `clone`은 커밋된 것만 받기 때문이다. 폴더를 보관함에 심볼릭 링크로 이어 붙이면 커밋 없이 적용되지만, 폴더를 옮기면 프로필이 목록에서 조용히 사라지고 `profile remove`로도 지울 수 없다. |

### 범위와 우선순위

| 항목 | 내용 |
| --- | --- |
| 대상 계층 | agctx CLI/TUI(`profile link`와 링크 프로필을 다루는 기존 명령), 프로필 보관함, 사용자의 규칙 저장소 폴더(`profile.json`) |
| 결정할 것 | 보관함에 연결을 적는 방식, 링크 프로필에서 `pull`·`push`·`connect`를 허용할지, 명령 이름, 용도 기본값. 네 가지 모두 [결정](#결정)에서 정했다. |
| 중요도 | High: 관리자가 기존 규칙 저장소로 agctx를 처음 들일 때 거치는 단계이고, 오늘 이 단계에서 막혔다. |

### 의존성과 실행 순서

| 항목 | 내용 |
| --- | --- |
| 선행 작업 | `profile.json`의 `instructions`([ADR 0036](../../../adr/0036-profile-json-names-rules-file.md)) |
| 선행 제안 | [프로필 모델과 저장소](profile-model.md), [Git 기반 프로필 관리](git-profile-management.md), [기존 Git 저장소를 프로필 원천으로 쓰기](existing-repository-source.md) |
| 후속 제안 | 없음 |
| 연관 제안 | [기존 저장소에서 프로필 만들기](profile-import.md)는 저장소 파일에서 고른 절을 복사해 새 프로필을 만든다. 이 주제는 복사하지 않고 폴더 자체를 프로필로 쓴다. |
| 후속 작업 | 다섯 번째 검수에서 넘긴 11건([구현 기록](#구현-기록-다섯-번째-검수의-조용히-틀린-결과를-고침)의 다음 단계). 결정은 [ADR 0037](../../../adr/0037-link-existing-folder-as-profile.md)에, 사용 절차는 [기존 저장소를 프로필로 쓰기](../../../guides/team-sharing.md#기존-저장소를-프로필로-쓰기)에, 명령과 파일 형식은 [CLI Reference](../../../reference/cli.md#profile-link)와 [파일 형식](../../../reference/file-formats.md#linkjson)에 옮겼다. |
| 권장 다음 작업 | 이 주제의 계약은 [구현 기록](#구현-기록)대로 모두 구현했다. 넘긴 11건 가운데 push하지 않은 커밋으로 고정하는 문제는 사본 프로필에도 있으므로, 링크와 따로 떼어 먼저 다룬다. |

## 목차

- [현재 동작](#현재-동작)
- [제안](#제안)
- [결정](#결정)
- [검토한 대안](#검토한-대안)
- [비범위](#비범위)
- [평가 계획](#평가-계획)
- [구현 순서](#구현-순서)
- [구현 기록](#구현-기록)

## 현재 동작

아래 출력은 `main`(`d5ebdbe`)의 `node src/agctx.ts --lang ko`를 임시 `AGCTX_HOME`에서 실행한 결과다. 규칙 파일이 `templates/AGENTS.md`에 있는 예시 저장소 `team-rules`를 썼고, 경로는 `./`로 줄였다.

`profile.json`을 만들어도 커밋하기 전에는 받지 못한다.

```text
$ agctx profile clone ./team-rules
오류: ./team-rules: 프로필 저장소가 아닙니다. 루트에 profile.json 파일이 없습니다.
```

보관함에 폴더를 심볼릭 링크로 이어 붙이면 커밋 없이 적용된다. 그런데 폴더를 옮기면 프로필이 목록에서 사라지고, 원인을 알리지 않는 오류가 나며, 끊긴 링크를 agctx로 지울 수도 없다.

```text
$ agctx profile apply team-rules ./orders-api --yes
team-rules 프로필을 ./orders-api에 적용했습니다.

$ agctx profile list          # 폴더를 옮긴 뒤
프로필이 없습니다. `agctx profile create`로 만드세요.

$ agctx profile sync ./orders-api --yes
오류: 프로필을 찾을 수 없습니다: team-rules
다음: agctx profile list로 프로필 목록을 확인하세요.

$ agctx profile remove team-rules --yes
오류: 프로필을 찾을 수 없습니다: team-rules
```

`profile remove`는 프로필 폴더를 재귀로 지운다(`src/profile/store.ts`의 `removeProfile`). 심볼릭 링크 대신 Windows 정션을 쓰면 링크 너머의 폴더까지 지워질 수 있는지 이 컴퓨터에서는 확인할 수 없다.

## 제안

규칙 저장소 폴더에서 실행한다.

제안 예시:

```bash
cd ~/work/team-rules
agctx profile link
```

```text
계획:
  create  profile.json  (name team-rules, scope personal, instructions templates/AGENTS.md)
  link    ~/.agctx/profiles/team-rules → ~/work/team-rules
```

### 연결하는 순서

1. **규칙 파일을 찾는다.** 루트에 `AGENTS.md`가 있으면 그것을 쓴다. 없으면 폴더 안의 `AGENTS.md`를 찾되 `.git`과 `node_modules`는 뺀다. 하나뿐이면 그것을 쓰고, 여럿이면 추측하지 않는다. TUI는 목록에서 고르게 하고, CLI는 후보를 보여 주며 `--instructions <경로>`를 요구하고 멈춘다.
2. **이름과 용도를 정한다.** 이름은 `--name`, 없으면 폴더 이름이다. 용도는 `--scope`, 없으면 `profile create`처럼 `personal`이다. 용도는 목록에서 묶어 보여 주는 데만 쓰인다.
3. **`profile.json`을 정한다.** 이미 있으면 새로 쓰지 않고 들어 있는 이름·용도·규칙 파일을 쓴다. 명령줄 값과 다르면 멈춘다. 없으면 규칙 파일이 루트의 `AGENTS.md`일 때 `schemaVersion` 1로, 아닐 때 `schemaVersion` 2와 `instructions`로 만든다.
4. **계획을 보여 주고 확인을 받는다.** 사용자의 저장소 폴더에 파일을 쓰므로 `apply`처럼 확인을 받는다. 터미널이 아니면 `--yes`가 있어야 진행하고, `--dry-run`은 계획만 보여 준다.
5. **쓴다.** `profile.json`을 쓰고 보관함에 포인터를 둔다. 커밋과 push는 하지 않는다. 끝나면 바로 `apply`로 시험할 수 있다는 것과, 팀과 나누려면 `profile.json`을 커밋해 올리고 팀원은 `profile clone`으로 받는다는 것을 안내한다.

Git 저장소가 아닌 폴더도 연결한다. 그 프로필은 지금의 로컬 프로필처럼 커밋에 고정(`--pin`)할 수 없다.

### 링크 프로필

보관함의 `profiles/<이름>/` 폴더에 규칙 파일 대신 연결할 폴더를 적은 `link.json`만 둔다.

```text
~/.agctx/profiles/team-rules/link.json  ──가리킴──▶  ~/work/team-rules/
                                                     ├── profile.json
                                                     └── templates/AGENTS.md
```

| 명령 | 링크 프로필에서 |
| --- | --- |
| `profile list` | "링크"로 표시하고 가리키는 폴더를 보여 준다 |
| `view`·`apply`·`sync`·`check`·`setup` | 그 폴더의 파일을 읽고 쓴다. 커밋하지 않은 수정도 바로 보이며, 섞였으면 지금처럼 `uncommitted`로 기록하고 `--pin`은 거부한다. 제품 저장소에는 그 폴더의 원격 주소와 커밋이 기록된다 |
| `status` | 그 폴더의 Git 상태를 읽기만 한다 |
| `pull`·`push`·`connect` | 아무것도 바꾸지 않고 멈춘 뒤, 그 폴더에서 git으로 하라고 안내한다 |
| `remove` | 보관함 쪽 폴더만 지운다. 연결한 폴더는 건드리지 않는다 |
| `clone` | 같은 이름이 있으면 지금처럼 멈춘다 |

### 끊긴 링크

연결한 폴더를 옮기거나 지우면 링크가 끊긴다. 자동으로 따라가지는 않는다. 옮긴 곳을 알 방법이 없고, 비슷한 폴더를 추측해 이으면 다른 규칙을 적용할 수 있다.

- `profile list`는 사라지게 두지 않고 "끊긴 링크: <원래 경로>"로 보여 준다.
- 다른 명령은 "링크가 가리키는 폴더가 없습니다: <경로>"로 멈추고 다음 할 일을 안내한다.
- `profile remove`로 끊긴 링크도 지운다.
- 옮긴 곳에서 같은 이름으로 `profile link`를 다시 실행하면, 연결을 새 위치로 바꾸는 계획을 보여 주고 확인을 받아 바꾼다. 이렇게 다시 잇는 일은 링크 프로필에서만 된다. `clone`으로 받은 사본 프로필과 이름이 겹치면 멈춘다.

## 결정

2026-09-21 제품 소유자가 정했다.

1. **연결을 적는 방식: 포인터 파일.** 운영체제의 링크를 쓰지 않고 `profiles/<이름>/link.json`에 절대 경로를 적는다. Windows에서도 권한 없이 같게 동작하고, `profile remove`가 보관함 쪽 폴더만 지우므로 연결한 폴더를 지울 위험이 구조적으로 없다. 가리키는 경로를 파일에서 읽으므로 끊긴 링크의 경로를 정확히 알릴 수 있다.
2. **`pull`·`push`·`connect`는 막는다.** 링크 프로필은 사용자가 작업하는 폴더 그 자체라, agctx가 여기에 merge나 push를 하거나 추적 설정을 바꾸면 평소 git 사용과 다른 경로가 하나 더 생긴다.
3. **명령 이름: `profile link`.** 폴더를 보관함에 잇는다는 뜻이 드러나고 `clone`(받아 와서 사본을 둠)과 짝이 맞는다. `profile init`은 `profile create`와 둘 다 "만들기"로 읽혀 헷갈린다.
4. **용도 기본값: `personal`.** `profile create`와 같게 둔다. 용도를 바꾸는 명령은 없지만, 용도는 목록 표시에만 쓰이고 TUI에서는 물어본다.

## 검토한 대안

| 대안 | 판단 |
| --- | --- |
| `profile.json` 없이 `clone`하고 이름·규칙 파일을 추측한다 | 한 번뿐인 단계를 없애는 대신 `pull`·`--pin`·`check`에 예외를 깔고, 이름과 규칙 파일을 추측한다 |
| `apply`가 Git 주소를 받아 받기와 적용을 한 번에 한다 | 팀원의 반복을 줄이지만, 관리자가 막히는 `profile.json` 작성과 커밋 전 시험은 풀지 못한다. 필요해지면 따로 더한다 |
| 운영체제 심볼릭 링크로 잇는다 | 읽는 코드는 거의 그대로지만, Windows는 권한이나 정션이 필요하고 재귀 삭제가 링크 너머에 닿는지 확인할 수 없다 |
| `profile.json`만 만들고 연결은 하지 않는다 | 시험하려면 여전히 커밋·push·`clone`을 거쳐야 한다 |
| 링크 프로필에서 `pull`·`push`를 허용한다 | 사용자가 다른 브랜치를 작업하는 중에도 agctx가 그 폴더에 받거나 올리게 된다 |

## 비범위

- 폴더를 옮겼을 때 자동으로 찾아 다시 잇는 일
- `profile.json`이 없는 원격 저장소를 `clone`하는 일
- 연결한 폴더에 커밋하거나 push하는 일
- 프로필 용도를 바꾸는 명령

## 평가 계획

1. 규칙 파일이 하위 폴더에만 있는 저장소를 연결하면 `profile.json`(`schemaVersion` 2, `instructions`)과 포인터가 생기고, 목록에 링크로 나오며, `apply`가 그 파일을 쓴다. 저장소에 커밋은 생기지 않는다.
2. 루트에 `AGENTS.md`가 있으면 `schemaVersion` 1로 만든다.
3. 후보가 여럿이면 `--instructions` 없이는 후보를 보여 주며 64로 멈추고, 주면 연결한다.
4. `profile.json`이 이미 있으면 새로 쓰지 않고, 명령줄 값과 다르면 64로 멈춘다.
5. `--dry-run`은 아무것도 쓰지 않고, 터미널이 아닐 때 `--yes`가 없으면 64로 멈춘다.
6. 커밋 전 수정이 바로 적용되고 `uncommitted`로 기록되며, `--pin`은 거부된다.
7. `pull`·`push`·`connect`는 64로 멈추고, 연결한 폴더는 그대로다.
8. `remove`는 포인터만 지우고, 연결한 폴더의 파일과 `.git`은 남는다.
9. 폴더를 옮기면 목록에 끊긴 링크로 나오고, `apply`는 경로를 알리며 멈추고, `remove`가 된다. 새 위치에서 다시 연결하면 새 위치를 가리킨다.
10. `clone`으로 받은 프로필과 이름이 겹치면 64로 멈춘다.
11. Git이 아닌 폴더도 연결되지만 `--pin`은 거부된다.

운영체제 링크를 쓰지 않으므로 이 평가들은 Windows에서도 건너뛰지 않는다. CLI·TUI 등록과 스킬 소속은 `evals/interface-parity.test.ts`와 `evals/agent-surface.test.ts`가 검사한다.

## 구현 순서

1. 평가 계획의 평가를 `evals/profile-link.test.ts`에 쓰고 실패를 확인한다.
2. 보관함: 프로필 폴더의 `link.json`을 따라가게 하고(`readProfile`), 목록이 링크와 끊긴 링크를 알게 하며(`getProfiles`), 삭제가 보관함 쪽 폴더만 지우게 한다(`removeProfile`).
3. `src/profile/link.ts`: 규칙 파일 후보 찾기, 계획 만들기, 쓰기.
4. 명령 등록부·처리기·TUI(첫 화면과 프로필 목록 메뉴), 한국어·영어 메시지, 작성자용 스킬의 상황 설명.
5. `pull`·`push`·`connect`가 링크 프로필에서 멈추게 하고, `status`와 목록이 링크를 표시하게 한다.
6. ADR 0037과 사용자 문서를 고치고, 이 문서에 구현 기록을 남긴다.

## 구현 기록

#### 구현 기록: profile link와 포인터 프로필

* **결정:** [ADR 0037](../../../adr/0037-link-existing-folder-as-profile.md). [결정](#결정)의 네 항목대로 구현했다.
* **구현:** `src/profile/link.ts`의 `planLink`·`writeLink`·`instructionCandidates`가 연결을 계획하고 쓴다. `src/profile/store.ts`의 `profileLink`가 포인터를 읽고, `readProfile`이 연결한 폴더로 따라가며, `getProfiles`·`getBrokenLinks`가 목록을 만들고, `removeProfile`이 보관함 폴더만 지우고, `assertNotLinked`가 `src/profile/git-profile.ts`의 `pullProfile`·`planPush`·`connectProfile`을 막는다. `src/check.ts`의 `checkProject`는 연결한 폴더를 보고 끊긴 링크를 경고한다. 명령 등록부, 처리기, TUI(`src/tui/profile.ts`의 `linkProfileTui`, 첫 화면과 프로필 목록 메뉴), 한국어·영어 메시지, 작성자용 스킬의 상황 설명을 더했다.
* **평가:** `evals/profile-link.test.ts` 11개가 통과한다. 10번(같은 이름의 사본 프로필 거부)은 명령이 없던 구현 전에도 64로 통과했으므로, 검사를 하나씩 빼는 변이 10개로 확인했다. 삭제 범위, `pull`·`push`·`connect` 막기, 사본 프로필 거부, 후보가 여럿일 때 멈추기, `profile.json`과 옵션 불일치, 끊긴 링크 목록·경로 안내·`check` 경고, `--dry-run`, 루트 `AGENTS.md` 우선은 빼면 해당 평가가 실패했다. `evals/interface-parity.test.ts`의 명령 전체 목록에 `profile.link`를 더했고, `evals/tui-commands.test.ts`에 TUI 답이 `--name`·`--scope`·`--instructions`와 같아지는 평가를 더했다.
* **계획과 달라진 점:**
  - `check`는 끊긴 링크에서 멈추지 않는다. 제안은 "다른 명령은 경로를 알리며 멈춘다"였지만, `check`는 CI에서도 쓰는 읽기 전용 명령이라 보관함에 프로필이 없는 것으로 보고 기록한 해시로 판정하며, 끊긴 경로를 경고로 알린다.
  - `profile list --json`은 끊긴 링크를 `profiles`에 섞지 않고 `brokenLinks`로 따로 낸다. 끊긴 링크에는 용도를 읽을 `profile.json`이 없기 때문이다.
  - 형식이 틀린 `link.json`도 `profile remove`로 지울 수 있게 했다. 포인터를 읽기 전에 파일이 있는지만 보고 지운다.
* **제약:** 폴더를 옮기면 사용자가 다시 `link`해야 한다. 연결한 폴더에서 다른 브랜치를 체크아웃하면 그 브랜치의 규칙이 적용된다.
* **다음 단계:** 없음.

#### 구현 기록: 검수에서 나온 결함을 고침

* **결정:** [ADR 0037](../../../adr/0037-link-existing-folder-as-profile.md)의 결정 4~6을 다듬었다. 포인터는 `link.json`이 있고 `profile.json`이 없는 폴더로만 본다. 끊긴 링크에는 이유를 붙인다. 링크 프로필의 `status`는 `fetch`하지 않는다. 다시 연결할 때는 지금 가리키는 폴더를 밝혀 묻는다.
* **구현:** `src/profile/store.ts`의 `isPointerFolder`·`getBrokenLinks`(이유: `missing-folder`·`missing-metadata`·`invalid-metadata`·`invalid-link`)·`readProfile`, `src/profile/git-profile.ts`의 `profileGitState`, `src/profile/link.ts`의 `ruleFileChoices`·`linkQuestion`, `src/profile/apply.ts`의 `profileVersion`(연결한 프로필의 고정 오류 안내), 처리기의 `status`·`repos status` 안내를 고쳤다. TUI는 `src/tui/profile.ts`의 `linkRuleOptions`·`linkOutro`·`menuFor`·`removeChoices`·`statusRefreshPrompt`로 판단을 떼어 냈다. 규칙 파일을 직접 입력할 수 있고, 연결 결과에 맞는 끝 문구를 띄우며, 끊긴 링크는 다시 연결과 삭제만 있는 메뉴로 보낸다.
* **평가:** `evals/profile-link.test.ts`에 5개(상태가 `fetch`하지 않고 `pull`·`push`를 권하지 않음, `repos status` 안내, 자기 `link.json`을 가진 저장소, `profile.json`을 잃은 링크, 막힌 명령을 가리키지 않는 안내)를 더했고, `evals/tui-link.test.ts` 5개를 새로 썼다. 고친 동작마다 그 검사를 빼는 변이 13개가 모두 해당 평가에서 실패했다. 처음에 잡지 못한 변이 하나(링크 상태에서 `pull` 안내)는 사용자가 직접 `git fetch`한 상태를 평가에 더해 잡았다. TUI는 가상 터미널로 띄워, 확인을 거절하면 "Linking was cancelled."가 나오고 아무것도 쓰이지 않는 것과, 끊긴 링크를 고르면 전용 메뉴가 열리는 것을 확인했다.
* **계획과 달라진 점:** 끊긴 링크의 `brokenLinks` 항목에 `reason`이 붙었다. 같은 이름으로 다른 폴더를 연결하는 일은 끊긴 링크에만 한정하지 않고, 확인 질문에서 지금 가리키는 폴더를 밝히는 것으로 정했다.
* **제약:** 코드 주석은 저장소의 기존 관례대로 영어로 두었다. 전역 규칙("주석은 한글로")과 맞출지는 정하지 않았다.
* **다음 단계:** 없음.

#### 구현 기록: 두 번째 검수에서 나온 결함을 고침

* **결정:** [ADR 0037](../../../adr/0037-link-existing-folder-as-profile.md)의 결정 2·3·6을 다듬었다. 링크를 쓸 수 있는지는 한 함수에서 판정하고, 규칙 파일이 없어진 링크도 끊긴 링크로 본다. `check`는 모든 끊긴 링크에서 멈추지 않고 경고한다. Git 저장소 안의 하위 폴더와 심볼릭 링크 규칙 파일은 연결하지 않고 쓸 수 있는 명령을 안내한다.
* **구현:**
  - `src/profile/store.ts`의 `profileLocation`이 프로필 파일이 있는 폴더와 끊긴 이유(`missing-rules` 추가)를 정한다. `readProfile`·`getProfiles`·`getBrokenLinks`, `src/check.ts`의 `checkProject`, `src/repos/pr.ts`의 PR 본문 커밋 목록, 처리기와 TUI가 이 결과를 쓴다. `removeProfile`은 프로필로 읽을 수 없는 보관함 폴더도 지운다.
  - `src/profile/link.ts`의 `planLink`는 저장소 안의 하위 폴더, 심볼릭 링크 규칙 파일, 이름 규칙에 맞지 않는 폴더 이름에서 멈추고 바로 실행할 수 있는 명령을 안내한다. 이미 있는 `profile.json`의 규칙 파일이 없으면 `profile.json`을 고치라고 안내하고, 읽을 수 없는 포인터는 같은 이름으로 다시 연결한다. `instructionCandidates`는 네 단계까지만 찾고 숨은 폴더와 의존성·빌드 폴더를 뺀다. 루트에 `AGENTS.md`가 있으면 찾지 않는다.
  - 처리기는 `--yes` 재시도 명령의 인자를 셸에서 한 덩어리로 읽히게 인용하고, `profile list --scope --json`에서 끊긴 링크를 빼며, Git 밖의 연결 폴더에는 git 안내를 하지 않는다. 끊긴 링크의 복구 안내에는 `--name <이름>`을 붙였다.
  - TUI는 끊긴 링크 메뉴에서 다시 연결할 때 이름을 묻지 않고 그 링크의 이름을 쓰고(`src/tui/profile.ts`의 `linkNameStep`), 목록이 이미 읽은 끊긴 링크를 메뉴 판단에 넘긴다.
* **평가:** `evals/profile-link.test.ts`에 12개, `evals/tui-link.test.ts`에 4개를 더해 각각 28개·9개가 통과한다. 모두 고치기 전에 실패하는 것을 먼저 확인했다. 고친 동작마다 그 검사를 빼는 변이 19개를 돌려 모두 해당 평가에서 실패했다. 처음에 놓친 변이 하나(읽을 수 없는 포인터를 다른 폴더를 가리키던 링크처럼 다루기)는 평가에 `relinkFrom`과 확인 질문 검사를 더해 잡았다. TUI는 가상 터미널로 띄워, `profile.json`을 잃은 링크와 `link.json`이 깨진 링크를 끊긴 링크 메뉴에서 다시 연결하면 이름을 묻지 않고 같은 `company` 프로필이 목록에 돌아오는 것을 확인했다.
* **계획과 달라진 점:**
  - 제안은 저장소 폴더를 연결한다고만 했다. 하위 폴더를 연결하면 고정·`status`·`clone`이 Git 밖의 폴더로 다루므로, 하위 폴더는 막고 루트를 연결하는 명령을 알려 주기로 했다.
  - 제안은 루트 밖의 `AGENTS.md`를 폴더 전체에서 찾았다. 인자 없이 실행하면 지금 폴더를 찾으므로, 홈 폴더나 큰 저장소를 끝까지 돌지 않게 네 단계로 제한했다.
* **제약:** 재시도 명령의 인용은 `--yes` 재시도를 공통 함수로 만드는 명령(`profile link`·`verify`·`repos sync`·`repos pr`)에만 적용된다. `profile apply`·`sync`·`resolve`는 재시도 명령을 따로 만들고, 공백이 든 프로젝트 경로를 인용하지 않는 것은 이 변경 전과 같다.
* **다음 단계:** 없음.

#### 구현 기록: 세 번째 검수에서 드러난 원인 세 가지를 고침

* **배경:** 세 번째 검수에서도 15건이 나왔고, 그중 7건은 앞선 두 번의 수정에서 다룬 주제가 다시 나온 것이었다. 지적을 하나씩 그 자리에서만 막은 탓이라고 보고, 사용자와 공통 원인 세 가지를 고치기로 정했다.
  1. 판정 함수가 링크만 판정하고, 사본 폴더와 손으로 만든 운영체제 링크는 판정하지 않았다. 그래서 끊긴 운영체제 링크에서 `check`가 `main`과 달리 64로 멈췄다.
  2. `link.json`에 경로만 있어, `profile.json`을 잃은 링크를 다시 연결하면 용도와 규칙 파일이 기본값으로 바뀌었다.
  3. 이름이 같으면 멀쩡한 링크도 다른 폴더로 옮겨서, `--yes`를 주면 프로젝트가 묻지도 않고 다른 폴더의 규칙을 받았다.
* **결정:** [ADR 0037](../../../adr/0037-link-existing-folder-as-profile.md)의 결정 2·4·6을 고쳤다. 판정은 보관함의 모든 항목(사본, 포인터, 운영체제 링크)에 대해 한 곳에서 한다. 포인터는 연결할 때의 용도와 규칙 파일을 함께 기록한다. 멀쩡한 링크는 옮기지 않고 끊긴 링크만 다시 잇는다.
* **구현:**
  - `src/profile/store.ts`의 `profileLocation`이 보관함 항목의 종류와 끊긴 이유를 정하고, `readStore`가 보관함을 한 번 읽어 프로필·끊긴 링크·프로필이 아닌 폴더로 나눈다. `readProfile`은 다시 판정하지 않고 그 결과에 따라 오류를 낸다. 규칙 파일 자리에 폴더가 있으면 규칙 파일이 없는 것으로 본다.
  - `src/profile/link.ts`의 `writeLink`가 포인터에 용도와 규칙 파일을 쓰고, `planLink`는 멀쩡한 링크를 옮기지 않고 멈춘다. `checkLinkFolder`는 규칙 파일을 찾기 전에 홈 폴더와 저장소 안의 하위 폴더를 거른다. 하위 폴더 안내에는 준 `--name`·`--scope`를 넣고 경로를 인용하며, 커밋에 들어 있지 않은 폴더는 Git 밖의 폴더로 본다. 규칙 파일은 폴더 1000개까지 찾고, 하위 폴더의 심볼릭 링크 `AGENTS.md`도 링크라고 알린다.
  - `repos status`는 `check`의 경고를 저장소 줄 아래와 JSON의 `warnings`에 싣고, 연결한 프로필을 고정한 저장소에는 그 폴더에서 먼저 push하라고 안내한다. 명령 안에 넣는 경로는 `src/shared/shell.ts`의 `shellWord`로 인용한다.
  - TUI는 폴더를 확인한 뒤에 규칙 파일을 찾고, 이름 칸에 규칙에 맞게 바꾼 이름을 넣는다. `profile.json`이 다른 프로필 것인 끊긴 링크에는 고치는 방법과 삭제만 보여 주고, 프로필이 아닌 보관함 폴더도 목록에서 지울 수 있다.
* **평가:** `evals/profile-link.test.ts`에 12개, `evals/tui-link.test.ts`에 5개를 더해 각각 40개·14개가 통과한다. 모두 고치기 전에 실패하는 것을 먼저 확인했다. 멀쩡한 링크를 옮길 때 묻던 평가는 사용자가 고른 대로 거부하는 쪽으로 기대값을 바꿨다. 새 검사 22개와 앞선 회차의 검사 19개를 하나씩 빼는 변이를 모두 해당 평가가 잡았다. TUI는 가상 터미널로 띄워 세 가지를 확인했다. 홈 폴더를 고르면 폴더 안을 찾지 않고 바로 안내가 나오고, `profile.json` 이름이 바뀐 링크에는 고치는 방법과 삭제만 나오며, 프로필이 아닌 보관함 폴더를 대화형 `remove`로 지울 수 있었다.
* **계획과 달라진 점:** 멀쩡한 링크를 다른 폴더로 옮길 때 확인을 받고 옮기던 동작을 없앴다. 옮기려면 `profile remove` 뒤 다시 `link`한다.
* **제약:** 포인터에 기록한 용도와 규칙 파일은 마지막으로 연결한 때의 값이다. 연결한 뒤 그 폴더의 `profile.json`을 고쳤다가 잃으면 고치기 전 값으로 돌아간다.
* **다음 단계:** 없음.

#### 구현 기록: 네 번째 검수 뒤 다시 연결을 없애 추측을 줄임

* **배경:** 네 번째 검수에서도 15건이 나왔다. 그중 절반이 끊긴 링크를 다시 잇거나 되살리는 경로에서 나왔고, 직접 재현한 두 건이 여기에 속했다. 하나는 `profile.json`을 잃은 링크를 `--name` 없이 다시 연결하면 폴더 이름으로 새 프로필이 생기고 원래 프로필이 끊긴 채 남는 것이다. 다른 하나는 잠깐 `profile.json`이 없어진 링크가 `--yes`로 이름이 같은 다른 폴더로 옮겨지는 것이다. `link`가 이름·폴더·옮겨도 되는지를 추측할수록 예외가 생긴다고 보고, 사용자와 다시 연결 경로를 없애기로 정했다.
* **결정:** [ADR 0037](../../../adr/0037-link-existing-folder-as-profile.md)의 결정 6을 고쳤다. `link`는 링크를 다른 폴더로 옮기지 않는다. 같은 이름의 링크가 있으면 끊겼든 아니든 멈추고, 한 폴더에는 링크 하나만 둔다. 끊긴 링크는 `remove` 뒤 `link`로 되살리고, 안내가 포인터에 기록한 이름·용도·규칙 파일을 채운 명령을 알려 준다.
* **구현:**
  - `src/profile/link.ts`의 `planLink`에서 다시 연결 경로(`relink`)를 지웠다. 끊긴 링크가 이미 이 폴더를 가리키면 다른 이름으로 연결하지 않는다. `writeLink`는 운영체제 링크를 포인터로 바꾸지 않는다.
  - `src/profile/store.ts`의 `relinkCommand`가 되살리는 명령을, `brokenLinkHint`가 끊긴 링크의 안내를 만든다. `readProfile`의 안내, `repos status`의 다음 명령, TUI가 이 둘을 쓴다. 쓰이지 않던 `getBrokenLinks`는 지웠다.
  - 저장소 안 하위 폴더 판정은 `git rev-parse --show-toplevel`과 실제 경로로 한다. 홈 폴더가 저장소일 때 그 아래의 폴더는 Git 밖으로 보고, 커밋이 없는 저장소의 하위 폴더는 저장소 안으로 본다. 같은 폴더 비교는 파일 시스템의 대소문자를 따른다.
  - TUI의 끊긴 링크 메뉴는 되살리는 명령을 보여 준 뒤 삭제 확인으로 넘어간다. 삭제 설명을 만들기 전에 이름을 검사한다.
  - `repos status`는 끊긴 링크를 쓰는 저장소에 `repos sync` 대신 되살리는 명령을 알리고, 연결한 프로필을 고정한 저장소에는 그 폴더에서 pull과 push를 한 뒤 `repos pr`을 하라고 안내한다. 폴더 밖을 가리키는 심볼릭 링크 규칙 파일과 손으로 만든 운영체제 링크는 그렇다고 알린다.
* **평가:** `evals/profile-link.test.ts`에 9개를 더해 49개, `evals/tui-link.test.ts`는 14개가 통과한다. 다시 연결을 전제로 한 평가 7개는 사용자가 고른 대로 「거부하고 `remove` 뒤 `link`로 되살린다」로 기대값을 바꿨고, 다시 연결 메뉴의 평가 2개는 되살리는 명령을 보여 주는지와 이름을 검사하는지 확인하는 평가로 바꿨다. 새 검사 18개를 하나씩 빼는 변이를 모두 해당 평가가 잡았다. 처음에 놓친 1개(읽을 수 없는 포인터를 다른 폴더를 가리키는 링크처럼 다루기)는 평가에 오류 종류 확인을 더해 잡았다. 앞선 두 회차의 변이 가운데 지금 코드에 적용되는 29개도 모두 잡혔다. TUI는 가상 터미널로 띄워, 끊긴 링크를 고르면 되살리는 명령이 나오고 삭제 확인을 거쳐 링크만 지워지는 것을 확인했다.
* **계획과 달라진 점:** 끊긴 링크를 같은 이름으로 다시 잇는 기능과 TUI의 「다시 연결」을 없앴다.
* **제약:** 폴더를 옮기면 링크를 지우고 다시 연결하는 두 단계가 든다. 안내가 두 명령을 채워 보여 준다.
* **다음 단계:** 없음.

#### 구현 기록: 다섯 번째 검수의 조용히 틀린 결과를 고침

* **배경:** 다섯 번째 검수는 새 지적 15건을 냈다. 검수가 「조용히 틀린 결과」로 분류한 4건 가운데 3건을 고치고, 나머지는 후속 작업으로 넘기기로 사용자와 정했다. 지적 수가 줄지 않아 검수 0건은 오지 않을 가능성이 높다고 보았기 때문이다.
* **결정:** [ADR 0037](../../../adr/0037-link-existing-folder-as-profile.md)의 결정 2·4·6에 두 가지를 더했다. agctx가 프로필을 적용하며 만든 `AGENTS.md`는 규칙 파일로 스스로 고르지 않는다. 포인터의 용도·규칙 파일 기록은 그 프로필을 읽을 때마다 갱신한다. 되살리는 길은 안내된 CLI 명령 하나로 적었다.
* **구현:**
  - `src/profile/link.ts`의 `ruleFileChoices`와 `chooseInstructions`는 관리 표지(`<!-- agctx:managed:end -->`)가 있는 `AGENTS.md`를 후보에서 빼고, 그런 파일밖에 없으면 그렇다고 알린다.
  - `src/profile/store.ts`의 `refreshPointerRecord`가 `readProfile`에서 `link.json`의 기록을 폴더의 `profile.json`에 맞춘다. 멀쩡한 링크를 다시 `link`해도 이 경로를 지난다.
  - 끊긴 링크 목록의 힌트, `cli.md`, ADR 0037에서 없앤 TUI 「다시 연결」을 가리키던 문장을 고쳤다.
* **평가:** `evals/profile-link.test.ts`에 3개, `evals/tui-link.test.ts`에 1개를 더해 각각 52개·15개가 통과한다. 생성된 `AGENTS.md`밖에 없는 폴더의 평가는 구현 뒤에 썼으므로, 그 분기를 빼는 변이로 실패하는 것을 확인했다. 이번 검사 5개를 하나씩 빼는 변이를 모두 해당 평가가 잡았다.
* **계획과 달라진 점:** 없음.
* **제약:** 검수를 더 돌리지 않았으므로, 아래 넘긴 11건 말고도 찾지 못한 예외가 있을 수 있다.
* **다음 단계:** 다섯 번째 검수에서 넘긴 11건이다.
  1. 연결한 폴더에서 push하지 않은 브랜치나 커밋으로 `--pin`과 `repos pr`이 고정한다. 사본 프로필에도 있는 성질이다.
  2. 폴더가 없어진 끊긴 링크에서 `pull`·`push`·`connect`가 없는 경로에서 git을 쓰라고 안내한다.
  3. 규칙 파일이 심볼릭 링크이고 `profile.json`이 이미 있으면, `--instructions`를 주라는 안내가 기록된 값과의 불일치로 막힌다.
  4. `profile.json`이 심볼릭 링크여도 받아들여, 나중에 고정과 `clone`에서 막힌다.
  5. `--instructions`로 잘못된 경로를 주면 오류가 있지도 않은 `profile.json`을 탓한다.
  6. 폴더를 심볼릭 링크 경로로 주면, 폴더 안을 절대 경로로 가리키는 `AGENTS.md` 링크를 폴더 밖으로 판정한다.
  7. TUI의 규칙 파일 목록이 심볼릭 링크 `AGENTS.md`를 후보로 넣고 미리 고른다. 그 파일은 연결할 때 항상 거부된다.
  8. TUI의 연결한 프로필 메뉴에 받기·올리기·원격 연결이 그대로 나오고, 고르면 항상 거부된다.
  9. `repos status`가 저장소 한 줄마다 같은 프로필의 링크 판정을 세 번 한다.
  10. `ProfileLocation.kind`와 `ProfileLink.broken`이 다른 필드와 겹치는 상태를 두고, `relinkCommand`·`isPointerFolder`는 파일 밖에서 쓰지 않는데 내보낸다.
  11. 범용 파일 시스템 함수 `isDirectory`·`sameFolder`·`readMetadataFile`이 `src/profile/store.ts`에 있어, `isSymbolicLink`를 둔 `src/shared/fs-utils.ts`와 자리가 갈린다.
