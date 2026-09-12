# Multi-Agent Behavioral Contracts (에이전트별 계약 매핑)

동일한 SSOT 규칙이 각 에이전트 환경에서 어떻게 인식되고 작동하는지 정의한다.

---

## 1. 지원 에이전트 및 자동 인식 지침 파일 매핑

| 에이전트 | 자동 인식 지침 파일 | 역할 및 특성 |
|---|---|---|
| **OpenAI Codex** | `AGENTS.md` | 빠른 터미널 패치, CLI 인터랙션 |
| **Claude Code** | `CLAUDE.md` | 심층 파일 리팩터링, 대화형 diff 리뷰 |
| **Google Antigravity (AGY)** | `.gemini/rules/agentic.md` | 고차원 계획 수립, 병렬 서브에이전트 조사, 아티팩트 보고 |
| **Cursor** | `.cursor/rules/agentic.mdc` | IDE 인라인 코드 작성, 규칙 자동 적용 |
| **GitHub Copilot** | `.github/copilot-instructions.md` | PR 코드 리뷰, IDE 및 Copilot 에이전트 연동 |

---

## 2. 공통 라이프사이클 계약

어떤 에이전트를 사용하든 모든 에이전트는 다음 4단계 루프를 공통으로 따른다:

```text
[1. 지침 확인] ──▶ [2. 최소 수정(TDD)] ──▶ [3. 결정론적 검증] ──▶ [4. 증거 보고]
  (지침 숙지)         (Red-Green 원칙)       (npm run check)        (exitCode & 증거)
```

1. **지침 확인 (Explore):** 프로젝트 진입 시 프로젝트 지침(`AGENTS.md`, `CLAUDE.md` 등)과 검사 스크립트를 먼저 확인한다.
2. **최소 수정 (Modify):** Red-Green TDD 원칙에 따라 실패하는 테스트를 먼저 작성하고, 요청된 최소 범위만 구현한다.
3. **결정론적 검증 (Verify):** 코드를 수정한 뒤 즉시 프로젝트 검증 명령(`npm run check`, `npm test` 등)을 실행하여 기계 증거를 확인한다.
4. **증거 보고 (Report):** 수정 내역과 함께 실제 실행된 테스트 수 및 통과 여부를 증거(`.agentic/last-check.json`)로 사용자에게 보고한다.
