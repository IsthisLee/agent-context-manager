# Architecture Decision Record (ADR) 0003: 스마트 동기화 머지, 콜드 스타트 스캐폴딩 및 지침 비대화 진단

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-12
* **결정자:** Isthis & Antigravity

---

## 1. 배경 및 문제 (Context & Problem Statement)

초기 프로토타입 구현 후 실제 배포 및 프로젝트 동기화 시나리오를 검증하는 과정에서 3가지 핵심 결함이 확인되었다:

1. **커스텀 규칙 증발 (Rule Overwrite Bug):**
   - 사용자가 프로젝트의 `AGENTS.md` 하단에 결제 API, DB 트랜잭션 등 프로젝트 고유 규칙을 추가해 둔 상태에서 `agentic sync`를 실행하면, 기존 파일이 새 코어 템플릿으로 단순 덮어쓰기(`fs.writeFileSync`)되어 사용자 작성 규칙이 유실됨.
2. **콜드 스타트(Cold Start) 실패:**
   - 테스트 스크립트가 아직 작성되지 않은 신규 프로젝트(`package.json`에 `test` 스크립트가 없거나 `no test specified`)에서 `agentic init`을 실행하면, `npm run check`가 즉시 에러로 종료되어 AI 에이전트의 결정론적 TDD 루프가 시작조차 되지 못함.
3. **지침 비대화(Bloat) 및 LLM 주의력 결핍:**
   - 사용자가 모든 도메인 지식을 `AGENTS.md` 단일 파일에 계속해서 누적할 경우, 토큰 비용 급증 및 LLM 지침 집중도 희석(Attention Dilution) 문제가 발생할 수 있으나 이를 감지하고 경고해 주는 안전장치가 부재함.

---

## 2. 결정 사항 (Decision)

우리는 하네스 코어에 다음과 같은 3가지 결정론적 메커니즘을 추가 구현한다:

1. **스마트 동기화 머지 (`mergeAgentsMd`):**
   - `bin/analyzer.mjs`에 스마트 병합 엔진을 구현.
   - 기존 `AGENTS.md`의 `## 4. 프로젝트 규칙 확장 (SSOT)` 섹션을 정규식으로 탐색하여, 기본 보일러플레이트를 제외한 순수 사용자 커스텀 규칙만을 온전히 추출.
   - 최신 업스트림 템플릿 하단에 사용자 규칙을 자동으로 이어 붙여, 업스트림 규칙 업데이트와 로컬 규칙 보존을 동시에 달성.
2. **무의존성 콜드 스타트 자동 구성 (`ensureTestSetup`):**
   - `bin/analyzer.mjs`에 신규 프로젝트 감지 엔진 구현.
   - 테스트 스크립트가 없는 프로젝트 감지 시, 외부 의존성(Jest, Vitest 등) 추가 없이 Node.js 20+ 내장 테스트 러너(`node --test tests/**/*.test.mjs`)를 `package.json`의 `test`로 등록.
   - 즉시 통과 가능한 초기 스모크 테스트 파일(`tests/smoke.test.mjs`)을 자동 생성하여 `npm run check`의 초기 성공 보장.
3. **지침 크기 진단 및 점진적 분리 가이드 (`doctor.mjs`):**
   - `tools/agentic/doctor.mjs`에 `AGENTS.md` 라인 수 검사 로직 추가.
   - 150줄 이하: `[PASS] AGENTS.md Size: X lines (optimal)`
   - 150줄 초과: `[WARN] AGENTS.md Size: X lines (>150 lines: consider splitting detailed domain rules into docs/ to save LLM tokens)`

---

## 3. 결과 및 영향 (Consequences)

* **안전성:** `agentic sync`를 몇 번 실행하더라도 개발자가 작성한 고유 규칙이 영구적으로 보존됨 (`evals/sync-merge.test.mjs`, `evals/sync-cli.test.mjs`로 증명).
* **즉시 사용성:** 아무것도 없는 신규 프로젝트에서도 `agentic init` 단 한 줄로 TDD 피드백 루프가 즉각 가동됨 (`evals/cold-start.test.mjs`).
* **성능 유지:** 프로젝트가 거대해져도 `doctor`가 지침 비대화를 조기에 경고하여 토큰 낭비와 에이전트 성능 저하를 방지함 (`evals/doctor.test.mjs`).
