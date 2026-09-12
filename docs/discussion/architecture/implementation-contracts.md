# Implementation Documentation Contracts

**상태:** Active process

이 디렉터리는 구현 전에 모든 세부 사항을 확정하는 명세가 아니다. 구현과 eval을 통해 계약을 확정하고, 코드·테스트·문서를 같은 변경에서 함께 갱신한다.

## 상태

각 주제 문서는 제목 바로 아래에 `**상태:** <값>`을 기록한다. 허용 값은 다음과 같다.

* `Proposed`: 논의 중이며 구현 계약으로 확정되지 않음
* `Implementing`: 구현과 eval이 진행 중임
* `Implemented`: 코드와 eval로 동작이 확인됨
* `Superseded`: 새 계약 또는 ADR로 대체됨
* `Active reference`: 비교·근거 문서로 유지됨
* `Active process`: 지속적으로 적용되는 운영 규칙

## 구현 기록 형식

```markdown
#### 구현 기록: <기능 또는 변경 이름>

* **상태:** Implemented
* **결정:** 선택한 정책과 계약
* **구현:** 영향받는 파일과 공개 동작
* **검증:** 추가·수정한 eval 및 `npm run check` 결과
* **제약:** 지원하지 않는 경우 또는 후속 작업
* **ADR:** 필요할 때 ADR 링크
```

CLI 명령, JSON schema, artifact 형식, 동기화 계약, 역할 선택 기준, 검증 완료 조건, 런타임 경계, 호환성·마이그레이션·롤백은 기록 대상이다. 단순 내부 리팩터링과 자명한 구현 상세는 기록하지 않는다.

공개 계약이나 운영 정책이 바뀌면 해당 논의 문서와 상태를 같은 변경에서 갱신한다. `Implemented`로 바꾸려면 구현 기록에 코드·eval·`npm run check` 증거를 연결한다. 채택되어 현재 사실이 된 문서는 논의 폴더에 남기지 않고 [`../../architecture/`](../../architecture/)로 옮긴다. 여러 프로젝트에 장기 영향을 주거나 되돌리기 어려운 결정은 ADR로 승격한다.
