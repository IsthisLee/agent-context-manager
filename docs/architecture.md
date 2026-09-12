# Architecture Overview

`agentic`은 **5대 크로스 에이전트(Codex, Claude Code, Antigravity, Cursor, GitHub Copilot)를 위한 린(Lean) 개발 하네스이자 결정론적 검증 툴킷**이다.

---

## 1. 시스템 핵심 구성 요소 (Core Components)

`agentic`은 복잡한 프레임워크나 무거운 런타임이 아닌, 간결하고 결정론적인 3가지 핵심 요소로 구성된다:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Specification SSOT (규칙 단일 진실 공급원)               │
│    - specifications/core-principles.md (결정론적 TDD 원칙)  │
│    - specifications/security-boundaries.md (보안 경계)      │
│    - specifications/agent-contracts.md (5대 에이전트 계약)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ 단일 규칙 제공
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Multi-Agent Adapter & CLI Engine (지침 변환 및 배포 엔진)│
│    - bin/agentic.mjs : init, sync, doctor, check CLI       │
│    - templates/ : 5대 에이전트 네이티브 지침 파일 템플릿    │
│      (AGENTS.md, CLAUDE.md, .gemini/, .cursor/, .github/)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ 로컬 검증 도구 주입
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Deterministic Verification Kit (결정론적 검증 툴킷)      │
│    - templates/tools/doctor.mjs : 환경 및 지침 정합성 진단  │
│    - templates/tools/check.mjs  : TDD 테스트 실행 및 증거화 │
│    - .agentic/last-check.json   : 기계 검증 증거 파일       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 배포 모델 및 경계 분리 (Deployment Topology)

`agentic`은 **도구(Core)와 대상 프로젝트(App)를 엄격히 분리**한다. 프로젝트 코드베이스 내부에 불필요한 코어 프레임워크나 런타임을 두지 않는다.

```text
┌────────────────────────────────────────────────────────┐
│ [Upstream / Core] agentic 저장소 (오픈소스 도구)        │
│  - SSOT 규칙, 5대 에이전트 템플릿, CLI, 검증 도구 원본 │
│  - npm 패키지: @isthis/agentic                         │
└──────────────────────────┬─────────────────────────────┘
                           │  npx agentic init
                           ▼ 주입 (Scaffolding)
┌────────────────────────────────────────────────────────┐
│ [Downstream] 대상 프로젝트 (사용자의 실제 앱)           │
│                                                        │
│  [순수 제품 코드]                                      │
│  - src/, tests/, package.json, DB 스키마 등            │
│                                                        │
│  [주입된 에이전트 지침 및 검증 도구]                   │
│  - AGENTS.md, CLAUDE.md (프로젝트 규칙 및 TDD 지침)    │
│  - .gemini/rules/agentic.md, .cursor/rules/agentic.mdc │
│  - tools/agentic/doctor.mjs, check.mjs                 │
│  - .agentic/last-check.json (검증 증거, git-ignored)   │
│                                                        │
│  [AI 런타임] Codex, Claude Code, Antigravity 등        │
│  - 지침을 읽고 Red-Green TDD 실행                      │
│  - check.mjs로 기계 검증 증거 확인 후 완료 보고        │
└────────────────────────────────────────────────────────┘
```

---

## 3. 핵심 설계 원칙

### 1) 프로젝트의 독립성 (No Core in Project)
* 대상 프로젝트에는 무거운 `agentic-core` 패키지가 런타임 의존성으로 설치되지 않는다.
* 프로젝트는 오직 에이전트가 읽을 **지침 파일**과 독립 실행 가능한 **경량 검증 스크립트(`tools/`)**만 전달받는다.
* 따라서 `agentic`이 없어도 프로젝트 본연의 빌드와 테스트(`npm test`)는 100% 정상 작동한다.

### 2) 규칙 커스텀과 Upstream 동기화
* **프로젝트 레벨 커스텀:** 주입된 지침 파일(`AGENTS.md` 등)은 해당 프로젝트의 소유물이므로, 프로젝트 고유의 아키텍처나 도메인 규칙을 자유롭게 덧붙여서 사용한다.
* **코어 레벨 커스텀 (내 코어 관리):**
  * 사용자가 `agentic` 자체를 Fork하여 "나만의 코어 템플릿"을 유지할 수 있다.
  * 다른 사람의 PR이 원본에 머지되어 Upstream이 업데이트되었을 때는, **Git의 표준 기능(`git merge upstream/main`)**을 통해 내 커스텀을 보존하며 최신 개선사항을 안전하게 병합한다.

### 3) 결정론적 기계 검증 (Deterministic Verification)
* AI 에이전트의 구두 완료 보고는 신뢰하지 않는다.
* 반드시 실제 테스트 명령을 수행하여 생성된 `.agentic/last-check.json`의 `exitCode: 0`과 `passCount > 0`을 통해서만 완료를 확정한다.
