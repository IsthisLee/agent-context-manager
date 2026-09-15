# Contributing to Agent Context Manager

agctx는 여러 AI 에이전트가 같은 프로젝트 개발 지침을 사용하도록 돕는 공개 npm 패키지입니다. 작은 문서 수정부터 기능 변경까지 모든 기여를 환영합니다.

## 시작하기

요구 사항은 Node.js 22.18 이상과 pnpm 10.15.0입니다. 저장소의 TypeScript 파일을 컴파일하지 않고 바로 실행하려면 22.18 이상이 필요합니다.

`nvm`을 사용하는 경우 저장소 루트에서 `nvm use`로 권장 메이저 버전을 선택할 수 있습니다.

`.editorconfig`와 `.gitattributes`가 지정한 UTF-8·LF·최종 줄바꿈 규칙을 편집기와 Git에서 유지해 주세요.

```bash
pnpm install
pnpm run check
```

`pnpm run check`는 TypeScript 형식 검사, 문서 계약 검사, Node.js 테스트 러너 기반 평가를 실행합니다. 소스는 `src/`의 TypeScript이며, 저장소에서는 `node src/agctx.ts help`처럼 컴파일하지 않고 바로 실행할 수 있습니다. 패키지에 포함될 파일은 다음으로 확인할 수 있습니다. 이 명령은 `prepack`으로 `src/`를 `dist/`에 먼저 빌드합니다.

```bash
pnpm run pack:check
```

## 변경 규칙

- 변경 전에 관련 제품 방향·아키텍처·워크플로 문서의 정본을 확인합니다.
- 새 기능은 CLI·TUI·`agctx profile list`의 인터페이스 계약을 함께 검토합니다.
- 코드 변경은 실패하는 평가를 먼저 추가하는 Red-Green-Refactor 흐름을 따릅니다.
- 사용자에게 보이는 계약·파일 형식·보안 경계가 바뀌면 같은 변경에서 문서를 갱신합니다.
- 장기적이거나 되돌리기 어려운 결정은 `docs/adr/`에 기록합니다.
- 비밀값, 개인정보, 로컬 프로필 경로를 커밋하지 않습니다.

## Pull Request

PR에는 변경 목적, 사용자 영향, 검증 명령과 결과, 문서·ADR 갱신 여부를 적어주세요. 동작이 바뀌면 재현 가능한 예시와 테스트를 함께 제공해주세요.

모든 검증이 통과해도 요구사항·보안·사용자 경험 전체가 자동으로 증명되는 것은 아닙니다. PR 설명에 남은 제약과 후속 작업을 명시해주세요.
