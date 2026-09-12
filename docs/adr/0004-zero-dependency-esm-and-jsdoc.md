# Architecture Decision Record (ADR) 0004: 무의존성 순수 ESM(.mjs) 아키텍처 및 JSDoc 기반 정적 타입 검증

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-12
* **결정자:** Isthis & Antigravity

---

## 1. 배경 및 문제 (Context & Problem Statement)

하네스 CLI(`bin/agentic.mjs`) 및 프로젝트 주입 도구(`tools/agentic/check.mjs`, `doctor.mjs`)를 개발할 때, TypeScript(`.ts`) 기반 컴파일 언어로 갈 것인가, 아니면 순수 JavaScript(`.mjs`)로 갈 것인가에 대한 기술적 선택이 요구되었다.

TypeScript 도입 시 다음과 같은 심각한 운영/협업 위험이 존재했다:
1. **주입 스크립트의 대상 환경 종속:**
   - 주입되는 `check.mjs`와 `doctor.mjs`가 TypeScript로 작성될 경우, 대상 프로젝트에 `tsx`, `ts-node` 등이 없거나 대상 프로젝트의 엄격한 `tsconfig.json`과 충돌하여 스크립트 실행이 실패할 위험이 큼.
2. **AI 에이전트의 `src/` vs `dist/` 괴리 함정 (Compilation Drift):**
   - 에이전트가 코드를 수정한 후 빌드 단계(`npm run build`)를 누락하여 오래된 `dist/` 바이너리를 실행하고 환각 디버깅 루프에 빠지는 고질적 문제.
3. **콜드 스타트 오버헤드:**
   - CLI 실행 시 트랜스파일/컴파일러 로딩 지연이 발생하여 빠른 TDD 피드백 루프(수백 ms 이내)를 방해함.

반면, 순수 JavaScript만을 사용할 경우 IDE 자동완성 및 정적 타입 안정성이 약화될 우려가 있었다.

---

## 2. 결정 사항 (Decision)

우리는 **외부 의존성 0개(Zero-Dependency)의 순수 Node.js Native ESM(`.mjs`)**을 유지하며, 타입 안정성은 **`jsconfig.json` + JSDoc**으로 해결한다:

1. **빌드 단계 없는 순수 ESM (`.mjs`):**
   - 모든 런타임 코드(`bin/`, `tools/`, `templates/tools/`)는 별도의 빌드 단계(`tsc`, `esbuild`, `dist/`)가 필요 없는 순수 ESM으로 작성한다.
   - 프로젝트 `package.json`의 `dependencies`와 `devDependencies`를 0개로 유지하여 `npm install` 없이도 즉각 실행 가능하도록 한다.
2. **`jsconfig.json` 기반 IDE 타입 검증:**
   - 루트에 `jsconfig.json`(`checkJs: true`, `target: ES2022`, `moduleResolution: NodeNext`)을 배치하여, VS Code 및 Cursor의 내장 TypeScript 언어 서버를 활성화한다.
3. **JSDoc 타입 계약 명시:**
   - 주요 함수 및 데이터 구조체(`ProjectMeta` 등)에 `@param`, `@returns`, `@typedef` JSDoc 주석을 작성하여 컴파일 단계 없이도 100% IDE 자동완성 및 타입 에러 감지를 달성한다.

---

## 3. 결과 및 영향 (Consequences)

* **극단적인 호환성:** 주입된 도구들은 상대방 프로젝트에 아무런 패키지가 설치되어 있지 않아도 Node.js만 있으면 100% 즉시 동작함.
* **에이전트 안전성:** 빌드 누락으로 인한 런타임 불일치 사고 원천 차단.
* **초고속 TDD:** 컴파일 오버헤드가 전혀 없어 단위 테스트 7개가 0.6초 이내에 완료됨.
* **생산성 유지:** 개발자와 AI 에이전트 모두 풍부한 IDE 자동완성과 타입 힌트를 누릴 수 있음.
