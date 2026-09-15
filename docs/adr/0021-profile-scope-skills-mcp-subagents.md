# 0021. 프로필이 담을 대상을 규칙·스킬·MCP·subagents로 정한다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-16
* **결정자:** 제품 소유자
* **근거:** 외부 근거 없음: 프로필이 담을 대상은 제품 범위에 관한 결정이다. 대상마다 에이전트가 읽는 위치와 형식은 구현할 때 [프로필 설정 표면 확장](../discussion/architecture/topics/profile-config-surface.md) 논의에서 근거와 함께 정한다.
* **관련:** [ADR 0001](0001-product-scope.md)의 제품 범위를 넓힌다. [ADR 0013](0013-rename-agent-context-manager.md)이 정한 이름 Agent Context Manager의 "컨텍스트"가 무엇을 담는지 정한다. 구현 순서와 안전 병합 계약은 [프로필 설정 표면 확장](../discussion/architecture/topics/profile-config-surface.md) 논의가 맡는다.

## 배경 (Context)

- 지금 프로필은 규칙(`AGENTS.md`·`CLAUDE.md`·`.agents/rules`)만 담는다. 제품 방향 「범위와 경계」도 지침의 생성·설정·동기화·적용만 담당 범위로 적었다.
- 문서마다 확장 대상이 달랐다. README의 지향점은 "규칙·스킬·MCP", 현재 범위 문장은 "스킬·MCP·Hooks"였고, 논의 문서는 "MCP·skills·subagents"를 적으면서 subagents가 제품 방향의 경계 어느 쪽에도 명시돼 있지 않다고 적었다.
- 팀이 함께 쓰는 에이전트 환경에는 규칙뿐 아니라 공유 스킬, MCP 서버 설정, subagent 정의가 들어간다. 이들이 프로필 밖에 있으면 규칙은 같아도 에이전트의 능력·도구·역할 설정은 개발자마다 갈린다.

## 검토한 대안 (Options)

| 대안 | 판단 |
| --- | --- |
| 규칙·스킬·MCP만 확정하고 subagents는 후보로 둔다 | 팀이 정한 subagent 정의를 함께 쓰는 경우가 범위 밖에 남는다 |
| 규칙·스킬·MCP·subagents를 확정한다 | **채택.** 에이전트가 따르는 규칙·능력·도구·역할 정의를 한 프로필로 공유한다 |
| Hooks·출력 스타일까지 확정한다 | 이번 결정에 넣지 않는다. 필요하면 새 ADR로 정한다 |

## 결정 (Decision)

- 프로필이 담을 에이전트 컨텍스트는 규칙, 스킬, MCP 서버 설정, subagent 정의 네 가지다. agctx는 이 네 가지의 생성·설정·동기화·적용과, 적용한 내용이 에이전트에 닿는지 확인하는 일을 담당한다.
- 지금 구현된 것은 규칙뿐이다. 스킬·MCP·subagents는 확정된 범위지만 아직 동작하지 않으므로, README와 문서는 구현하기 전까지 현재 동작처럼 쓰지 않는다.
- Hooks와 출력 스타일은 이 결정에 넣지 않는다.
- 구현 순서, 대상별 프로필 안의 형식과 프로젝트에 둘 위치, Markdown 밖 설정 형식의 안전 병합 계약은 [프로필 설정 표면 확장](../discussion/architecture/topics/profile-config-surface.md) 논의에서 정한다. 규칙의 [안전한 동기화](../discussion/architecture/topics/managed-artifact-safety.md)가 먼저 굳어야 한다는 선행 조건은 그대로다.
- 모델 호출·인증·세션·에이전트 런타임 오케스트레이션을 담당하지 않는다는 경계는 바뀌지 않는다. subagent도 정의 파일을 전달할 뿐 실행하거나 조율하지 않는다.

## 결과 및 영향 (Consequences)

- 제품 방향 「범위와 경계」, README·README.en의 지향점과 현재 범위 문장, 논의 문서의 범위 서술을 이 결정에 맞춘다. README의 "스킬·MCP·Hooks" 표기는 "스킬·MCP·subagents"로 바뀐다.
- 스킬·MCP·subagents 중 무엇을 먼저 구현할지는 이 결정에서 정하지 않는다. 논의 문서의 현재 권장은 MCP부터다.
- 대상이 늘면 관리 영역 hash·base·충돌 정지 계약을 JSON·TOML 같은 설정 형식으로 넓혀야 한다. 이는 새 안전 경계이므로 구현 전에 논의 문서의 결정·검증 항목을 먼저 닫는다.
