# Multi-Agent Behavioral Contracts (에이전트별 계약 매핑)

동일한 SSOT 규칙이 각 에이전트 환경에서 어떻게 인식되고 작동하는지 정의한다.

---

## 1. 지원 에이전트 및 진입 지침 매핑

| 에이전트 | 자동 인식 파일 | 역할 및 특성 |
|---|---|---|
| **OpenAI Codex / Copilot** | `AGENTS.md` | 빠른 터미널 패치, CLI 인터랙션 |
| **Claude Code** | `CLAUDE.md` | 심층 파일 리팩터링, 대화형 diff 리뷰 |
| **Google Antigravity (AGY)** | `.gemini/rules/agentic.md` | 고차원 계획 수립, 병렬 서브에이전트 조사, 아티팩트 보고 |
| **Cursor** | `.cursor/rules/agentic.mdc` | IDE 인라인 코드 작성, 핫키 편집 |

---

## 2. 공통 라이프사이클 계약

어떤 에이전트를 사용하든 모든 에이전트는 다음 4단계 루프를 공통으로 따른다:

```text
[1. 탐색 & 계획] ──▶ [2. 최소 수정] ──▶ [3. 결정론적 검증] ──▶ [4. 증거 보고]
     (지침 확인)         (요청 범위만)       (npm run check)        (exitCode & 요약)
```

1. **탐색 (Explore):** 프로젝트 진입 시 프로젝트 지침(`AGENTS.md`, `CLAUDE.md` 등)과 검사 스크립트를 먼저 확인한다.
2. **수정 (Modify):** 허용된 범위 내에서만 수정하고 불필요한 포맷 변경을 피한다.
3. **검증 (Verify):** 코드를 수정한 뒤 즉시 프로젝트 검증 명령(`npm run check`, `npm test` 등)을 실행하여 결과를 확인한다.
4. **보고 (Report):** 수정 내역과 함께 실제 실행된 테스트 수 및 통과 여부를 증거로 사용자에게 보고한다.
