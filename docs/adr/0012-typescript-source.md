# 0012. 소스를 TypeScript로 쓰고 컴파일한 JavaScript로 배포한다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-15
* **결정자:** 제품 소유자
* **근거:** [TypeScript 실행과 배포 근거](../references.md#typescript-실행과-배포-근거)

## 배경 (Context)

지금까지 소스는 JavaScript(`.mjs`)였고, 저장소 검증은 `node --check` 문법 검사까지만 했다. 다음 단계에서는 명령 등록부, `--json` 출력, Git 프로필, 여러 저장소 동기화, 에이전트 기록 판독기처럼 모듈 사이에 주고받는 데이터 형식이 늘어난다. 제품 소유자는 2026-09-15에 개발 언어를 TypeScript로 전면 전환하기로 정했다.

TypeScript로 옮길 때 정해야 하는 것은 배포 방식이다. Node.js는 `.ts` 파일의 타입만 지우고 바로 실행할 수 있지만, `node_modules` 아래에 있는 `.ts` 파일은 실행하지 않는다. npm으로 설치한 패키지는 `node_modules` 아래에 놓인다.

## 검토한 대안 (Options)

1. **JavaScript 유지와 JSDoc 타입 검사(`checkJs`):** 빌드 단계가 없다. 대신 타입을 주석으로 적어야 해서 길어지고, 전면 전환 결정과 맞지 않는다.
2. **TypeScript 소스를 그대로 배포:** 설치본이 실행되지 않는다. Node가 `node_modules` 아래의 `.ts`를 `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`으로 거부한다(실측).
3. **번들러(esbuild·tsup 등)로 한 파일로 묶어 배포:** 개발 의존성과 빌드 설정이 늘고, 설치본의 파일 구조와 오류 위치가 소스 구조와 달라진다. 이 패키지는 설치본 크기나 시작 시간이 문제가 되지 않아 얻는 것이 적다.
4. **TypeScript 소스를 `tsc`로 파일 단위 컴파일해 배포하고, 저장소에서는 컴파일 없이 실행.**

## 결정 (Decision)

4를 택한다.

- 소스는 `src/`에 두고, 배포본은 `tsc -p tsconfig.build.json`이 만든 `dist/`다. `dist/`는 커밋하지 않고 `npm pack`·`npm publish` 직전에 `prepack`(`tools/build.ts`)이 만든다. `package.json`의 `bin`과 `files`는 `dist/`를 가리킨다.
- 테스트(`evals/*.test.ts`), 저장소 도구(`tools/*.ts`), 개발 중 CLI 실행(`node src/agentic.ts`)은 컴파일하지 않고 Node의 타입 제거 실행으로 돌린다.
- Node가 타입만 지워 실행할 수 있는 문법만 쓴다. `erasableSyntaxOnly`와 `verbatimModuleSyntax`를 켜고, 상대 import에는 `.ts` 확장자를 붙인다. 빌드 설정은 `rewriteRelativeImportExtensions`로 이 확장자를 `.js`로 바꾼다.
- 형식 검사는 `strict` 설정으로 `src`·`evals`·`tools` 전체를 대상으로 하는 `pnpm run typecheck`이며 `pnpm run check`에 포함한다. 문법 검사 도구 `tools/check-syntax.mjs`와 `jsconfig.json`은 지운다.
- 소스 폴더는 설계안의 코드 배치를 따라 역할별로 나눈다. 진입점(`src/agentic.ts`, `src/agt.ts`) 아래에 `commands/`(인자 해석·명령 분기·도움말), `profile/`(프로필 명령), `project/`(적용 엔진), `i18n/`, `tui/`, `shared/`(프로필 홈·안전한 쓰기·실행 정보·공용 타입)를 둔다. 이후 단계의 명령 등록부, `check`, `repos`, `explain`, `verify`도 이 배치에 더한다.
- 개발 의존성으로 TypeScript 7.0.2와 `@types/node` 22.20.2를 고정한다.

## 결과 및 영향 (Consequences)

- 사용자의 설치·실행 방법은 그대로다. 설치본에는 `src/`가 없고 `dist/`가 들어간다.
- 저장소 개발에는 Node.js 22.18 이상이 필요하다. 22.17.1은 `.ts` 파일을 실행하지 못했다(실측). 현재 지원 하한인 Node.js 24는 이 조건을 만족한다.
- 배포 전에는 반드시 빌드가 돈다. `pack:check`와 `package:smoke`가 빌드한 결과로 검사하므로 빌드가 깨지면 게시도 막힌다.
- 코드 동작 문서의 `파일:줄` 인용은 `src/`의 `.ts` 파일을 가리키고, 문서 소스 해시 게이트의 핀도 `src` 기준으로 바꾼다.
- 배포 구조를 고정하던 평가(`bin/` 포함 여부, 문법 검사 스크립트 이름)는 요구 변경에 따라 `dist/`, `typecheck`, `build` 기준으로 고친다.
