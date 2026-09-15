# 0015. 지원 Node.js 하한을 22로 낮춘다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-15
* **결정자:** 제품 소유자
* **근거:** [공개 npm·GitHub 저장소 운영 근거](../references.md#공개-npmgithub-저장소-운영-근거)의 Node.js 릴리스 상태
* **관련:** [ADR 0012](0012-typescript-source.md)가 정한 저장소 개발 조건(Node.js 22.18 이상)은 그대로 둔다.

## 배경 (Context)

`package.json`의 `engines.node`는 `>=24.0.0`이었고 CI는 Node.js 24·26만 검증했다. Node.js 릴리스 페이지는 2026-09-15 기준 v22와 v24를 LTS, v26을 Current, v20을 EOL로 표시한다. 여러 팀이 쓰는 개발 환경에는 LTS인 22가 아직 흔하므로, 24 이상만 받으면 22를 쓰는 팀은 설치하지 못한다. 설치본의 코드와 런타임 의존성은 Node.js 22보다 새로운 API를 요구하지 않는다(`@clack/prompts`의 `engines`는 `>= 20.12.0`). 제품 소유자는 2026-09-15에 지원 하한을 22로 정했다.

## 검토한 대안 (Options)

1. **24 이상 유지:** CI 조합이 적다. 대신 Node.js 22 LTS를 쓰는 사용자가 설치하지 못한다.
2. **22 이상:** 두 LTS를 모두 받는다. 하한에서 새 API를 실수로 쓰지 않도록 CI와 기여자 환경을 22에 맞춰야 한다.
3. **20 이상:** Node.js 20은 EOL이라 보안 수정이 없고, 저장소의 TypeScript 실행 조건(22.18 이상)과도 멀어진다.

## 결정 (Decision)

2를 택한다.

- `engines.node`는 `>=22.0.0`이다.
- CI는 Ubuntu에서 Node.js 22·24·26, macOS와 Windows에서 Node.js 22를 검증한다. 운영체제 차이는 지원 하한에서 확인한다.
- `.nvmrc`는 22로 두어 기여자가 지원 하한에서 개발하게 한다. 게시 워크플로는 Node.js 24를 그대로 쓴다.
- 저장소 개발(테스트·도구·컴파일 없는 CLI 실행)에는 Node.js 22.18 이상이 필요하다([ADR 0012](0012-typescript-source.md)).

## 결과 및 영향 (Consequences)

- Node.js 22 LTS 사용자도 설치하고 실행할 수 있다.
- CI 조합이 4개에서 5개로 늘어난다.
- `evals/repository-operations.test.ts`의 `engines`·`.nvmrc`·매트릭스 단언과 `evals/package-contents.test.ts`의 README 배지 단언을 22 기준으로 고친다. 요구가 바뀌어 고친 평가다.
- README 배지와 실행 환경 문구, 기여 안내, 공개 저장소 운영 문서를 22 기준으로 고친다.
