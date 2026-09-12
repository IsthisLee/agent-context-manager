# 프로젝트 적용

**상태:** Implemented

## 제안 요약

| 항목 | 내용 |
| --- | --- |
| 대상 계층 | 사용자·Agentic CLI·Core·대상 프로젝트 |
| 제안 목표 | 사용자가 선택한 Core의 공통 지침을 프로젝트에 적용하고 프로젝트 도메인 지침을 독립적으로 보존한다. |
| 제안 이유 | 공통 정책과 제품별 규칙을 한 파일에 무분별하게 섞으면 Core 재사용과 프로젝트 자율성이 깨진다. |
| 결정할 것 | 적용 명령, 대상 파일, 기존 `AGENTS.md` 병합, 승인·dry-run, Core 선택 기록 |
| 중요도 | Critical — 실제 사용자 프로젝트를 변경하는 가장 큰 경계 |
| 선행 작업 | Core 모델·setup 옵션 계약 |
| 선행 제안 | [Core 모델과 저장소](core-model.md), [setup과 지침 옵션](setup-and-guidance.md) |
| 후속 제안 | [에이전트 산출물 동기화](agent-sync.md) |
| 연관 제안 | 없음 |
| 후속 작업 | `agentic init --core <name> <project>`와 병합·dry-run 평가 |
| 권장 다음 작업 | 기존 도메인 규칙을 보존하는 최소 병합 규칙 확정 |

## 목표 계약

적용은 선택한 Core의 공통 `AGENTS.md`를 프로젝트에 주입하고, 프로젝트의 도메인 지침은 프로젝트 쪽 확장 영역에 둔다. Core의 원본은 변경하지 않는다.

```text
Core/AGENTS.md                  # 공통 지침 정본
        │ agentic init --core
        ▼
project/AGENTS.md               # 적용된 공통 지침 + 프로젝트 도메인 지침
```

적용 전에는 변경 파일과 기존 사용자 내용의 보존 여부를 보여 준다. 기존 프로젝트 파일을 자동으로 덮어쓰거나 Core에 프로젝트 지침을 역동기화하지 않는다.

#### 구현 기록: Core 프로젝트 적용

* **결정:** `agentic init --core <name> <project>`가 선택 Core를 프로젝트에 적용하고 `agentic.project.json`에 선택을 기록한다.
* **구현:** 공통 `AGENTS.md`, 에이전트별 포인터, 프로젝트 확장 영역 병합.
* **평가:** Core 적용·재동기화·Core 원본 불변·존재하지 않는 Core의 무변경 실패를 확인.
* **제약:** 적용 전 dry-run과 복잡한 충돌 시각화는 후속 작업이다.
* **다음 단계:** 사용자 확인이 포함된 dry-run.
