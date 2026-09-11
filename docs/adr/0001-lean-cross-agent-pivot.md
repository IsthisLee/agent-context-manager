# Architecture Decision Record (ADR) 0001: 린 크로스 에이전트 하네스로의 피벗

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-12
* **결정자:** Isthis & Antigravity

---

## 1. 배경 및 초기 설계 (Context)

초기 설계(`legacy/260912/docs/agentic/`)는 에이전틱 개발 환경을 구축하기 위해 다음과 같은 거대한 프레임워크 개발을 구상했다:
* 독자적인 TypeScript CLI (`agentic run`, `agentic doctor`) 개발
* `packages/contracts`, `packages/runner`를 통한 독자적 에이전트 상태 머신 프로그래밍
* 0단계부터 10단계까지 이어지는 엄격한 순차적 워터폴 구축 프로세스

---

## 2. 발견된 문제점 및 2026년 AI 생태계 현실 (Problems & Drivers)

철저한 다방면 기술 검토를 통해 초기 설계의 심각한 결함과 시장 현실이 드러났다:

1. **바퀴의 재발명 (Reinventing the Runner):**
   * 에이전트 추론 루프, 터미널 실행, 컨텍스트 압축 등은 이미 설치된 공식 CLI(`claude`, `codex`, `agy`)에 고도화되어 있다.
   * 독자 래퍼(`agentic run`)를 만들면 각 공식 CLI의 잦은 업데이트마다 래퍼가 깨지는 극심한 유지보수 부담이 발생한다.

2. **2026년 최신 연구 결과 (Anthropic 2026-03-24):**
   * Anthropic의 공식 연구(*Harness design for long-running application development*)는 가상 에이전트 팀(Analyst, Builder, QA 등)의 복잡한 오케스트레이션이 오버헤드와 실패율만 높인다는 점을 지적했다.
   * 복잡한 팀 구성보다 **"단일 에이전트 + 결정론적 테스트 피드백 루프(TDD)"**가 훨씬 높은 성공률을 보인다.

3. **기존 오픈소스의 단일 벤더 락인 (Vendor Lock-in):**
   * 시중의 유명 하네스 오픈소스(`revfactory/harness`, `Archon` 등)는 100% Claude Code(`.claude/`) 전용이다.
   * 현재 시장에는 **OpenAI Codex, Anthropic Claude Code, Google Antigravity, Cursor를 단일 규칙으로 묶어주는 크로스 플랫폼 도구가 부재**하다.

---

## 3. 결정 사항 (Decision)

우리는 무거운 자체 러너 개발을 전면 폐기하고, **"린 크로스 에이전트 하네스 & 검증 툴킷 (Lean Cross-Agent Harness & Verification Kit)"**으로 피벗한다:

1. **단일 진실 공급원 (SSOT):**
   * 모든 코딩 원칙과 보안 규칙을 `specifications/`에 한 번만 정의한다.
2. **원클릭 멀티 에이전트 동기화 (Multi-Agent Generator):**
   * `agentic init` / `sync` 명령 하나로 `AGENTS.md`(Codex), `CLAUDE.md`(Claude), `.gemini/rules/`(Antigravity)를 동시 생성하여 지침 파편화를 원천 차단한다.
3. **OS 네이티브 결정론적 검증 (Deterministic TDD):**
   * 에이전트의 자기 선언이 아닌, 실제 테스트 실행과 기계 증거(`last-check.json`)로만 완료를 판정한다.
4. **관심사 분리 및 서브에이전트 기반 규칙 승격 (Subagent Promotion):**
   * 프로젝트 고유 로직과 범용 하네스를 분리하고, 서브에이전트를 통해 순수 기술 패턴만 Core로 승격한다.

---

## 4. 결과 및 영향 (Consequences)

* **긍정적 영향:**
  * 유지보수 불가능한 수천 줄의 래퍼 코드 작성 부담 제거.
  * Codex, Claude Code, Antigravity 어디서나 10초 만에 프로젝트에 꽂아 쓸 수 있는 극도의 이식성 확보.
  * 범용 오픈소스 하네스와 개별 프로젝트 간의 깔끔한 모듈식 아키텍처 확보.
* **유보/폐기된 사항:**
  * 자체 모델 추론 래퍼, SQLite 동시 writer, 중앙 웹 대시보드 구축 등은 과잉 엔지니어링으로 폐기함.
