# External Tools

[`revfactory/harness`](https://github.com/revfactory/harness)는 Claude Code 환경에서 도메인별 에이전트 팀과 전문 스킬을 설계하는 meta-skill이다. Agent Teams와 Subagents 실행 모드를 제공한다.

| 구분 | `revfactory/harness` | `agentic` |
|---|---|---|
| 주요 역할 | Claude Code 내부의 팀·스킬 구성 | 여러 에이전트의 규칙·검증 계약 |
| 핵심 문제 | 전문 에이전트와 팀 패턴 선택 | 규칙 파편화와 검증되지 않은 완료 보고 |
| 기본 접근 | 필요에 따라 Agent Teams/Subagents 구성 | 단일 에이전트 + `npm run check` 기본 루프 |

Agentic은 멀티 에이전트를 금지하지 않는다. 기본은 단일 에이전트이며, 복잡도·위험도·병렬성이 정당화할 때만 추가 역할을 선택한다. Anthropic의 장기 코딩 하네스 실험도 멀티 에이전트의 품질 이점과 큰 비용을 함께 보여주며, 작업 난이도에 따라 Planner·Verifier를 선택하는 방향을 제시한다. ([Anthropic 원문](https://www.anthropic.com/engineering/harness-design-long-running-apps))
