# Architecture Decision Record (ADR) 0002: AGENTS.md 중심의 단일 진실 공급원(SSOT) 및 포인터 참조 패턴

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-12
* **결정자:** Isthis & Antigravity

---

## 1. 배경 및 문제 (Context & Problem Statement)

OpenAI Codex, Anthropic Claude Code, Google Antigravity, Cursor, GitHub Copilot 등 5대 에이전트를 지원하기 위해, 초기에는 각 에이전트의 기본 지침 파일(`CLAUDE.md`, `.gemini/rules/agentic.md`, `.cursor/rules/agentic.mdc`, `.github/copilot-instructions.md`)에 전체 코딩 규칙과 TDD 지침 텍스트를 각각 복제하여 생성하는 방식을 검토했다.

그러나 이 방식은 다음과 같은 치명적인 문제를 야기했다:
1. **지침 파편화 (Instruction Drift):** 규칙 텍스트가 5개 파일로 복제되면, 개발자가 비즈니스 규칙이나 코딩 컨벤션을 변경할 때 한두 개 파일만 수정하고 나머지를 빠뜨려 에이전트마다 서로 다른 규칙으로 작업하게 됨.
2. **개발자 유지보수 피로:** "개발자는 오직 하나의 지침만 관리하고 싶다"는 핵심 사용자 가치에 정면으로 위배됨.

---

## 2. 고려한 대안 (Considered Options)

1. **대안 A: 5개 파일에 규칙 텍스트 완전 복제**
   - 각 에이전트가 완결된 지침을 바로 읽을 수 있으나, SSOT 원칙이 파괴되고 지침 동기화 누락 위험이 극심함.
2. **대안 B: AGENTS.md를 프로젝트 SSOT로 확정하고 타 에이전트 파일은 포인터(Pointer) 참조만 유지 (채택)**
   - 리눅스 재단 및 오픈에이아이가 주도하는 오픈 포맷 `AGENTS.md`를 프로젝트 내 유일한 단일 진실 공급원으로 선언.
   - `CLAUDE.md`는 `@AGENTS.md` 인클루드 지시자를 사용.
   - Cursor, Antigravity, Copilot 규칙 파일은 "모든 규칙은 AGENTS.md를 단일 정본으로 따른다"는 1줄 포인터만 유지.

---

## 3. 결정 사항 (Decision)

우리는 **"개발자는 오직 `AGENTS.md` 딱 하나에만 프로젝트의 모든 지침을 작성하고 관리한다"**는 원칙을 아키텍처 규칙으로 채택한다:

1. **단일 진실 공급원 (SSOT):**
   - 모든 핵심 행동 규약, 기계 검증 명령(`npm run check`), 프로젝트 프레임워크 제약, 사용자 커스텀 규칙은 `AGENTS.md`에만 존재한다.
2. **포인터 참조 지침 생성:**
   - `CLAUDE.md` ➔ `@AGENTS.md`
   - `.gemini/rules/agentic.md` ➔ `AGENTS.md` 정본 참조 지시문
   - `.cursor/rules/agentic.mdc` ➔ `AGENTS.md` 정본 참조 지시문 (Always apply)
   - `.github/copilot-instructions.md` ➔ `AGENTS.md` 정본 참조 지시문
3. **점진적 공개 (Progressive Disclosure):**
   - 단일 파일이 150줄 이상으로 커지면 LLM 컨텍스트 낭비를 막기 위해 상세 지식을 `docs/` 서랍으로 분리하고 `AGENTS.md`에는 목차(Index)만 남기는 구조를 공식 가이드라인으로 채택. [`[근거: references.md]`](../references.md#openai-agents-md)

---

## 4. 결과 및 영향 (Consequences)

* **긍정적 영향:**
  - 개발자는 5개 파일을 신경 쓸 필요 없이 `AGENTS.md` 1개만 수정하면 5대 AI 에이전트 전체에 즉시 동기화됨.
  - 지침 불일치(Drift)로 인한 에이전트 간 오작동 가능성 0%.
  - 각 도구 템플릿의 크기가 극도로 가벼워져 유지보수가 용이해짐.
* **트레이드오프:**
  - 에이전트가 작업 시작 시 `AGENTS.md`를 읽는 도구 호출(Tool Call) 1회가 발생하지만, 완벽한 일관성과 유지보수 편의성이 이 비용을 압도함.
