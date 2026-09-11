# Agentic (Cross-Agent Harness & Verification Kit)

> **"특정 AI 에이전트에 갇히지 않고, 모든 에이전트(Codex, Claude Code, Antigravity, Cursor)가 내 프로젝트에서 거짓말하지 않고 TDD로 일하게 만드는 크로스 플랫폼 개발 하네스 & 검증 툴킷"**

---

## 💡 왜 필요한가? (Why Agentic?)

1. **에이전트 파편화(Vendor Lock-in) 극복:**  
   OpenAI(Codex `AGENTS.md`), Anthropic(Claude Code `CLAUDE.md`), Google(Antigravity `.gemini/rules/`), Cursor 등 에이전트마다 지침 규격이 제각각입니다. `agentic`은 **단일 진실 공급원(SSOT)**에서 모든 에이전트용 지침을 오차 없이 자동 생성합니다.
2. **환각 방지 및 결정론적 검증 (Deterministic TDD):**  
   에이전트의 "다 만들었습니다"라는 거짓말을 믿지 않고, 실제 테스트 실행 결과(`exitCode 0`, `passCount > 0`)와 기계 판독 가능한 증거 파일(`last-check.json`)로만 완료를 인정합니다.
3. **관심사 분리 및 보안 (Separation of Concerns & Security):**  
   공통 개발 하네스와 프로젝트 고유 코드를 깔끔하게 분리하고, `.env`나 API 키 같은 민감한 정보가 외부로 노출되지 않도록 안전하게 보호합니다.

---

## 🚀 사용법 (3초 퀵스타트)

### 1. 새 프로젝트에 에이전트 하네스 설치
작업하려는 프로젝트 디렉터리에서 다음 명령어를 실행합니다:

```bash
# agentic 저장소의 CLI를 이용해 대상 프로젝트 초기화
node /path/to/agentic/bin/agentic.mjs init .
```

👉 **자동 생성되는 파일:**
* `AGENTS.md` (OpenAI Codex / Copilot용)
* `CLAUDE.md` (Anthropic Claude Code용)
* `.gemini/rules/agentic.md` (Google Antigravity용)
* `tools/agentic/doctor.mjs` (환경 및 지침 상태 진단 스크립트)
* `tools/agentic/check.mjs` (결정론적 TDD 자가 검증 스크립트)
* `.gitignore` 자동 보완

### 2. 평소 쓰던 에이전트 그대로 개발
* **Claude Code:** 터미널에서 `claude` 실행
* **Codex:** 터미널에서 `codex` 실행
* **Antigravity:** IDE에서 바로 세션 실행
* 👉 에이전트들이 생성된 지침을 읽고, 코드 수정 후 스스로 `npm run check`를 실행해 검증하며 작업합니다.

### 3. 진단 및 검증
```bash
# 에이전트 지침 및 의존성 진단
node tools/agentic/doctor.mjs

# 에이전트 자가 검증 (테스트 실행 및 증거 생성)
node tools/agentic/check.mjs
```

---

## 📂 저장소 구조

```text
agentic/
├── bin/
│   └── agentic.mjs              # 동기화 및 진단 CLI
├── specifications/              # [SSOT] 모든 프로젝트에 적용될 핵심 원칙 정본
│   ├── core-principles.md       # TDD 원칙, 환각 방지, 증거 우선
│   ├── security-boundaries.md   # 자산 분리, 비밀값 보호, Git 안전 수칙
│   └── agent-contracts.md       # 에이전트별 라이프사이클 계약
├── templates/                   # 프로젝트에 주입되는 템플릿 파일
│   ├── AGENTS.md                # Codex 템플릿
│   ├── CLAUDE.md                # Claude Code 템플릿
│   ├── gemini-rules/            # Antigravity 템플릿
│   └── tools/                   # doctor.mjs, check.mjs 템플릿
├── evals/                       # 자체 검증용 합성 프로젝트
│   └── synthetic/               # calculator 합성 예제 및 테스트
├── legacy/                      # 이전 설계서 보존 (260912 백업)
└── package.json
```

---

## 🔄 규칙 개선 및 승격 워크플로 (Promote)

프로젝트 작업 중 유용한 범용 패턴을 발견했을 때:
1. **서브에이전트 위임:** 프로젝트 세션에서 서브에이전트를 호출하여 순수 기술 패턴만 `agentic/specifications/`에 추가하도록 위임합니다.
2. **직접 반영:** 회사 고유 명칭, 내부 비즈니스 로직을 철저히 배제하고 순수 추상화된 기술 규칙으로 `specifications/`에 커밋합니다.
3. **재동기화:** `agentic sync <project>` 명령으로 모든 프로젝트의 지침을 최신 상태로 갱신합니다.
