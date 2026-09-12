# Core 모델과 저장소

**상태:** Implemented

## 제안 요약

### 목적과 이유

| 항목 | 내용 |
| --- | --- |
| 제안 목표 | 용도별 공통 지침 저장소를 생성·식별·선택할 수 있게 한다. |
| 제안 이유 | 하나의 내장 템플릿만으로는 개인·회사·팀·workspace별 공통 정책을 독립적으로 관리할 수 없다. |

### 범위와 우선순위

| 항목 | 내용 |
| --- | --- |
| 대상 계층 | 사용자·조직, Agentic CLI, Core 저장소 |
| 결정할 것 | Core 경로, 이름 규칙, scope metadata, 기본 Core, 여러 Core 선택 방식 |
| 중요도 | Critical — 모든 후속 CLI와 프로젝트 적용의 기반 |

### 의존성과 실행 순서

| 항목 | 내용 |
| --- | --- |
| 선행 작업 | 제품 용어·소유권 확정 |
| 선행 제안 | 없음 |
| 후속 제안 | [setup과 지침 옵션](setup-and-guidance.md), [프로젝트 적용](project-application.md) |
| 연관 제안 | [에이전트 산출물 동기화](agent-sync.md) |
| 후속 작업 | Core create/list/use와 경로 안전성 평가 |
| 권장 다음 작업 | 최소 `CoreMetadata`와 저장 경로 계약을 평가로 고정 |

## 목표 계약

Core는 사용자 또는 조직이 소유하는 공통 지침 저장소다. `Personal`, `Company`, `Team`, `Workspace`는 고정된 시스템 종류가 아니라 Core의 용도 또는 metadata다.

권장 기본 경로는 `~/.agentic-cores/<name>`이며, 조직 Core는 사용자가 관리하는 별도 Git 저장소도 선택할 수 있어야 한다. 패키지 설치·업데이트는 Core 파일을 자동 변경하지 않는다.

```text
~/.agentic-cores/<name>/
├── AGENTS.md          # Core 공통 지침 정본
└── agentic-core.json  # 이름·용도·schema metadata
```

Core 생성은 프로젝트를 변경하지 않는다. Core를 선택해 프로젝트에 적용하는 작업은 별도의 명령과 승인 흐름으로 둔다.

#### 구현 기록: Core 생성·목록

* **결정:** 사용자 홈의 `.agentic-cores/<name>`에 Core를 저장하고 `personal`, `company`, `team`, `workspace` scope를 metadata로 기록한다.
* **구현:** `agentic core create`, scope별 `agentic core list`와 Core 관리 메뉴, TUI Core 선택·삭제, `agentic core remove`, `agentic-core.json`, Core `AGENTS.md` 생성.
* **평가:** `evals/core.test.mjs`에서 생성·목록·이름·scope·metadata를 확인.
* **제약:** 조직 원격 Git 등록·동기화는 아직 지원하지 않는다.
* **다음 단계:** Core 업데이트와 조직 공유 계약.
