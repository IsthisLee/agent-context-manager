# References & Comparisons (참고 문헌 및 생태계 비교)

---

## 1. 주요 연구 및 공식 가이드 (2025~2026)

1. **Anthropic Engineering (2026-03-24):**
   * *Harness design for long-running application development*
   * 핵심 요지: 가상 에이전트 팀 분업의 복잡성을 재검토하고, 복잡한 다중 에이전트보다 결정론적 평가(Deterministic Evals)와 단일 TDD 루프의 단순화가 성공률을 극대화함.
2. **Anthropic Engineering (2026-01-09):**
   * *Demystifying evals for AI agents*
   * 에이전트 평가집 구축 및 환각 방지 방법론.
3. **OpenAI Platform Docs:**
   * *Custom instructions with AGENTS.md*
   * 공식 지침 파일 표준 및 계층 구조.
4. **Claude Code Best Practices:**
   * *Interactive Verification and Feedback Loop*

---

## 2. 기존 도구와의 비교 분석

| 비교 항목 | `revfactory/harness` | `Archon` | `agentic` (본 프로젝트) |
|---|---|---|---|
| **소속 생태계** | Claude Code 전용 | Claude Code 전용 | **Codex, Claude, Antigravity, Cursor 중립** |
| **핵심 초점** | 5인 에이전트 팀/스킬 생성 | 런타임 결정론적 설정 생성 | **단일 SSOT 규칙 동기화 + OS 네이티브 TDD 검증** |
| **에이전트 구조** | 복잡한 다중 팀 (Analyst, Builder, QA) | 런타임 제어 | **단일 TDD 루프 + 온디맨드 서브에이전트** |
| **자산/보안 격리** | 프로젝트 내 종속 | 프로젝트 내 종속 | **Core와 프로젝트 물리적/법적 완벽 분리** |
| **유지보수 비용** | 중간 (Claude 업데이트 종속) | 중간 | **극소 (표준 마크다운 + 네이티브 Node 스크립트)** |
