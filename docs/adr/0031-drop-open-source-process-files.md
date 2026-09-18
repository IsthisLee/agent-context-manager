# 0031. 한 사람이 만드는 프로젝트에 맞게 공개 운영 파일을 줄이고 라이선스를 MIT로 바꾼다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-18
* **결정자:** 제품 소유자
* **근거:** 외부 근거 없음: 프로젝트의 규모 판단과 라이선스 선택은 제품 소유자의 결정이며 외부 사실에 기대지 않는다. GitHub community profile이 무엇을 점검하는지는 [공개 npm·GitHub 저장소 운영 근거](../references.md#공개-npmgithub-저장소-운영-근거)에 있다.
* **관련:** 공개 저장소 운영 파일 구성의 정본인 [릴리스와 저장소 운영](../contributing/releasing.md)을 줄인다. 그 구성을 정한 ADR은 없고 문서로만 관리해 왔다. 검증·게시 workflow와 `SECURITY.md`는 그대로다.

## 배경 (Context)

- 공개 저장소 운영 파일을 갖춰 두었다. 기여 안내, 행동 규범, 이슈 템플릿 셋, `CODEOWNERS`, OpenSSF Scorecard workflow다.
- 그 뒤 실제로 일어난 일은 이렇다. 기여자는 제품 소유자 한 명이고, 외부 이슈는 없었으며, dependabot이 만든 PR 넷 말고는 PR도 전부 본인 것이다.
- 제품 소유자는 2026-09-18에 시장 조사 결과를 근거로 이 패키지가 널리 쓰이지 않을 것으로 판단했다.
- 이 파일들은 **여러 사람이 상호작용할 때** 값어치가 생긴다. 행동 규범은 사람 사이의 규범이고, 이슈 템플릿은 낯선 사람의 제보를 정리하며, `CODEOWNERS`는 소유자가 여럿일 때 리뷰를 배정한다. 지금은 셋 다 해당하지 않는다.
- Scorecard는 성격이 다르다. 공급망 신뢰 점수를 **외부에 보이는** 장치인데, 같은 날 README에서 점수 뱃지를 뺐으므로 볼 사람이 없어졌다. 주 1회 실행하고 `id-token: write`를 쓴다.

## 검토한 대안 (Options)

| 대안 | 판단 |
| --- | --- |
| 전부 유지한다 | 동작하지 않는 절차를 유지한다. 기여 안내를 고칠 때마다 읽을 사람이 없는 문서를 손본다 |
| 보안 관련만 남기고 나머지를 뺀다 | **채택.** 무언가를 막거나 알리는 파일은 남기고, 절차를 보여 주기만 하는 파일은 뺀다 |
| 전부 뺀다 | 취약점 신고 경로가 사라진다. npm에 공개돼 있으므로 그 경로는 있어야 한다 |
| 저장소를 비공개로 돌린다 | npm에 이미 게시했고 스킬을 GitHub에서 설치하므로 공개여야 한다 |

## 결정 (Decision)

### 빼는 것

| 파일 | 이유 |
| --- | --- |
| `CODE_OF_CONDUCT.md` | 사람 사이의 규범이고 사람이 한 명이다 |
| `CONTRIBUTING.md` | `AGENTS.md`와 `docs/contributing/`이 같은 내용을 더 자세히 담는다 |
| `.github/CODEOWNERS` | 소유자가 한 명이면 배정할 것이 없다 |
| `.github/ISSUE_TEMPLATE/` 세 개 | 외부 이슈가 없다. GitHub 기본 폼으로 충분하다 |
| `.github/workflows/scorecard.yml` | 점수를 보이는 장치인데 뱃지를 뺐다 |

### 남기는 것

무언가를 **막거나 알리는** 파일은 남긴다.

| 파일 | 이유 |
| --- | --- |
| `SECURITY.md` | npm에 공개돼 있어 취약점 신고 경로가 필요하다. GitHub 보안 탭에 노출된다 |
| `.github/workflows/dependency-review.yml` | dependabot이 여는 PR이 자동으로 들어오는 유일한 외부 변경 경로이고, `fail-on-severity: high`가 그 자리를 막는다. CI의 `pnpm run audit`은 설치된 트리 전체를 보고 이것은 PR의 diff를 본다 |
| `.github/workflows/codeql.yml` | 코드와 워크플로를 실제로 검사한다([ADR 0029](0029-agent-surface-contract.md)와 무관하게 같은 날 `actions` 언어를 더했다) |
| `.github/dependabot.yml` | PR 넷을 실제로 만들었다 |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR 본문 형식으로 실제로 쓴다 |
| `ci.yml`·`publish.yml` | 검증과 게시 |

### 라이선스

Apache-2.0에서 **MIT**로 바꾼다. 저작권자가 한 명이라 재라이선스할 수 있다. Apache-2.0의 특허 조항과 변경 고지 요구는 이 규모에서 읽는 사람에게 부담만 된다.

## 결과 및 영향 (Consequences)

- **이미 게시한 0.3.0과 0.3.1은 Apache-2.0으로 남는다.** npm의 그 버전들을 받은 사람은 그 조건을 그대로 쓴다. MIT는 다음 게시 버전부터다.
- `tools/check-docs.ts`의 필수 파일 목록에서 `CONTRIBUTING.md`와 `CODE_OF_CONDUCT.md`를 뺐다. `evals/repository-operations.test.ts`는 남은 파일의 존재를 검사하고, **뺀 파일이 다시 들어오지 않는지도 검사한다.** 되돌리려면 그 평가를 함께 고쳐야 한다.
- GitHub의 community profile 점검에서 기여 안내와 행동 규범 항목이 빈다. 그 점검은 공개 저장소에 권고 사항을 보여 주는 것이고 동작을 막지 않는다.
- README 두 개의 「공개 프로젝트 참여」 절은 링크 목록에서 한 문장 설명으로 바뀐다. 기여 절차를 두지 않는다는 사실과 이슈·보안·개발 규약 세 경로를 적는다.
- 줄어든 분량은 182줄이다.
