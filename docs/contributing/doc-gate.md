# 문서 게이트

<!-- agctx-doc-sources: tools/check-docs.ts, tools/doc-evidence.ts, tools/doc-source-path.ts, tools/discussion-record.ts, tools/generate-reference.ts, evals/reference-docs.test.ts, tools/doc-sources.ts, evals/doc-examples.test.ts, tools/discussion-topics.ts, tools/generate-discussion-status.ts, evals/discussion-status.test.ts, tools/doc-citations.ts, evals/doc-citations.test.ts, tools/symbol-source.ts, evals/symbol-source.test.ts -->
<!-- agctx-doc-sources-sha256: e736e01f7413ab51ec5c12791e233a870c4f7b002966999362d84316435f73be -->

`pnpm run check`의 `check:docs`는 문서가 코드와 근거에서 멀어지지 않게 한다. 문서를 어디에 둘지와 작성 규칙은 루트 [`AGENTS.md`](../../AGENTS.md)의 문서 규칙을 따른다.

## 한눈에 보기

문서의 내용은 종류마다 지키는 방법이 다르다. 아래로 갈수록 사람의 판단에 의존한다.

```text
코드에서 뽑을 수 있는 사실   생성한다           틀릴 수가 없다
명령의 출력 예시            실제로 실행해 비교   틀리면 평가가 실패
코드의 위치(인용)           이름 + 지문         이름이 없거나 코드가 바뀌면 실패
말로 쓴 동작 설명           소스 해시 게이트     소스가 바뀌면 "다시 읽어라"
문서 자체의 계약            링크·색인·근거 검사  형식이 어긋나면 실패
```

| 지키는 방법 | 대상 | 실패했을 때 할 일 | 정본 절 |
| --- | --- | --- | --- |
| 생성 | CLI 명령표, 스킬 명령 목록, 논의 상태 | 생성기를 다시 실행한다 | [생성하는 레퍼런스](#생성하는-레퍼런스), [생성하는 논의 상태](#생성하는-논의-상태) |
| 실행 대조 | 빠른 시작의 명령 예시 | 실제 출력으로 예시를 고친다 | [핀 범위와 예시 검사](#핀-범위와-예시-검사) |
| 인용과 지문 | 문서가 가리키는 코드 위치 | 그 항목을 다시 읽고 `--stamp` | [코드를 가리키는 형식](#코드를-가리키는-형식) |
| 소스 해시 | 코드 동작을 말로 설명한 문서 | 문서를 다시 읽고 `--stamp` | [문서 소스 해시 게이트](#문서-소스-해시-게이트) |
| 근거·형식 검사 | 외부 근거의 확인일, ADR 머리말, 링크·앵커 | 형식을 맞춘다 | [문서 근거 게이트](#문서-근거-게이트) |

## 문서 소스 해시 게이트

현재 코드 동작을 서술하는 문서는 인용·서술하는 소스 파일 목록과 그 sha256을 문서 상단 HTML 주석 마커로 고정한다. `pnpm run check`의 `check:docs`가 마커의 소스를 다시 해싱해 기록된 값과 다르면 실패한다. 현재 대상은 코드 동작이나 실제 출력을 싣는 `getting-started/`·`guides/`·`concepts/`·`reference/`의 문서(`concepts/why-agctx.md` 제외), `contributing/`의 `architecture.md`·`implementation-principles.md`·`testing.md`·`releasing.md`·`doc-gate.md`·`adapters.md`, 그리고 루트 `README.md`·`README.en.md`이다. 제품 방향·논의·ADR·변경 이력·기여 정책처럼 코드에 매이지 않는 문서와 배포·생성되는 산출물(`templates/`, `.agents/`, `.github/` 등)은 대상이 아니다.

```mermaid
flowchart TD
  SRC["핀한 소스 변경<br/>src · package.json · workflow 등"] --> CHECK["pnpm run check<br/>check:docs가 소스를 다시 해싱"]
  CHECK --> CMP{"기록된 sha256과 같은가?"}
  CMP -->|"같음"| PASS["통과"]
  CMP -->|"다름"| FAIL["실패: doc sources changed"]
  FAIL --> READ["문서를 다시 읽고<br/>인용한 줄 번호·서술을 고침"]
  READ --> STAMP["node tools/check-docs.ts --stamp &lt;문서&gt;"]
  STAMP --> CHECK
```

게이트는 소스가 바뀌었다는 사실만 알린다. 문서를 고치는 단계를 건너뛰고 `--stamp`만 실행해도 다시 통과하므로, 문서가 정확한지는 사람이 확인해야 한다. 다만 그렇게 넘어간 문서는 `--restamped`가 뒤늦게라도 찾아낸다.

- **마커는 절마다 둘 수 있다.** 한 마커는 그 위치부터 다음 마커 전까지를 맡고, 실패 메시지에 그 마커 위의 제목이 함께 나온다. 문서 하나를 통째로 핀하면 관련 없는 변경에도 문서 전체를 다시 읽어야 하므로, 절이 기대는 소스만 그 절에 단다. 예를 들어 [테스트와 품질 게이트](testing.md)는 `.github/workflows/ci.yml`을 "CI 환경" 절에만 달아, 그 파일이 바뀌면 그 절만 걸린다.
- 마커는 `<!-- agctx-doc-sources: <쉼표로 구분한 경로> -->`와 `<!-- agctx-doc-sources-sha256: <64자리 hex> -->` 두 줄이다. 경로에는 파일뿐 아니라 디렉터리도 넣을 수 있다. 디렉터리를 넣으면 그 아래 모든 파일을 해싱하므로 안에서 파일이 추가·삭제·수정되면 목록을 고치지 않아도 게이트가 걸린다.
- 해시가 어긋나면 문서를 다시 읽어 드리프트를 고친 뒤 `node tools/check-docs.ts --stamp <문서 경로>`로 해시를 다시 기록한다. 이 갱신이 재검증했다는 표시다. **경로를 적는 것이 승인 단위다.** 경로 없이 실행하면 어긋난 문서의 목록과 각각의 명령을 보여 주고 아무것도 쓰지 않은 채 1로 끝난다. 마커 형식이 바뀐 경우처럼 전부를 한 번에 다시 기록해야 하면 `--stamp --all`을 쓴다.
- 문서도 소스로 핀할 수 있다. 핀한 문서의 `agctx-doc-sources-sha256` 줄과 생성 블록의 내용은 해싱에서 빼므로(`withoutRecordedHash`·`withoutGeneratedBlocks`, `tools/doc-sources.ts`), 그 문서를 다시 stamp하거나 생성 블록을 다시 생성해도 핀한 쪽은 실패하지 않고 사람이 쓴 본문이 바뀔 때만 실패한다. 생성 블록은 평가가 원본 데이터와 대조하므로 해시로 다시 지키지 않는다. `README.md`와 `README.en.md`는 이 방식으로 서로를 핀한다. 한 언어의 README를 고치면 다른 언어 README가 실패하므로, 두 파일을 같은 내용으로 맞춘 뒤 stamp한다.
- **실패 메시지는 바뀐 소스를 지목한다.** 지문은 핀한 소스 전체를 합쳐 만들기 때문에 검사기 혼자서는 어느 파일이 움직였는지 모른다. 그래서 그 지문을 기록한 커밋을 git에서 찾고 그 뒤에 바뀐 파일만 추려 보여 준다(`tools/check-docs.ts`의 `changedPinnedSources`<!--s:96c386caee18-->). git으로 답할 수 없으면 지금까지처럼 핀 목록을 그대로 적는다.
- 인용하는 소스가 늘거나 줄면 마커의 목록도 같은 변경에서 갱신한다. 다만 디렉터리로 고정한 범위 안에서 파일이 늘거나 줄면 목록 갱신 없이 자동 반영된다.
- **지문만 다시 찍은 문서는 `--restamped`가 찾아낸다.** `node tools/check-docs.ts --restamped [기준]`은 기준(기본값 `main`)부터 `HEAD`까지의 커밋을 훑어, 바뀐 줄이 기록 해시와 인용 지문뿐인 Markdown 문서의 이름을 출력한다. 판정은 diff만 보고 하며 `tools/doc-sources.ts`의 `restampOnlyDocuments`<!--s:32ad3ed3d35d-->가 한다. 다시 읽는 것이 옳은 경우도 있으므로 **경고로만 알리고 0으로 끝낸다.** 소스에 주석 한 줄이 늘어 지문만 움직인 경우가 그렇다. 사람이 읽을 목록을 남기는 것이 목적이다. 문서 내용까지 대조하는 리뷰 계획은 [문서 정확성 자동 리뷰 논의](../discussion/repository/topics/doc-accuracy-review.md)에 있다.

### 핀 범위와 예시 검사

- 소스는 모듈 단위로 핀한다. `src` 폴더 전체를 핀하면 파일 하나만 바꿔도 모든 문서가 한꺼번에 실패해 다시 읽지 않고 stamp하게 되므로, `check:docs`가 이를 오류로 막는다. `src/commands`처럼 모듈 폴더나 파일을 나열한다.
- `src` 아래의 모든 파일은 어느 문서든 **핀하거나 인용해야** 한다. 인용은 같은 지문을 같은 방식으로 지키므로 핀을 따로 두지 않아도 된다. 둘 다 없는 파일은 `check:docs`가 알린다. 규칙은 `tools/doc-sources.ts`의 `unpinnedSources`<!--s:d88deed8a300-->에 있다.
- 빠른 시작의 명령 예시는 `evals/doc-examples.test.ts`가 격리한 폴더에서 다시 실행해 줄마다 대조한다. 해시 게이트는 다시 읽으라고 알릴 뿐이지만, 이 검사는 예시가 실제 출력과 달라진 순간을 잡는다. 예시에 쓸 수 있는 명령은 `agctx`와 `mkdir`이다.

## 문서 근거 게이트

외부 사실의 출처가 언제 확인됐는지 남기고, 새 결정과 배포 지침이 근거를 밝히도록 `check:docs`가 세 가지를 검사한다. 확인일과 ADR 근거의 검사 로직은 `tools/doc-evidence.ts`에, 지침 카탈로그 검사는 `tools/check-docs.ts`의 `checkGuidanceCatalog`<!--s:c45ef0207675-->에 있다.

- **확인일:** `docs/references.md`에서 코드 블록 밖의 외부 링크(`http`·`https`)가 들어 있는 줄은 같은 줄에 `확인일: YYYY-MM-DD`가 있어야 한다. 목록 항목은 줄 끝에, 표 행은 마지막 칸 안에 붙인다.
- **ADR 근거:** 번호가 0009 이상인 ADR은 머리말에 `* **근거:**`(또는 `* **Evidence:**`)가 있어야 한다. 값에는 링크를 두거나, 외부 사실에 기대지 않는 결정이면 `외부 근거 없음: <이유>`(또는 `No external evidence: <reason>`)를 적는다. 0008 이전 ADR은 검사하지 않는다.
- **지침 카탈로그:** [지침 카탈로그](../reference/guidance-catalog.md)의 항목 표에는 지침 항목마다 행이 하나씩 있어야 하고, 각 행에는 `references.md`의 근거 절로 가는 링크가 있어야 한다. 행 수와 옵션 이름은 `GUIDANCE_KEYS`에서 읽으므로, 항목을 더하면 카탈로그에 행을 더하지 않은 채로는 검사를 통과할 수 없다. 근거 기준은 [ADR 0024](../adr/0024-guidance-evidence-and-budget.md)와 [ADR 0026](../adr/0026-guidance-items-and-evidence-tiers.md)에 있다.

게이트는 형식만 확인한다. 링크한 문서에 그 주장이 실제로 있는지는 확인일을 붙이는 사람이 직접 열어 확인해야 하며, 외부 링크가 살아 있는지도 검사하지 않는다.

## 코드를 가리키는 형식

문서는 코드를 복사하지 않고 가리킨다. 줄 번호는 위쪽에 줄이 하나만 생겨도 어긋나므로 쓰지 않고, 파일과 그 안의 이름으로 적는다. 그 옆에는 가리킨 코드의 지문이 주석으로 붙는다. 지문은 사람이 쓰지 않는다.

```text
① 사람이 쓴다      - 스킬 목록: `tools/generate-skills.ts`의 `SKILLS`
② --stamp 가 붙인다  - 스킬 목록: `tools/generate-skills.ts`의 `SKILLS`<!--s:bcadeaf70618-->
③ 누가 SKILLS 를 고친다
④ check:docs 가 실패한다
⑤ 그 항목을 다시 읽고 문서를 고친 뒤 --stamp 로 지문을 새로 적는다
```

④에서 나오는 실패 메시지는 이렇다. 어느 문서의 어느 인용인지까지 나온다.

```text
Documentation check failed:
- docs/contributing/implementation-mechanics.md: tools/generate-skills.ts의 SKILLS: 가리킨 코드가 바뀌었다. Re-read the document, then run `node tools/check-docs.ts --stamp`
```

### 무엇을 가리킬 수 있나

- **최상위 선언이나 키만 가리킨다.** TypeScript의 `export function`·`const`·`interface` 같은 선언, JSON의 키, YAML의 키다. 함수 안의 지역 이름은 잘라 낼 수 없어 지문을 만들 수 없으므로 `check:docs`가 실패시킨다.
- **이 저장소가 소유한 경로만 검사한다.** `src/`·`tools/`·`evals/`·`templates/`·`skills/`·`.agents/`·`.github/`·`docs/`와 루트 설정 파일이다. 다른 도구가 만드는 `apm.yml`이나 사용자 프로젝트에 생기는 `agctx.project.json`은 검사하지 않는다.
- **다른 Markdown 문서를 가리키는 인용에는 지문을 붙이지 않는다.** 그 문서의 문장은 계속 바뀌고, 가리키는 쪽이 그 내용을 설명하지도 않기 때문이다.
- **이력 문서는 대상이 아니다.** `docs/discussion/`·`docs/adr/`·`CHANGELOG.md`는 쓰던 당시의 인용을 그대로 둔다. 코드 블록 안의 예시도 검사하지 않으므로 옛 형식을 보여 줄 수 있다.

### 어떻게 계산하나

- 지문은 가리킨 대상을 파일에서 잘라 내 계산한다. TypeScript는 선언 한 덩어리, JSON은 그 키의 값, YAML은 그 키의 블록이다(`tools/symbol-source.ts`의 `citedText`<!--s:3c693c78b09f-->).
- 줄바꿈을 LF로 맞춘 뒤 계산하므로 CRLF로 체크아웃한 컴퓨터에서도 같은 값이 나온다. 공백과 주석은 빼지 않는다. 이 저장소는 코드 옆 주석을 이유의 정본으로 삼으므로, 주석이 바뀌면 문서를 다시 읽는 편이 맞다.
- 잘라 내는 일은 얕은 파서가 한다. 이 저장소가 최상위 선언만 인용하고, TypeScript 7이 JavaScript 파서 API를 제공하지 않기 때문이다. 인용한 이름을 모두 잘라 낼 수 있는지는 `evals/symbol-source.test.ts`가 검사한다.
- 형식 규칙은 `tools/doc-citations.ts`에, 검사는 `tools/check-docs.ts`의 `checkCitations`<!--s:5d3c250ef9b9-->에 있다.
- 결정과 측정은 [문서가 코드를 인용하는 방식](../discussion/repository/topics/code-citation-style.md)에 있다.

## 생성하는 레퍼런스

명령 등록부에서 뽑을 수 있는 내용은 사람이 옮겨 적지 않고 생성한다. `docs/reference/cli.md`의 명령 표와 명령마다의 사용법·종료 코드 줄, `docs/reference/exit-codes.md`의 명령별 종료 코드 표는 `<!-- agctx:generated:<이름>:start -->`와 `<!-- agctx:generated:<이름>:end -->` 사이에 있다. `node tools/generate-reference.ts`가 명령 등록부(`src/commands/registry.ts`)와 한국어 메시지 카탈로그의 명령 요약·종료 코드 이름으로 이 블록을 다시 쓰고, `--check`를 주면 다를 때 1로 끝난다.

- 명령 표의 `쓸 수 있는 곳` 열은 CLI에 더해, 등록부 항목에 `tui`가 있으면 TUI를, `profileMenu`가 있으면 프로필 메뉴를 적는다.
- `evals/reference-docs.test.ts`가 생성 결과와 파일 내용이 같은지, 명령마다 자기 절 안에 사용법 블록이 있는지, 명령 표가 등록부의 인터페이스를 빠짐없이 적는지 검사한다. 명령·옵션·종료 코드를 바꾸고 다시 생성하지 않으면 `pnpm run check`가 실패한다.
- 표지 밖의 설명·예시·표는 사람이 쓰며, 해시 게이트가 다시 읽게 한다.
- 새 명령을 등록하면 CLI Reference에 그 명령의 `###` 절과 사용법 표지를 먼저 만든 뒤 생성한다.

## 생성하는 논의 상태

논의 주제의 상태·중요도·선행 단계·핵심 결과는 [`docs/discussion/topics.json`](../discussion/topics.json) 한 파일에만 쓴다. 상태를 보여 주는 다른 자리는 모두 이 파일에서 생성하므로, 상태를 바꿀 때 사람이 고치는 파일은 이 파일 하나다. 다음은 그 파일의 첫 항목이다.

```json
{
  "stage": 1,
  "file": "profile-model.md",
  "title": "프로필 모델과 저장소",
  "titleEn": "Profile model and store",
  "importance": "Critical",
  "outcome": "named 프로필, scope, 경로, 소유권 계약",
  "status": "Implemented"
}
```

`node tools/generate-discussion-status.ts`가 이 파일로 아래 표지 사이를 다시 쓰고, `--check`를 주면 다를 때 1로 끝난다.

| 생성하는 곳 | 표지 이름 | 내용 |
| --- | --- | --- |
| 주제 문서 맨 위 | `status` | `**상태:** <status>` 한 줄 |
| 영역 색인 `docs/discussion/<영역>/README.md` | `topics` | 주제 표. `stage`가 있는 영역은 단계와 선행 단계 열을 더한다 |
| 아키텍처 색인의 단계 그림 | `stage-classes` | 단계 노드 `S<단계>`를 상태별로 칠하는 `class` 줄 |
| `README.md`·`README.en.md` | `discussion-status` | architecture 영역의 구현됨·구현 중·제안 단계 목록. 영어판은 `titleEn`을 쓴다 |

- 최상위 키는 논의 영역 이름이고, 배열 순서가 색인 표의 행 순서다. `stage`·`titleEn`·`importance`·`prerequisites`는 필요한 주제에만 둔다. 영어 README에 나오는 주제에 `titleEn`이 없으면 생성기가 실패한다.
- mermaid 안에서는 HTML 주석을 쓸 수 없으므로 단계 그림의 표지는 `%% agctx:generated:stage-classes:start`와 `%% agctx:generated:stage-classes:end`다. 그림의 노드·화살표와 그림 아래 설명은 사람이 쓴다. 새 단계를 더하면 그림에 `S<단계>` 노드를 먼저 만든다.
- `evals/discussion-status.test.ts`가 생성 결과와 파일 내용이 같은지 검사하므로, `topics.json`을 고치고 다시 생성하지 않으면 `pnpm run check`가 실패한다.
- `check:docs`는 `topics.json`을 읽어 다음을 검사한다. 영역의 `topics/` 폴더에 있는 문서는 목록에 정확히 한 번 있어야 하고, 목록에 있는 문서는 실제로 있어야 한다. 상태는 `tools/discussion-topics.ts`의 `STATUSES`<!--s:f0f4dd050848--> 가운데 하나여야 한다. `Implemented` 주제에는 구현 기록 제목이 있어야 하고, 구현 기록이 있는 주제는 `Proposed`일 수 없다. 주제 문서의 제안 요약에 적은 `중요도`의 첫 단어(`High — 이유`의 `High`)는 `importance`와 같아야 한다. 이유는 주제 문서에, 수준은 `topics.json`에 둔다. `Proposed`·`Implementing` 주제에는 제안 요약 항목이 모두 있어야 한다.
