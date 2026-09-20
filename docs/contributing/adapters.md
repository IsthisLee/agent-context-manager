# 새 에이전트 지원하기

<!-- agctx-doc-sources: src/project/plan.ts, src/project/links.ts, src/explain.ts, src/verify, templates -->
<!-- agctx-doc-sources-sha256: 484403028bf25a48cbc3938dc5d6208f5a7dce346dc803d5dd9d1a105a7c2a9f -->

지원 에이전트를 더하거나 빼는 일은 사용자 파일과 평가 범위를 바꾸므로 ADR로 결정한다. 지금 목록은 [ADR 0011](../adr/0011-supported-agents.md)이다. 결정한 뒤에는 아래 순서로 채운다.

| 순서 | 할 일 | 위치 |
| --- | --- | --- |
| 1 | 에이전트가 지침 파일을 찾는 규칙을 공식 문서에서 확인하고, 문서에 없는 부분은 실제 CLI로 실험해 명령과 결과를 남긴다 | `docs/references.md` |
| 2 | 에이전트가 읽는 파일의 템플릿을 만들고 적용 대상에 더한다. 관리 블록은 `<!-- agctx:managed:start -->`로 감싸고, 파일 첫 줄의 frontmatter로 규칙을 켜는 에이전트면 frontmatter를 블록 밖 맨 앞에 둔다 | `templates/`, `src/project/plan.ts`의 `POINTER_TEMPLATES`<!--s:02eaeec07429--> |
| 3 | 한 폴더에서 시작한 에이전트가 읽는 파일을 판정하는 함수를 더한다 | `src/explain.ts`의 `AGENT_IDS`<!--s:dd9564bc3813-->와 `explain<에이전트>`, 이유 문구 `explain.reason.*` |
| 4 | 전달 증거를 읽는다. 세션 기록이 있으면 판독기를, 없으면 도구를 끄고 한 번만 실행하는 probe 명령을 더한다 | `src/verify/evidence.ts`, `src/verify/probe.ts`의 `commandFor`<!--s:56dec108487d--> |
| 5 | 판정과 판독을 fixture로 고정하고, 가짜 CLI로 probe를 평가한다 | `evals/explain.test.ts`, `evals/verify.test.ts`, `evals/support/git-workspace.ts`의 `fakeCommands`<!--s:f5fb94fc4cba--> |
| 6 | 사용자 문서를 고친다 | `docs/reference/supported-agents.md`, `docs/concepts/agent-loading.md`, `CHANGELOG.md` |

- probe는 실제 저장소를 바꾸지 않고 임시 사본에서만 실행한다. 에이전트 CLI에 읽기 전용 샌드박스나 도구 끄기 옵션이 있으면 반드시 쓴다.
- npm으로 설치하는 CLI는 Windows에서 `.cmd` 파일이므로, 실행은 `src/verify/probe.ts`의 `run`<!--s:24ea092578f1-->처럼 셸을 거친다.
- 세션 기록 형식은 에이전트의 공개 계약이 아닌 경우가 많다. 판독기는 fixture가 고정한 필드만 읽고, 판독하지 못하면 오류가 아니라 `no-evidence`로 둔다.
