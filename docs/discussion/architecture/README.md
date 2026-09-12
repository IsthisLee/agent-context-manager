# Agentic 아키텍처 구현 계획

이 문서는 제품 방향을 실제 구현 단계로 분해한 작업 지도다. 각 단계는 선행 계약·코드·평가·문서 갱신을 완료한 뒤 다음 단계로 넘어간다.

## 단계

| 단계 | 주제 | 핵심 결과 | 상태 |
| --- | --- | --- | --- |
| 1 | [Core 모델과 저장소](topics/core-model.md) | named Core, scope, 경로, 소유권 계약 | Implemented |
| 2 | [setup과 지침 옵션](topics/setup-and-guidance.md) | 선택 가능한 규칙 preset과 Core `AGENTS.md` | Implemented |
| 3 | [프로젝트 적용](topics/project-application.md) | 선택 Core를 프로젝트에 적용, 도메인 지침 분리 | Implemented |
| 4 | [에이전트 산출물 동기화](topics/agent-sync.md) | 도구별 포인터 생성·갱신·프로젝트 규칙 보존 | Implemented |
| 5 | [자연어 요청을 통한 Agentic 사용](topics/agent-mediated-usage.md) | 사람용 TUI와 에이전트용 비대화형 CLI의 책임·안전 경계 | Proposed |
| 6 | [Agentic 관리 산출물의 안전한 동기화](topics/managed-artifact-safety.md) | 관리 영역만 갱신하고 사용자 변경·충돌·복구를 보장하는 동기화 | Implementing |
| — | [구현 계약 및 문서 규칙](topics/implementation-contracts.md) | 단계별 구현·검증·문서 정합성 규칙 | Active process |

## 공통 구현 규칙

- Core의 공통 지침과 프로젝트의 도메인 지침은 서로 다른 저장 영역에 둔다.
- `AGENTS.md`는 공통 지침의 정본이다. 도구별 파일은 포인터 또는 생성 산출물이다.
- `setup`은 Core만 변경하고 프로젝트 파일을 변경하지 않는다.
- `apply`·`sync`는 사용자가 명시한 프로젝트에만 작동한다. `AGENTS.md`의 Core 소유 영역과 에이전트별 산출물의 Agentic 관리 블록만 갱신하고 각 사용자 영역은 보존한다. 적용·동기화 전 `--dry-run` 계획을 확인할 수 있으며, 기록된 관리 영역을 수동 수정하면 중단한다.
- 외부 에이전트 런타임을 실행·파싱·래핑하지 않는다.
- TUI는 사람의 탐색·승인을 위한 경로로, 에이전트·CI는 명시적 인자를 사용하는 비대화형 CLI 경로로 구분한다. 자연어 해석은 호출하는 에이전트의 책임이며, 대상·범위·파괴적 승인 여부를 추측하지 않는다.

## 진행 순서

1. Core의 파일 형식과 경로를 확정하고 생성·목록·선택 평가를 작성한다.
2. `setup`의 비대화형 옵션과 기본값을 확정하고 규칙 preset 평가를 작성한다.
3. 프로젝트 적용과 도메인 지침 보존을 구현한다.
4. 에이전트별 산출물과 동기화·drift 검사를 구현한다.
5. 매 단계마다 `docs/product-direction.md`, README, workflow, CHANGELOG를 정합화한다.
