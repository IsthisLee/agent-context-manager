# 저장소 운영 논의

이 문서는 **저장소를 어떻게 운영할지**에 대한 논의 목록이다. 문서 게이트, CI, PR 리뷰, 기여 절차처럼 배포하는 패키지의 동작이 아니라 저장소 자체의 작업 방식을 다룬다. 패키지 기능의 구현 단계는 [아키텍처 구현 계획](../architecture/README.md)에 있다.

주제 문서의 상태 값, 제안 요약 항목, 구현 기록 형식은 패키지 논의와 같다. 정본은 [구현 계약 및 문서 규칙](../architecture/topics/implementation-contracts.md)이다.

## 주제

| 주제 | 중요도 | 핵심 결과 | 상태 |
| --- | --- | --- | --- |
| [문서 소스 해시 게이트의 핀 범위와 승인 단위](topics/doc-gate-pin-scope.md) | High | 관련 없는 문서까지 실패시키는 범위를 줄이고, 실패 원인을 보여 주며, 문서를 하나씩 승인 | Proposed |
| [문서 정확성 자동 리뷰](topics/doc-accuracy-review.md) | Medium | 해시만 다시 기록한 PR에서 문서와 코드의 일치를 에이전트가 리뷰 | Proposed |
| [논의 문서 상태의 정본](topics/discussion-status-source.md) | Medium | 논의 주제의 상태를 JSON 한 파일에만 쓰고 색인 표와 README 상태 목록은 생성 | Proposed |

> **중요도**는 각 주제의 제안 요약을 요약한 값이다. 근거와 세부는 각 주제 문서의 `## 제안 요약`을 본다.
