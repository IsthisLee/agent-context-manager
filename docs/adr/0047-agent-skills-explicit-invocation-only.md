# 0047. 에이전트용 스킬 두 개 모두 사용자가 이름으로 부를 때만 쓴다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-23
* **결정자:** 제품 소유자
* **근거:** [에이전트 지침 로드와 전달 확인 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)의 Claude Code `disable-model-invocation`, Codex `allow_implicit_invocation` 항목과 2026-09-23 직접 실험
* **관련:** [ADR 0019](0019-explain-verify-and-agent-skills.md)의 "진단 스킬 `agctx`는 자동 발동 허용"을 대체한다. 게시 스킬 `agctx-author`의 결정과 [ADR 0029](0029-agent-surface-contract.md)의 명령별 `agent` 정책(`auto`·`ask`·`never`)은 그대로 둔다.

## 배경 (Context)

- ADR 0019는 읽기만 하는 진단 스킬 `agctx`를 에이전트가 대화 내용을 보고 스스로 불러 쓰게 했다. 바꾸는 일을 하는 `agctx-author`만 이름으로 부를 때 쓰게 했다.
- 제품 소유자는 에이전트가 agctx를 쓰는 것 자체를 사용자가 명시적으로 부른 때로 한정하기를 원한다. 읽기 전용이어도 `check --refresh`는 원격을 조회하고, `verify`는 세션 기록을 읽는다. 사용자가 부르지 않은 도구가 대화 중에 끼어드는 것도 원하지 않는다.
- Claude Code는 `disable-model-invocation: true`, Codex는 `agents/openai.yaml`의 `policy.allow_implicit_invocation: false`로 스킬을 이름으로 부를 때만 쓰게 한다. Antigravity 문서에는 자동 호출을 끄는 설정이 없다(확인일: 2026-09-23).

## 검토한 대안 (Options)

| 대안 | 판단 |
| --- | --- |
| 두 스킬 모두 이름으로 부를 때만 쓴다 | **채택.** 사용자가 `/agctx`·`/agctx-author`로 부른 때만 에이전트가 agctx를 쓴다 |
| 지금처럼 진단 스킬은 스스로 쓰게 둔다 | 사용자가 원하지 않는 호출이 생긴다 |
| 진단 스킬을 없애고 게시 스킬 하나로 합친다 | 읽기 명령까지 승인 규칙을 따르게 되고, 스킬 두 개로 나눈 권한 경계(ADR 0029)가 흐려진다 |

## 결정 (Decision)

1. `skills/agctx/SKILL.md`에 `disable-model-invocation: true`를 두고, `skills/agctx/agents/openai.yaml`에 `allow_implicit_invocation: false`를 둔다. `agctx-author`는 이미 그렇다.
2. 두 스킬의 본문과 `description`에 "사용자가 `/이름`으로 명시적으로 부를 때만 쓴다"를 적는다. Antigravity처럼 설정으로 막지 못하는 에이전트에는 이 규칙이 유일한 장치다.
3. 명령별 `agent` 정책은 그대로다. `auto` 명령은 불린 뒤 승인 없이 실행하고, `ask` 명령은 `--dry-run`을 보여 주고 승인받는다.

## 결과 및 영향 (Consequences)

- 사용자가 "지침이 최신인지 봐 줘"처럼 말해도 에이전트는 agctx 스킬을 쓰지 않는다. `/agctx 지침이 최신인지 봐 줘`처럼 불러야 한다.
- Antigravity는 본문 규칙을 따르는지에 기대므로, 스스로 쓰지 않는다고 보장하지 못한다.
- 스킬을 거치지 않고 에이전트가 셸에서 `agctx`를 바로 실행하는 것은 CLI가 구분할 수 없으므로 막지 않는다. 이 결정은 스킬을 스스로 불러오는 것만 막는다.
- 이미 설치한 스킬은 `agctx install`을 다시 실행해야 새 설정을 받는다. 설치한 스킬과 CLI의 버전이 다르면 모든 명령이 알린다.
