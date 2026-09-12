# setup과 지침 옵션

**상태:** Implemented

## 제안 요약

| 항목 | 내용 |
| --- | --- |
| 대상 계층 | 사용자·Agentic CLI·Core `AGENTS.md` |
| 제안 목표 | Core 생성 후 필요한 에이전틱 개발 지침을 선택해 재현 가능한 정본을 만든다. |
| 제안 이유 | 모든 사용자에게 동일한 TDD·리뷰·문서화 정책을 강제하지 않으면서 안정적인 기본값을 제공해야 한다. |
| 결정할 것 | preset 목록, 기본값, 옵션 schema, 대화형·비대화형 동작, 재실행·삭제 정책 |
| 중요도 | High — Core의 실제 정책을 결정하는 사용자 경계 |
| 선행 작업 | [Core 모델과 저장소](core-model.md) |
| 선행 제안 | [Core 모델과 저장소](core-model.md) |
| 후속 제안 | [프로젝트 적용](project-application.md) |
| 연관 제안 | [에이전트 산출물 동기화](agent-sync.md) |
| 후속 작업 | 옵션 schema·preset 템플릿·설정 diff 평가 |
| 권장 다음 작업 | `tdd`, `review`, `verification`, `documentation`, `security`의 최소 값과 기본값 확정 |

## 목표 계약

`agentic setup --core <name>`은 Core의 설정만 변경한다. 프로젝트 파일이나 프로젝트의 도메인 `AGENTS.md`는 변경하지 않는다.

권장 옵션은 `recommended`, `strict`, `off`처럼 의미가 명확한 값으로 제공한다. 외부 연구는 선택 근거로 사용하되, 연구 결과를 보편적 성공 보장처럼 표현하지 않는다.

예상 예시:

```bash
agentic setup --core company \
  --tdd recommended \
  --review recommended \
  --verification recommended \
  --documentation recommended \
  --security strict
```

setup은 기존 선택을 보여 주고 사용자의 승인 없이 정책을 제거하거나 약화하지 않는다. 옵션 이름과 기본값은 구현 전 평가로 확정한다.

#### 구현 기록: Core setup

* **결정:** 지침 항목별 `off`, `recommended`, `strict`를 사용하며 기본값은 `recommended`다.
* **구현:** `agentic setup --core <name>`이 Core metadata와 `AGENTS.md`를 갱신한다. `off` 항목은 Core 지침에서 제외한다.
* **평가:** `evals/core.test.mjs`에서 선택·제외·Core 경계 보존을 확인.
* **제약:** 현재는 비대화형 flags를 사용하며, 대화형 wizard는 후속 개선이다.
* **다음 단계:** preset 파일 분리와 사용자 승인 diff.
