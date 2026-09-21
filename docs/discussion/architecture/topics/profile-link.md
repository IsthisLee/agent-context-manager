# 기존 저장소 폴더를 프로필로 연결하기

<!-- agctx:generated:status:start -->
**상태:** Proposed
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
| 후속 작업 | ADR 0037, CLI 레퍼런스·파일 형식·프로필 개념·팀 공유 가이드·문제 해결 문서 |
| 권장 다음 작업 | [구현 순서](#구현-순서)대로 실패하는 평가부터 작성해 구현한다. |

## 목차

- [현재 동작](#현재-동작)
- [제안](#제안)
- [결정](#결정)
- [검토한 대안](#검토한-대안)
- [비범위](#비범위)
- [평가 계획](#평가-계획)
- [구현 순서](#구현-순서)

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
