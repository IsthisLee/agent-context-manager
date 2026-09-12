# Agentic

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Supported Agents](https://img.shields.io/badge/AI_Agents-Codex%20%7C%20Claude%20%7C%20AGY%20%7C%20Cursor%20%7C%20Copilot-orange.svg)](#-지원하는-5대-ai-에이전트)

> **"특정 벤더에 종속되지 않고, 5대 AI 에이전트(Codex, Claude Code, Antigravity, Cursor, GitHub Copilot)가 내 프로젝트에서 환각 없이 결정론적 TDD로 일하게 만드는 크로스 에이전트 개발 하네스 & 검증 툴킷"**

---

## 💡 왜 Agentic인가? (Why Agentic?)

1. **에이전트 파편화(Vendor Lock-in) 종식:**  
   OpenAI(`AGENTS.md`), Anthropic(`CLAUDE.md`), Google Antigravity(`.gemini/rules/`), Cursor(`.cursor/rules/`), GitHub Copilot(`.github/copilot-instructions.md`) 등 에이전트마다 설정 규격이 제각각입니다. `agentic`은 **단일 진실 공급원(SSOT)**에서 모든 에이전트용 지침을 오차 없이 일괄 자동 생성합니다.
2. **환각 방지 및 결정론적 TDD (Deterministic Verification):**  
   에이전트의 "코드 다 짰습니다"라는 구두 선언을 믿지 않습니다. 실제 테스트 실행 결과(`exitCode 0`, `passCount > 0`)와 기계 판독 가능한 증거 파일(`.agentic/last-check.json`)로만 완료를 검증합니다.
3. **관심사 분리 및 보안 (Separation of Concerns & Security):**  
   범용 개발 하네스 설정과 프로젝트 고유 비즈니스 로직을 깔끔하게 분리합니다. `.env`나 API 키 같은 민감한 정보가 프롬프트나 커밋에 노출되지 않도록 가드레일을 제공합니다.
4. **가벼움과 제로 런타임 의존성 (Zero Dependencies):**  
   복잡한 파이썬 환경이나 무거운 래퍼 없이, Node.js 20+ 순수 내장 기능만으로 어디서나 1초 만에 실행됩니다.

---

## 🤖 지원하는 5대 AI 에이전트

동기화 명령 한 번으로 다음 5개 파일이 프로젝트에 자동 주입되어 모든 에이전트가 동일한 규칙을 공유합니다:

| 에이전트 | 자동 생성 파일 | 주요 역할 및 특징 |
|---|---|---|
| **OpenAI Codex** | [`AGENTS.md`](templates/AGENTS.md) | 터미널 CLI 기반 자율 코딩 |
| **Claude Code** | [`CLAUDE.md`](templates/CLAUDE.md) | 터미널 대화형 diff 리뷰 및 심층 리팩터링 |
| **Google Antigravity (AGY)** | [`.gemini/rules/agentic.md`](templates/gemini-rules/agentic.md) | 고차원 플래닝, 서브에이전트, 아티팩트 보고 |
| **Cursor** | [`.cursor/rules/agentic.mdc`](templates/cursor-rules/agentic.mdc) | IDE 인라인 코드 작성 및 룰셋 자동 적용 |
| **GitHub Copilot** | [`.github/copilot-instructions.md`](templates/copilot-instructions.md) | VS Code / JetBrains IDE 에이전트 및 PR 리뷰 |

---

## 🚀 사용법 (Quickstart)

### 1. 프로젝트에 하네스 설치 (10초)

작업하려는 프로젝트 디렉터리에서 **설치 없이 `npx`로 즉시 실행**합니다:

```bash
# GitHub 원격 저장소에서 바로 실행 (오픈소스 기본):
npx github:IsthisLee/agentic init

# 또는 npm 패키지로 실행:
npx @isthis/agentic init
```

> **선택 사항 (다양한 설치 방식 지원):**
> * **전역 CLI로 설치:** `npm install -g @isthis/agentic` 실행 후 `agentic init`
> * **프로젝트 개발 의존성으로 추가:** `npm install -D @isthis/agentic` 후 `npx agentic sync`
> * **로컬 저장소에서 직접 실행:** `node /path/to/agentic/bin/agentic.mjs init`

👉 **프로젝트에 자동 구성되는 항목:**
* 5대 에이전트 지침 파일 (`AGENTS.md`, `CLAUDE.md`, `.gemini/rules/`, `.cursor/rules/`, `.github/copilot-instructions.md`)
* 결정론적 진단 도구 (`tools/agentic/doctor.mjs`)
* 결정론적 TDD 자가 검증 도구 (`tools/agentic/check.mjs`)
* `.gitignore` 자동 보완 (`.agentic/last-check.json`, `.DS_Store` 등)

### 2. 평소 쓰던 에이전트 그대로 실행

* **Claude Code:** 터미널에서 `claude` 실행
* **Codex:** 터미널에서 `codex` 실행
* **Antigravity:** IDE에서 바로 세션 실행
* **Cursor / Copilot:** IDE 에디터에서 에이전트 실행

👉 어떤 에이전트를 열든 동일한 프로젝트 지침을 읽고, 코드 수정 후 스스로 `npm run check`를 실행해 검증하며 작업합니다.

### 3. 진단 및 자가 검증

```bash
# 에이전트 지침 및 환경 진단
node tools/agentic/doctor.mjs

# 에이전트 자가 검증 (테스트 실행 및 JSON 증거 생성)
node tools/agentic/check.mjs
```

---

## 📂 저장소 구조

```text
agentic/
├── bin/
│   └── agentic.mjs              # 동기화 및 진단 CLI
├── specifications/              # [SSOT] 모든 프로젝트에 적용될 단일 정본 규칙
│   ├── core-principles.md       # TDD 원칙, 환각 방지, 증거 우선
│   ├── security-boundaries.md   # 관심사 분리, 비밀값 보호, 안전 수칙
│   └── agent-contracts.md       # 5대 에이전트별 라이프사이클 계약
├── templates/                   # 프로젝트에 주입되는 템플릿 파일
│   ├── AGENTS.md                # Codex 템플릿
│   ├── CLAUDE.md                # Claude Code 템플릿
│   ├── gemini-rules/            # Antigravity 템플릿
│   ├── cursor-rules/            # Cursor 템플릿 (.mdc)
│   ├── copilot-instructions.md  # GitHub Copilot 템플릿
│   └── tools/                   # doctor.mjs, check.mjs 템플릿
├── evals/                       # 자체 검증용 합성 프로젝트
│   └── synthetic/               # 합성 예제 및 자동화 테스트
├── docs/                        # 상세 기술 문서 및 ADR
│   ├── README.md                # 문서 목차
│   ├── architecture.md          # 3계층 아키텍처 개요
│   ├── workflow.md              # 실전 워크플로 가이드
│   ├── adr/                     # 아키텍처 결정 기록
│   └── references.md            # 공식 참고 문헌 및 비교 분석
└── package.json
```

---

## 🛠️ 프로젝트별 커스텀 규칙 확장

`agentic init`으로 생성된 `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/` 등은 **독립된 사본**입니다.
* 각 프로젝트에 특화된 DB 스키마, 아키텍처 제약, API 컨벤션은 생성된 파일의 하단에 자유롭게 추가하여 사용합니다.
* 오픈소스 원본의 공통 규칙은 안전하게 보호되며, 프로젝트별 설정이 원본 저장소로 역류하지 않습니다.

---

## 🤝 기여하기 (Contributing)

공통 코어 규칙이나 검증 도구 개선 제안은 언제나 환영합니다!
1. 이 저장소를 Fork합니다.
2. 새 브랜치를 생성하고 개선 사항을 반영합니다 (`git checkout -b feat/my-improvement`).
3. 자체 검증 테스트(`npm test`)를 통과하는지 확인합니다.
4. Pull Request(PR)를 제출합니다.

---

## 📄 라이선스 (License)

이 프로젝트는 [Apache License 2.0](LICENSE)을 따릅니다.
누구나 자유롭게 수정, 배포, 상업적 이용이 가능합니다.
