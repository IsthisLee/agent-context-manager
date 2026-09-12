# Ecosystem Comparison Follow-ups

**상태:** Proposed

## 제안 요약

### 핵심 정보

| 항목 | 내용 |
| --- | --- |
| 대상 계층 | 패키지 방향·설계 우선순위, 대상 프로젝트 동기화·진단·검증 계약 |
| 제안 목표 | 외부 도구 비교에서 확인한 격차를 Agentic의 책임 경계에 맞는 검토·구현 과제로 연결한다. |
| 제안 이유 | 비교 결과를 단순 목록으로만 두면 중복 구현이나 제품 방향과 맞지 않는 기능 확장이 발생할 수 있다. |
| 결정할 것 | 수용할 격차의 우선순위·각 격차의 정본 제안 문서·기능 확장 제외 기준 |
| 중요도 | Medium — 외부 비교를 구현 과제로 번역하지만, 독립적인 기능 계약은 아님 |

### 제안 관계

| 항목 | 내용 |
| --- | --- |
| 선행 작업 | 비교 근거는 `references.md`에 유지하고, 각 기능의 정본 제안 문서를 식별 |
| 선행 제안 | 없음 — 외부 근거를 연결하는 인덱스 성격의 문서 |
| 후속 제안 | [Verification Contract](verification.md), [Sync and Artifact Contracts](sync-and-artifacts.md), [Operations and Release Contracts](operations-and-release.md), [Adaptive Harness](adaptive-harness.md) |
| 연관 제안 | [Core Management and Application](core-management-and-application.md) |

### 추진 계획

| 항목 | 내용 |
| --- | --- |
| 후속 작업 | verification·sync·operations·adaptive-harness 문서에서 개별 계약·eval·ADR 확정 |
| 권장 다음 작업 | 이 문서 자체를 구현 대상으로 삼지 말고, 연결된 제안의 우선순위·수용 기준에 따라 작업 선택 |

## 목차

1. 외부 비교에서 도출한 우선 과제
2. 채택 기준
3. 권장 작업 순서

이 문서는 [오픈소스 생태계 비교](../../../references.md#2-2026년-오픈소스-생태계-도구와의-비교-분석)에서 확인한 기능 격차를 Agentic의 설계·구현 과제로 전환한다. 외부 도구의 기능을 그대로 복제하지 않고, Agentic의 런타임 비소유·Solo 기본·프로젝트 네이티브 검증 경계에 맞는지 평가한다.

## 우선 과제

| 우선 과제 | 외부 근거 | 현재 공백 | 검토 방향 |
|---|---|---|---|
| 동기화 투명성 | Ruler, agents-sync의 drift·CI 검사 | 생성 파일 manifest, `sync --dry-run`, `sync --check` 없음 | [Sync and Artifact Contracts](sync-and-artifacts.md)에 manifest·dry-run·CI 검사 계약을 구체화하고 eval로 고정 |
| 대상 프로젝트 진단 | agents-lint, ctxlint, Harness Doctor의 정적 진단 | `doctor`는 지침 파일 존재·크기와 일부 환경만 검사 | [Operations and Release Contracts](operations-and-release.md)에 스크립트·도구·증거·생성 버전의 읽기 전용 진단 계약을 추가 |
| 증거 범위 분리 | agents-sync의 규칙 lint, Spec-Driven Harness의 단계별 게이트 | `last-check.json`은 검증 명령 성공만 증명하며 지침 준수는 증명하지 않음 | [Verification Contract](verification.md)에 실행 증거와 규칙 준수 평가를 분리해 정의; 규칙 준수 강제는 신뢰할 수 있는 기계 규칙부터 선택적으로 도입 |
| 선택적 작업 artifact | Spec-Driven Harness의 명세·독립 검증·handoff | 작업별 plan·review·검증 artifact 계약 없음 | [Adaptive Harness](adaptive-harness.md)와 [Sync and Artifact Contracts](sync-and-artifacts.md)에 따라 고위험·장기·병렬 작업에서만 artifact를 생성 |
| 스킬·MCP 설치 범위 | agent-install의 스킬·MCP 배포 | Agentic은 지침과 검증 도구만 동기화 | 스킬·MCP 설치를 기본 범위로 확장하지 않는다. 필요성이 확인되면 보안·버전·롤백 영향을 ADR로 검토 |

## 채택 기준

각 과제는 다음을 모두 만족할 때 구현한다.

1. 공식 에이전트 런타임의 인증·세션·출력 처리로 책임 범위가 확장되지 않는다.
2. 일반적인 작은 작업의 Solo 루프에 상시 오버헤드를 추가하지 않는다.
3. 공개 계약, 실패 모드, 롤백 방법을 문서화하고 eval로 검증할 수 있다.
4. 새 동작이 대상 프로젝트의 기존 도구·규칙을 추측해 덮어쓰지 않는다.

구현 후에는 이 문서의 해당 행에 구현 기록·eval·ADR 링크를 추가하고, 현재 사실이 되면 `docs/architecture/`로 옮긴다.

## 권장 작업 순서

1. [검증 계약](verification.md)과 [sync·artifact 계약](sync-and-artifacts.md)의 안전성·투명성 공백을 먼저 줄인다.
2. 그 결과를 이용해 [운영·릴리즈 계약](operations-and-release.md)의 `doctor`·CI 진단을 구체화한다.
3. [Adaptive Harness](adaptive-harness.md)는 기본 Solo 흐름을 방해하지 않는 독립 eval부터 진행한다.
4. 스킬·MCP 설치 범위는 별도 사용자 요구와 ADR 없이는 확장하지 않는다.
