# 지원 에이전트

<!-- agctx-doc-sources: src/project/plan.ts, src/project/links.ts, templates, src/explain.ts, src/verify -->
<!-- agctx-doc-sources-sha256: 31cc1783c4c3dfa3de786e77fb904f41b15b525cef321ef866661978719f6037 -->

agctx가 파일을 만들고 전달을 확인하는 에이전트는 Codex·Claude Code·Antigravity다. Cursor·GitHub Copilot 파일은 만들지 않는다([ADR 0011](../adr/0011-supported-agents.md)).

| 에이전트 | agctx가 만드는 파일 | 세션 시작에 읽는 파일 | `verify`의 증거 |
| --- | --- | --- | --- |
| Codex | `AGENTS.md` | 프로젝트 루트부터 시작 폴더까지 내려가며 폴더마다 `AGENTS.override.md` 또는 `AGENTS.md` 하나. 합친 크기가 32 KiB(기본값)에 닿으면 더 읽지 않는다 | 세션 기록(`$CODEX_HOME/sessions`) 또는 probe |
| Claude Code | `CLAUDE.md`(`@AGENTS.md`로 `AGENTS.md`를 가져옴), 하위 폴더 `AGENTS.md` 옆의 `CLAUDE.md` 연결 파일 | 시작 폴더와 그 위 폴더의 `CLAUDE.md`·`.claude/CLAUDE.md`·`CLAUDE.local.md`, 그리고 그 파일들이 `@`로 가져오는 파일(최대 4단계). 그 세 파일이 하나도 없으면 같은 범위의 `AGENTS.md`·`.claude/AGENTS.md`를 대신 읽는다(v2.1.277 이상). 시작 폴더 밖의 파일을 가져오면 프로젝트마다 처음 한 번 사용자가 승인해야 읽는다 | 세션 기록(`$CLAUDE_CONFIG_DIR/projects`) 또는 probe |
| Antigravity | `.agents/rules/agctx.md`(`trigger: always_on`) | 루트 `AGENTS.md`·`GEMINI.md`와 `trigger: always_on` 규칙. 공식 문서에 적혀 있지 않아 직접 실험한 결과다 | probe만(세션 기록을 읽지 못함) |

- 에이전트별 판정의 자세한 규칙과 예시는 [에이전트가 읽는 지침 파일](../concepts/agent-loading.md)에, 근거는 [외부 참고 문헌](../references.md#에이전트-지침-로드와-전달-확인-근거)에 있다.
- `explain`은 `.cursorrules`, `.cursor/rules`, `.github/copilot-instructions.md`, `.windsurfrules`, `.clinerules`, `.agent/rules`처럼 세 에이전트가 읽지 않는 규칙 파일도 목록으로 알린다.
- 새 에이전트를 더하는 절차는 [새 에이전트 지원하기](../contributing/adapters.md)에 있다.
