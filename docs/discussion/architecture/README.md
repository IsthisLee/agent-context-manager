# Architecture Discussion

최종 확인일: **2026-09-12**

이 디렉터리는 아직 채택되지 않았거나 구현 중인 아키텍처 논의의 진입점이다. 주제별 문서는 [`topics/`](topics/)에 두며, 확정된 결정은 ADR로 기록한 뒤 [`../../architecture/`](../../architecture/)에 반영한다.

## 논의 지도

| 문서 | 다루는 내용 | 대상 계층 | 중요도 | 권장 순서 | 상태 |
|---|---|---|---|---|---|
| [verification.md](topics/verification.md) | 검증 명령, 증거 형식, 테스트 수 정책 | 패키지·프로젝트·에이전트 | Critical | 1 | Proposed |
| [sync-and-artifacts.md](topics/sync-and-artifacts.md) | artifact, sync, manifest, 롤백 | 패키지·프로젝트 | High | 2 | Proposed |
| [operations-and-release.md](topics/operations-and-release.md) | doctor, sync, workflow, 릴리즈 개선 | 패키지·프로젝트·사용자 | High | 3 | Proposed |
| [core-management-and-application.md](topics/core-management-and-application.md) | 개인·조직 Core 생성·등록·적용·재현 | 사용자·패키지·프로젝트 | Critical | 결정 1 / 구현 4 | Proposed |
| [adaptive-harness.md](topics/adaptive-harness.md) | ProjectProfile, 역할 계약, Solo·가상 팀 선택 | 패키지·프로젝트·에이전트 | High | 5 | Proposed |
| [ecosystem-follow-ups.md](topics/ecosystem-follow-ups.md) | 생태계 비교에서 도출한 구현 우선 과제 | 설계 우선순위 | Medium | 참조 | Proposed |
| [external-tools.md](topics/external-tools.md) | revfactory/harness와의 관계 | 외부 근거 | — | 참조 | Active reference |
| [implementation-contracts.md](topics/implementation-contracts.md) | 상태 관리와 구현 기록 규약 | 문서·운영 | — | 상시 | Active process |

## 현재 공백과 목표

| 요구사항 | 현재 상태 | 개편 방향 |
|---|---|---|
| 프로젝트 분석 | 기술 제약을 Markdown으로 감지 | 구조화된 `ProjectProfile` 생성 |
| 역할 정의 | 공통 TDD 지침만 존재 | Planner, Builder, Reviewer, Verifier 계약 |
| 역할 선택 | 공통 루프만 존재 | 복잡도·위험도·병렬성 기반 선택 |
| 결정론적 평가 | 종료 코드와 성공 여부 기록 | 명령·증거·테스트 수 계약 강화 |
| handoff | 전달 artifact 없음 | 필요한 경우에만 파일 기반 artifact |

```text
agentic analyze → ProjectProfile → Role Policy
  ├─ 일반 작업 → Solo Agent
  ├─ 넓거나 불명확한 작업 → Planner 추가
  ├─ 고위험 변경 → Reviewer + Verifier
  └─ 독립 병렬 작업 → Virtual Team
                         │
                         └→ npm run check
```

Agentic은 에이전트 팀을 항상 실행하는 오케스트레이터가 아니라, 프로젝트를 분석해 필요한 역할만 선택하고 기본적으로는 한 에이전트의 작업을 결정론적으로 검증하는 adaptive harness를 목표로 한다.

## 권장 구현 순서

1. `ProjectProfile`과 `agentic analyze`를 eval로 고정한다.
2. 역할 계약과 `role-policy.mjs`를 추가한다.
3. `agentic plan`과 필요한 artifact를 추가한다.
4. 검증 증거와 동기화 manifest를 강화한다.
5. 각 계약을 구현·검증한 뒤 상태를 갱신하고, 장기적 결정은 ADR로 채택한다.
