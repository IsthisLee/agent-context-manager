# Agentic

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Supported Agents](https://img.shields.io/badge/AI_Agents-Codex%20%7C%20Claude%20%7C%20AGY%20%7C%20Cursor%20%7C%20Copilot-orange.svg)](#-5대-에이전트-단일-정본-ssot-구조)

> **"개발자는 오직 `AGENTS.md` 딱 하나에만 프로젝트의 모든 지침을 작성하고 관리하시면 됩니다!"**  
> 특정 벤더에 종속되지 않고, 5대 AI 에이전트(Codex, Claude Code, Antigravity, Cursor, GitHub Copilot)가 내 프로젝트에서 환각 없이 **결정론적 TDD**로 일하게 만드는 크로스 에이전트 개발 하네스 & 검증 툴킷.

---

## 🎯 Agentic이 해결하는 4대 핵심 문제

### 1. 서브에이전트 과잉 오케스트레이션과 높은 실패율 종식 (Simplification)
* **문제:** 수많은 가상 에이전트(Analyst, Builder, Reviewer, QA)를 붙이고 복잡한 오케스트레이터를 돌려봤자, 컨텍스트 오버헤드와 토큰 낭비, 에이전트 간 핑퐁으로 인해 **복잡도만 늘고 실패율이 치솟았습니다.** (Anthropic 2026-03-24 연구 실증)
* **해결:** 복잡한 오케스트레이션을 전면 폐기하고, **"단일 에이전트 + 결정론적 TDD 루프(Red-Green-Refactor)"**로 극단적 단순화를 이루어 작업 성공률을 극대화합니다.

### 2. 5대 AI 에이전트의 극심한 설정 파편화 해결 (Cross-Agent SSOT)
* **문제:** OpenAI(`AGENTS.md`), Anthropic(`CLAUDE.md`), Google(`gemini/rules`), Cursor(`.cursor/rules`), Copilot(`.github/`) 등 에이전트마다 규격이 제각각이라, 도구를 바꿀 때마다 규칙이 따로 놀고 유지보수가 불가능했습니다.
* **해결:** `agentic init` 단 한 번으로 5대 에이전트 지침을 동시 구성합니다. **`AGENTS.md`를 프로젝트 내 유일한 단일 진실 공급원(SSOT)**으로 삼고 나머지 파일들이 이를 참조하게 만들어, **개발자는 `AGENTS.md` 딱 하나만 관리**하면 됩니다.

### 3. 에이전트의 환각과 거짓 완료 보고 원천 차단 (Deterministic Evals)
* **문제:** 에이전트가 코드를 짠 뒤 "테스트를 다 통과했습니다"라고 거짓말(환각)을 하거나 회귀 버그를 내도 사람이 터미널을 열기 전까지 알 수 없었습니다.
* **해결:** 프로젝트에 자가 검증 러너(`tools/agentic/check.mjs`)를 심어주고, 실제 테스트(`npm test`)를 통과하여 `exitCode: 0` 기계 판독 증거(`.agentic/last-check.json`)가 생성되지 않으면 **작업 완료를 인정하지 않는 결정론적 가드레일**을 강제합니다. (테스트 0개는 실패 처리)

### 4. 프로젝트 기술 스택 및 제약사항 자동 감지 (Zero-Configuration)
* **문제:** 프레임워크(Next.js App Router 등)의 특수한 규칙이나 DB 마이그레이션 정책을 에이전트에게 일일이 수동으로 알려주기 번거로웠습니다.
* **해결:** `init` 실행 시 프로젝트를 자동 분석하여 **Next.js App Router(RSC / 'use client' 규칙)**, **TypeScript**, **Prisma/Drizzle**, **패키지 매니저(pnpm/yarn/npm)**를 즉시 감지하고 `AGENTS.md`에 최적화된 제약 지침을 자동으로 요약 주입합니다.

---

## 🤖 5대 에이전트 단일 정본 (SSOT) 구조

명령어 한 번으로 프로젝트에 주입되며, 모든 에이전트가 `AGENTS.md` 단일 정본을 바라봅니다:

```text
내 프로젝트/
├── AGENTS.md                     ◀── [단일 정본 SSOT] 개발자는 이 파일 하나만 작성/관리!
│                                     (TDD 규약, Next.js/DB 자동 감지 제약, 비즈니스 룰)
│
├── CLAUDE.md                     ◀── Claude Code (@AGENTS.md 자동 인클루드)
├── .gemini/rules/agentic.md      ◀── Google Antigravity (AGENTS.md 참조)
├── .cursor/rules/agentic.mdc     ◀── Cursor (AGENTS.md 참조)
├── .github/copilot-instructions  ◀── GitHub Copilot (AGENTS.md 참조)
└── tools/agentic/
    ├── check.mjs                 ◀── TDD 자가 검증 러너 (npm run check)
    └── doctor.mjs                ◀── 에이전트 환경 및 지침 진단 도구
```

---

## 🚀 빠른 시작 (Quickstart)

### 1. 전역 설치 후 사용 (권장 - 가장 간결함)

```bash
# 전역 설치 (최초 1회)
npm install -g @isthis/agentic

# 대상 프로젝트 폴더로 이동 후 초기화
agentic init
```

> **무설치 1회성 실행을 원할 때 (`npx`):**  
> 전역 설치 없이 즉시 실행하려면: `npx @isthis/agentic init` (또는 `npx github:IsthisLee/agentic init`)

👉 **초기화 완료 시 자동 구성되는 항목:**
* 프로젝트 기술 스택(Next.js, TS, DB 등)이 자동 요약된 `AGENTS.md` (SSOT) 생성
* 5대 에이전트 연동 지침 파일 자동 생성
* 로컬 검증 도구 (`tools/agentic/check.mjs`, `doctor.mjs`) 설치
* `package.json`에 `"check": "node tools/agentic/check.mjs"` 자동 등록

---

### 2. 평소 쓰던 에이전트 그대로 개발

* **OpenAI Codex:** 터미널에서 `codex` 실행
* **Claude Code:** 터미널에서 `claude` 실행
* **Antigravity:** IDE에서 세션 실행
* **Cursor / Copilot:** IDE 에디터에서 에이전트 실행

👉 어떤 에이전트를 열든 `AGENTS.md`의 규칙에 따라 **Red-Green TDD**로 작업하며, 코드 수정 후 스스로 `npm run check`를 실행하여 통과 여부를 검증합니다.

---

### 3. 일상 명령어

```bash
# 에이전트 자가 검증 (테스트 실행 및 기계 증거 생성)
npm run check
# 또는: agentic check

# 에이전트 환경 및 지침 정합성 진단
agentic doctor
# 또는: node tools/agentic/doctor.mjs

# 최신 코어 규칙 동기화
agentic sync
```

---

## 💡 프로젝트 규칙 작성 가이드 (개발자 팁)

> **"개발자는 오직 `AGENTS.md` 딱 하나에만 프로젝트의 모든 지침을 작성하고 관리하시면 됩니다!"**

* **공통 규약 및 핵심 제약:** `AGENTS.md` 상단에 자동으로 배치됩니다.
* **프로젝트 맞춤 규칙:** `AGENTS.md`의 `## 4. 프로젝트 규칙 확장 (SSOT)` 아래에 자유롭게 작성하세요.
* **프로젝트가 커질 때 (점진적 로딩 권장):**
  * `AGENTS.md`는 1~2쪽 이내의 **지도(Map / 색인)**로 유지하고,
  * 결제 규약, 방대한 DB 정책 등 긴 문서는 `docs/payments.md`, `docs/database.md`로 분리하여 링크하세요. 에이전트가 필요한 순간에만 온디맨드로 읽어 토큰을 아끼고 환각을 방지합니다.

---

## 📂 저장소 구조

```text
agentic/
├── bin/
│   ├── agentic.mjs              # init, sync, doctor, check CLI
│   └── analyzer.mjs             # Next.js, TS, DB 등 프로젝트 제약 자동 감지 엔진
├── specifications/              # [SSOT] 모든 에이전트가 따를 코어 개발 원칙
│   ├── core-principles.md       # 결정론적 TDD 원칙, 최소 변경, 증거 우선
│   ├── security-boundaries.md   # 관심사 분리, 비밀값 보호, 안전 수칙
│   └── agent-contracts.md       # 5대 에이전트별 라이프사이클 계약
├── templates/                   # 프로젝트에 주입되는 템플릿
│   ├── AGENTS.md                # 단일 정본 템플릿 (SSOT)
│   ├── CLAUDE.md                # Claude Code 인클루드 템플릿 (@AGENTS.md)
│   ├── gemini-rules/            # Antigravity 템플릿
│   ├── cursor-rules/            # Cursor 템플릿 (.mdc)
│   ├── copilot-instructions.md  # GitHub Copilot 템플릿
│   └── tools/                   # doctor.mjs, check.mjs 템플릿
├── evals/                       # 자체 검증용 테스트 스위트
│   ├── analyzer.test.mjs        # 프로젝트 분석기 단위 테스트
│   └── synthetic/               # 합성 예제 및 TDD 검증
├── docs/                        # 상세 기술 문서 및 ADR
│   ├── architecture.md          # 아키텍처 개요
│   ├── workflow.md              # 실전 워크플로 가이드
│   ├── references.md            # 2026 공식 참고 문헌 및 비교 분석
│   └── adr/                     # 아키텍처 결정 기록
└── package.json
```

---

## 📄 라이선스 (License)

이 프로젝트는 [Apache License 2.0](LICENSE)을 따릅니다. 누구나 자유롭게 수정, 배포, 상업적 이용이 가능합니다.
