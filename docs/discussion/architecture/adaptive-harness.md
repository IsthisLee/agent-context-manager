# Adaptive Harness

**상태:** Proposed

## ProjectProfile

기존 `detectProjectConstraints()`를 유지하되, `agentic analyze [path] [--json]`가 읽기 전용 구조화 결과를 반환한다.

```json
{
  "schemaVersion": 1,
  "name": "example-project",
  "language": "typescript",
  "frameworks": ["next-app-router"],
  "packageManager": "pnpm",
  "sourceDirs": ["src"],
  "testDirs": ["tests"],
  "scripts": { "test": "pnpm test", "check": "pnpm run check" },
  "hasAgentsMd": true,
  "hasAdr": false,
  "riskSignals": ["database", "public-api"]
}
```

* 필드는 `schemaVersion`으로 관리한다.
* 감지하지 못한 값은 추측하지 않고 `null` 또는 빈 배열로 기록한다.
* `.env`, 인증 정보, 소스 코드 본문, 대화 로그는 읽거나 결과에 넣지 않는다.

## 역할 계약

| 역할 | 책임 | 최소 결과물 |
|---|---|---|
| Planner | 작업 단위, 범위, 완료 조건 정의 | `plan.md` |
| Builder | 테스트 우선 구현과 최소 변경 | 코드와 테스트 |
| Reviewer | 고위험 변경의 독립 검토 | `review.md` |
| Verifier | `npm run check`와 증거 확인 | `last-check.json` |

기본 작업에서는 한 에이전트가 Planner → Builder → Verifier 역할을 순서대로 수행한다. 상세 운영 지침은 구현 시 `templates/AGENTS.md`와 `docs/workflow.md`에 반영한다.

## 역할 선택 정책

`agentic plan --task "..."`는 작업 범위, 위험도, 요구사항 명확성, 병렬 가능성을 입력으로 사용한다.

| 신호 | 권장 모드 |
|---|---|
| 작고 명확한 버그 수정·테스트 보강 | `SOLO` |
| 여러 모듈 또는 불명확한 완료 조건 | `SOLO_WITH_PLAN` |
| 보안·권한·결제·마이그레이션·배포 영향 | `SOLO_WITH_REVIEW` |
| 독립 작업 단위가 둘 이상이고 병렬 이득이 명확함 | `VIRTUAL_TEAM` |

`SOLO`가 기본값이다. 가상 팀은 작업 단위가 독립적이고 역할 간 artifact와 완료 기준이 명확할 때만 사용한다. 의존성이 예상보다 커지거나 실패가 반복되면 팀을 늘리지 않고 `SOLO_WITH_PLAN`으로 축소하거나 사용자에게 에스컬레이션한다.

```text
Recommended mode: SOLO_WITH_REVIEW
Roles: Planner optional / Builder primary / Reviewer required / Verifier required
```
