# 테스트와 품질 게이트

<!-- agctx-doc-sources: package.json, tsconfig.json, tools/package-smoke.ts -->
<!-- agctx-doc-sources-sha256: 5cb086de2b0e99037df5ae30a60c1894ed30c94e8dde83a3a1d2f848110c2b34 -->

모든 변경은 CI와 같은 순서로 확인한다.

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run pack:check
pnpm run package:smoke
pnpm run audit
```

`pnpm run check`는 TypeScript 형식 검사(`tsc -p tsconfig.json`, strict), 서식 검사(`prettier --check .`), 린트(`eslint`), 문서 계약 검사, Node.js 테스트 러너 기반 평가를 실행한다. 형식 검사는 `src`·`evals`·`tools`를 모두 대상으로 하고 파일을 만들지 않는다. 서식 검사는 코드·JSON·YAML이 `.prettierrc.json`의 설정과 다르면 실패하고, 파일을 고치지는 않는다. 서식은 `pnpm run format`으로 맞춘다. 저장소 전체를 포맷한 커밋은 `.git-blame-ignore-revs`에 있고, `git config blame.ignoreRevsFile .git-blame-ignore-revs`로 켜면 `git blame`이 그 커밋을 건너뛴다. Markdown은 `.prettierignore`로 빼고 문서 계약 검사에 맡긴다. 이유는 [ADR 0039](../adr/0039-format-code-with-prettier.md)에 있다. 린트는 `src`·`evals`·`tools`를 `eslint.config.js`의 규칙(`@eslint/js`와 typescript-eslint의 `recommended`)으로 검사한다. typescript-eslint가 TypeScript 6.0 API를 쓰므로 `typescript` 이름에는 6.0 호환 패키지를, 형식 검사와 빌드에는 `@typescript/native` 별칭의 TypeScript 7을 둔다([ADR 0040](../adr/0040-lint-with-eslint-and-typescript6-compat.md)). `pnpm run pack:check`는 `prepack`으로 `src/`를 `dist/`에 컴파일한 뒤 npm tarball에 들어갈 파일 목록을 확인해 개발 문서·평가·로컬 파일이 배포물에 섞이지 않는지 검토한다. 배포물에 포함되는 README의 저장소 문서 링크는 GitHub 절대 링크를 사용해 npm 페이지에서도 깨지지 않도록 유지한다. 이 검사는 패키지 동작과 저장소 문서 계약을 확인하지만 모든 제품 요구사항·보안·사용자 경험을 증명하지는 않는다.
`pnpm run package:smoke`는 실제 npm tarball을 임시 소비자 프로젝트에 설치하고 설치된 `agctx help`, 프로필 생성·설정, 프로젝트 `profile apply`·`profile sync`, 임시 `HOME`에서의 `agctx install`(패키지에 든 스킬이 에이전트 폴더에 복사되는지)까지 실행한다. 저장소 소스가 아니라 배포 산출물의 설치와 핵심 실행 경로를 확인하는 검사다. 적용·동기화 기능이 현재 무엇을 보장하는지는 [현재 아키텍처](architecture.md)가 정본이다.
`pnpm run audit`는 의존성 취약점이 high 이상으로 보고되는 경우 실패한다. 이 검사는 알려진 취약점 신호이며 악성 코드·설정 오류·런타임 전체의 안전을 보증하지 않는다.

## 평가 작성

<!-- agctx-doc-sources: evals/support, tools/generate-skills.ts, tools/generate-reference.ts, tools/generate-discussion-status.ts, tools/generate-progress.ts, evals/doc-examples.test.ts -->
<!-- agctx-doc-sources-sha256: 68b75e7e8cf9fba06641df5ea6e68a9e081cb55a546bc9847f18a635415030e7 -->

- 평가는 `evals/*.test.ts`이며 Node.js 내장 `node:test`로 실행한다. 코드를 바꾸기 전에 실패하는 평가를 먼저 쓰고(Red), 통과시킨 뒤(Green) 정리한다.
- CLI는 `spawnSync`로 `src/agctx.ts`를 실행해 검사한다. 실행 결과가 파이프로 나가므로 확인이 필요한 명령은 `--yes` 없이 64로 멈추는지도 함께 확인한다.
- `evals/support/git-workspace.ts`의 `makeWorkspace`<!--s:1e4191609400-->는 사람마다 따로 `AGCTX_HOME`을 둔 임시 컴퓨터를 만들고, `publishProfile`·`serviceRepo`는 bare 원격과 작업 저장소를, `fakeCommands`는 PATH에 두는 가짜 `gh`·에이전트 CLI를 만든다(Windows에서는 `.cmd` 래퍼).
- **PATH에 둔 가짜 명령은 CLI가 셸로 실행하는 명령만 가로챈다.** Windows에서 `.cmd` 래퍼는 셸이 있어야 시작되므로(`node:child_process` 문서, [외부 근거](../references.md#cli-계약과-지침-공급망-근거)), `gh`와 에이전트 CLI처럼 Windows에서 셸을 거치는 명령은 가짜로 바뀌지만 `git`은 바뀌지 않는다. `git()`은 셸 없이 실행하기 때문이다. `git` 동작을 가짜로 바꿔 확인하는 평가는 판정 함수를 직접 부르는 평가를 함께 두고, 가짜를 쓰는 쪽만 `skip`으로 Windows에서 건너뛴다.
- 빠른 시작의 명령 예시는 `evals/doc-examples.test.ts`가 실제 출력과 대조한다. 명령 출력을 바꿨다면 문서의 예시를 실제 출력으로 고친다.
- 에이전트 관련 평가는 `HOME`·`USERPROFILE`·`CODEX_HOME`·`CLAUDE_CONFIG_DIR`를 임시 폴더로 바꿔 이 컴퓨터의 사용자 파일과 세션 기록이 섞이지 않게 한다.
- 명령 등록부를 바꾸면 `node tools/generate-skills.ts`와 `node tools/generate-reference.ts`로 스킬의 명령 목록과 레퍼런스의 생성 블록을 다시 만든다. 다르면 `evals/skills.test.ts`와 `evals/reference-docs.test.ts`가 실패한다.
- `docs/discussion/topics.json`을 바꾸면 `node tools/generate-discussion-status.ts`로 논의 상태 줄·색인·README 목록을 다시 만든다. 다르면 `evals/discussion-status.test.ts`가 실패한다.
- `PROGRESS.md`의 두 블록은 `node tools/generate-progress.ts`가 만든다. 최근 기록은 `git log main`에서(PR이 squash로 병합되므로 병합된 이력만 적는다), 구현 중인 주제 표는 `topics.json`과 각 주제의 `권장 다음 작업`에서 온다. `evals/progress.test.ts`는 최근 기록의 줄이 실제 커밋과 맞는지, 주제 표가 최신인지 검사한다. 최근 기록은 커밋할 때마다 다시 만들지 않아도 된다.

## CI 환경

<!-- agctx-doc-sources: .github/workflows/ci.yml -->
<!-- agctx-doc-sources-sha256: 41472c8dfbd859b6c2ee1044c599d4e4c758f35a4d2f6660733ec13ca1e30517 -->

GitHub Actions의 `CI`는 `main` push와 모든 PR에서 Ubuntu의 Node.js 22·24 LTS와 26 Current, macOS와 Windows의 Node.js 22 LTS 조합을 고정된 pnpm 버전으로 검증한다. 지원 하한인 22를 세 운영체제에서 모두 돌려 새 API를 실수로 쓰면 CI가 잡게 한다. 저장소 루트의 `.nvmrc`는 기여자의 기본 로컬 런타임을 같은 이유로 Node.js 22로 맞춘다. PR은 CI가 실패한 상태로 병합하지 않는다. 의존성·워크플로 변경은 보안 영향을 함께 검토한다.

CI는 전체 이력을 받는다(`fetch-depth: 0`). `PROGRESS.md`의 최근 기록이 실제 커밋과 맞는지 검사하려면 이력이 필요하기 때문이다. 얕은 복제에서는 그 두 평가가 건너뛴다.

저장소 루트의 `.editorconfig`와 `.gitattributes`는 편집기·운영체제에 따른 인코딩, 줄바꿈, 공백 차이를 줄이는 기본 파일 형식 계약이다. 그 위의 코드 서식은 `.prettierrc.json`이 정한다.

## 네트워크가 필요한 확인

<!-- agctx-doc-sources: tools/skills-smoke.ts -->
<!-- agctx-doc-sources-sha256: 80a40c90bec836279363d0a4a181e9a7cc16bf5f61be602ab099e97d9ce9b612 -->

- `node tools/skills-smoke.ts`: skills CLI로 스킬을 임시 프로젝트에 설치해 위치를 확인하고, 기여자 전용 스킬(`.agents/skills/repo-docs`)이 사용자 설치에서 빠지는지 검사한다. skills CLI가 저장소 전체를 순회하므로 사용자가 실제로 보는 것과 같게 `skills/`와 `.agents/skills/`를 모두 복사해 실행한다. npm에서 skills CLI를 받으므로 `pnpm run check`에는 넣지 않는다.
- 실제 에이전트 CLI로 `agctx verify --probe`를 실행하는 확인은 요금제·로그인이 필요해 자동화하지 않는다. 에이전트 판정을 바꾸면 한 번 수동으로 실행하고 결과를 [외부 참고 문헌](../references.md)에 기록한다.
