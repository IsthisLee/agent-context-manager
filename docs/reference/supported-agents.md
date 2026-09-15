# 지원 에이전트

<!-- agctx-doc-sources: src/project/plan.ts, src/project/links.ts, templates, src/explain.ts, src/verify -->
<!-- agctx-doc-sources-sha256: 884ac33d79f1d95deca4119fced3e33d3f0617c3efd3e29bd6e848deaabbcbf9 -->

agctx가 파일을 만들고 전달을 확인하는 에이전트는 Codex·Claude Code·Antigravity다. Cursor·GitHub Copilot 파일은 만들지 않는다([ADR 0011](../adr/0011-supported-agents.md)).

| 에이전트 | agctx가 만드는 파일 | 세션 시작에 읽는 파일 | `verify`의 증거 |
| --- | --- | --- | --- |
| Codex | `AGENTS.md` | 프로젝트 루트부터 시작 폴더까지 폴더마다 `AGENTS.override.md` 또는 `AGENTS.md` 하나, 합산 32 KiB까지 | 세션 기록(`$CODEX_HOME/sessions`) 또는 probe |
| Claude Code | `CLAUDE.md`(`@AGENTS.md`), 하위 폴더 `AGENTS.md` 옆의 `CLAUDE.md` 연결 파일 | 시작 폴더와 그 위 폴더의 `CLAUDE.md`·`.claude/CLAUDE.md`·`CLAUDE.local.md`와 가져오기(최대 4단계). 시작 폴더 밖 가져오기는 프로젝트마다 한 번 승인한 뒤 | 세션 기록(`$CLAUDE_CONFIG_DIR/projects`) 또는 probe |
| Antigravity | `.agents/rules/agctx.md`(`trigger: always_on`) | 루트 `AGENTS.md`·`GEMINI.md`와 `trigger: always_on` 규칙(실측) | probe만 |

- 에이전트별 판정의 자세한 규칙과 예시는 [에이전트가 읽는 지침 파일](../concepts/agent-loading.md)에, 근거는 [외부 참고 문헌](../references.md#에이전트-지침-로드와-전달-확인-근거)에 있다.
- `explain`은 `.cursorrules`, `.cursor/rules`, `.github/copilot-instructions.md`, `.windsurfrules`, `.clinerules`, `.agent/rules`처럼 세 에이전트가 읽지 않는 규칙 파일도 목록으로 알린다.
- 새 에이전트를 더하는 절차는 [새 에이전트 지원하기](../contributing/adapters.md)에 있다.
