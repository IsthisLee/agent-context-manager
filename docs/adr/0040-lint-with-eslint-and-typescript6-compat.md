# 0040. ESLint로 린트하고, typescript-eslint에는 TypeScript 6 호환 패키지를 준다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-22
* **결정자:** 제품 소유자
* **근거:** [린트와 TypeScript 7 병행 설치 근거](../references.md#린트와-typescript-7-병행-설치-근거)
* **관련:** [ADR 0012](0012-typescript-source.md)가 고정한 TypeScript 7.0.2는 그대로 형식 검사와 빌드에 쓰고, 설치하는 이름만 `@typescript/native` 별칭으로 옮긴다. 서식은 [ADR 0039](0039-format-code-with-prettier.md)가 정한다.

## 배경 (Context)

- 저장소에 린트 도구가 없었다. 형식 검사(`tsc`)는 타입 오류만 잡고, 빈 블록이나 쓰지 않는 변수, 원인을 잃는 오류 다시 던지기 같은 코드 문제는 잡지 않는다.
- TypeScript 파일을 ESLint로 검사하려면 typescript-eslint가 필요하다. typescript-eslint는 TypeScript 컴파일러 API로 파일을 해석하는데, 이 저장소가 쓰는 TypeScript 7.0.2에는 그 API가 없고 typescript-eslint는 `typescript`를 `<6.1.0`으로 요구한다. 그대로 설치하면 `eslint`가 `typescript-eslint does not support TS 7.0.`을 내고 실패한다.

## 검토한 대안 (Options)

| 항목 | 대안 | 판단 |
| --- | --- | --- |
| TypeScript 7과의 공존 | TypeScript 팀이 안내하는 별칭: `typescript`는 6.0 호환 패키지, 7.0은 `@typescript/native` | **채택.** `tsc`는 7.0.2 그대로이고 typescript-eslint는 6.0 API를 받는다 |
| | pnpm `overrides`로 typescript-eslint 쪽 `typescript`만 6.0으로 바꾼다 | 실험에서 적용되지 않았다. 7.0.2 하나만 설치됐다 |
| | 형식 검사까지 TypeScript 6.0으로 되돌린다 | ADR 0012의 결정을 뒤집어야 하고, 린트 때문에 컴파일러를 바꿀 이유가 없다 |
| 린트 도구 | ESLint와 typescript-eslint | **채택.** 제품 소유자가 고른 도구다 |
| 규칙 | `@eslint/js`와 typescript-eslint의 `recommended` | **채택.** 타입 정보를 쓰는 규칙(`recommendedTypeChecked`)은 넣지 않았다 |
| 기존 코드의 관례 | 빈 `catch {}`(읽기 실패 시 기본값으로 넘어감)와 나머지 구조 분해로 필드를 빼는 `_` 변수를 규칙 옵션으로 인정한다 | **채택.** 두 관례는 18곳에서 같은 뜻으로 쓰였다 |
| | 18곳에 주석을 달거나 코드를 바꾼다 | 관례가 하는 일은 그대로이고 줄만 늘어난다 |

## 결정 (Decision)

1. 개발 의존성을 TypeScript 팀의 안내대로 둔다. `"@typescript/native": "npm:typescript@7.0.2"`, `"typescript": "npm:@typescript/typescript6@6.0.2"`. `tsc`는 7.0.2이고, `tools/build.ts`도 `@typescript/native`의 `tsc`로 컴파일한다.
2. ESLint 10.11.0, `@eslint/js` 10.0.1, typescript-eslint 8.70.1을 고정한다. `eslint.config.js`는 두 `recommended` 설정에 옵션 두 개(`no-empty`의 `allowEmptyCatch`, `@typescript-eslint/no-unused-vars`의 `ignoreRestSiblings`)만 더한다.
3. `pnpm run lint`가 `src`·`evals`·`tools`와 설정 파일을 검사하고, `pnpm run check`가 서식 검사 다음에 실행한다.
4. 도입할 때 나온 나머지 문제는 코드를 고친다. 오류를 다시 던질 때 원래 오류를 `cause`로 남기고, 쓰지 않는 변수와 import를 지우고, 정규식의 연속 공백을 개수로 쓴다.

## 결과 및 영향 (Consequences)

- 이 저장소에서 `typescript` 패키지를 불러오는 코드는 6.0 API를 받는다. 컴파일러 버전을 묻거나 `tsc`를 경로로 부르는 도구는 `@typescript/native`를 가리켜야 한다.
- TypeScript 7.1이 새 API를 내고 typescript-eslint가 지원하면 별칭을 걷고 `typescript`를 7로 되돌린다. 추적할 이슈는 [근거 절](../references.md#린트와-typescript-7-병행-설치-근거)에 있다.
- 빈 `catch {}`가 무시하는 오류가 정말 무시해도 되는지는 이 결정에서 따지지 않았다. 규칙은 관례를 인정할 뿐이고, 곳마다 오류의 범위를 좁힐지는 따로 판단한다.
