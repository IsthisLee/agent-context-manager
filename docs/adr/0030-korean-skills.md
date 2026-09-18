# 0030. 에이전트용 스킬은 한국어로 쓴다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-18
* **결정자:** 제품 소유자
* **근거:** 외부 근거 없음: 대상 사용자와 문서 언어는 제품 소유자의 결정이며 외부 사실에 기대지 않는다.
* **관련:** [ADR 0014](0014-default-locale-english.md)가 정한 **CLI의 기본 로케일은 영어 그대로다.** 이 결정은 스킬 파일의 언어만 정한다. 스킬 배포는 [ADR 0019](0019-explain-verify-and-agent-skills.md), 어느 명령이 어느 스킬에 들어가는지는 [ADR 0029](0029-agent-surface-contract.md)가 정한다.

## 배경 (Context)

- `skills/agctx/SKILL.md`와 `skills/agctx-author/SKILL.md`는 영어로 쓰여 있었고, 생성되는 명령 목록도 영어 메시지 카탈로그(`src/i18n/messages-en.ts`)에서 왔다.
- 이 저장소의 문서는 한국어가 기본이고 `README.en.md`만 영어다. ADR 0014도 "저장소 문서는 지금처럼 한국어를 기본으로 두고 `README.en.md`를 함께 둔다"고 적었다. 스킬은 에이전트에게 주는 지침 문서인데 그 원칙 밖에 있었다.
- 스킬 호출 판단의 재료는 frontmatter의 `description`뿐이다([ADR 0029](0029-agent-surface-contract.md)). 사용자가 한국어로 요청하는데 설명이 영어면 그 대조가 한 겹 더 멀어진다.

## 검토한 대안 (Options)

| 대안 | 판단 |
| --- | --- |
| 영어를 유지한다 | 저장소 문서가 한국어인데 스킬만 영어다. 한국어 요청과 영어 설명을 대조하게 된다 |
| 한국어로 쓴다 | **채택.** 저장소 문서의 기본 언어와 맞고, 사용자의 요청 언어와도 맞는다 |
| 언어별 스킬을 둘로 만든다 | 스킬이 넷이 되고 설치 명령에 무엇을 고를지가 더해진다. skills CLI는 로케일을 다루지 않아 사용자가 직접 골라야 한다 |
| 설명만 두 언어로 쓴다 | 설명이 길어져 모든 대화에 상시 로드되는 분량이 늘어난다 |

## 결정 (Decision)

- 두 스킬의 본문과 `description`을 한국어로 쓴다. 절 제목(`## Pick the command`·`## Safety rules`·`## Commands`)과 명령·옵션·종료 코드는 원문 그대로 둔다. 절 제목은 평가가 찾는 표지이기도 하다.
- 생성되는 명령 목록은 `src/i18n/messages-ko.ts`에서 읽는다.
- `description`에는 영어 한 줄을 함께 둔다. `agctx` 스킬은 "Read and diagnose the agent guidance that agctx manages", `agctx-author` 스킬은 "Create, change, and roll out an agctx profile"이다. 한국어를 쓰지 않는 사용자의 에이전트도 스킬의 용도를 알 수 있게 하고, 두 스킬을 혼동하지 않게 한다.
- `agctx-author`의 안전 규칙 가운데 "Never add `--yes` on your own." 한 문장은 영어로 남긴다. 어느 언어로 일하는 에이전트에게도 같은 금지로 읽히게 한다.
- **CLI 출력은 바뀌지 않는다.** ADR 0014의 기본 로케일 영어는 그대로이고, `AGCTX_LANG=ko`로 한국어를 고르는 방식도 그대로다.

## 결과 및 영향 (Consequences)

- 한국어를 쓰지 않는 사용자가 GitHub에서 스킬을 설치하면 한국어 스킬을 받는다. 에이전트는 두 언어를 모두 다루므로 명령 실행에는 문제가 없고, `description`의 영어 한 줄이 용도를 알려 준다. 영어 스킬이 필요하다는 요구가 오면 그때 언어별 스킬을 새 ADR로 정한다.
- `tools/generate-skills.ts`가 한국어 카탈로그를 읽으므로, 명령 요약을 고칠 때 `messages-ko.ts`를 고쳐야 스킬에 반영된다. `messages-en.ts`는 CLI 출력용으로 계속 유지한다.
- `evals/skills.test.ts`의 승인 규칙 검사에서 `approv`를 찾던 단언을 `승인`으로 바꿨다. `Never add \`--yes\`` 단언은 그대로다.
- 사용자 문서 [에이전트에게 agctx를 맡기기](../guides/agent-skills.md)는 이미 한국어이므로 바뀌지 않는다.
