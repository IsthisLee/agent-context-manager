# Architecture Overview

`agentic`은 **5대 크로스 에이전트(Codex, Claude Code, Antigravity, Cursor, GitHub Copilot)를 위한 린(Lean) 개발 하네스이자 결정론적 검증 툴킷**이다.

---

## 1. 시스템 핵심 구성 요소 (Core Components)

`agentic`은 복잡한 프레임워크나 무거운 런타임이 아닌, 간결하고 결정론적인 3가지 핵심 요소로 구성된다:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. AGENTS.md Template & Pointer Adapters                    │
│    - templates/AGENTS.md (대상 프로젝트 SSOT 생성 템플릿)   │
│    - CLAUDE.md, .gemini/, .cursor/, .github/ 포인터 템플릿  │
└──────────────────────────────┬──────────────────────────────┘
                               │ 대상 프로젝트 지침 생성
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CLI Sync Engine (지침 변환 및 배포 엔진)                 │
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
│  - AGENTS.md 템플릿, 5대 에이전트 포인터, CLI, 검증 도구 원본 │
│  - npm 패키지: @isthis/agentic                         │
└──────────────────────────┬─────────────────────────────┘
                           │  agentic init
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

- 대상 프로젝트에는 무거운 `agentic-core` 패키지가 런타임 의존성으로 설치되지 않는다.
- 프로젝트는 오직 에이전트가 읽을 **지침 파일**과 독립 실행 가능한 **경량 검증 스크립트(`tools/`)**만 전달받는다.
- 따라서 `agentic`이 없어도 프로젝트 본연의 빌드와 테스트(`npm test`)는 100% 정상 작동한다.

### 2) 규칙 커스텀과 Upstream 동기화

- **프로젝트 레벨 커스텀:** 주입된 지침 파일(`AGENTS.md` 등)은 해당 프로젝트의 소유물이므로, 프로젝트 고유의 아키텍처나 도메인 규칙을 자유롭게 덧붙여서 사용한다.
- **코어 레벨 커스텀 (내 코어 관리):**
  - 사용자가 `agentic` 자체를 Fork하여 "나만의 코어 템플릿"을 유지할 수 있다.
  - 다른 사람의 PR이 원본에 머지되어 Upstream이 업데이트되었을 때는, **Git의 표준 기능(`git merge upstream/main`)**을 통해 내 커스텀을 보존하며 최신 개선사항을 안전하게 병합한다.

### 3) 결정론적 기계 검증 (Deterministic Verification)

- AI 에이전트의 구두 완료 보고는 신뢰하지 않는다.
- 반드시 실제 테스트 명령을 수행하여 생성된 `.agentic/last-check.json`의 `exitCode: 0`을 통해서만 완료를 확정한다. [`[근거: Anthropic Evals 연구]`](references.md#anthropic-demystifying-evals)

### 4) 점진적 공개 기반 컨텍스트 엔지니어링 (Progressive Disclosure)

- **지도와 서랍 (Map & Drawer) 구조:**
  - 루트의 `AGENTS.md`는 불변의 핵심 규약과 지식 목차(Index)만 담는 "지도"로서 150줄 이내로 간결하게 유지한다.
  - 결제, DB 마이그레이션, 배포 파이프라인 등 방대한 도메인 지식은 `docs/` 디렉터리의 "서랍" 파일들로 분리한다.
- **엔지니어링 근거:**
  - **Anthropic & OpenAI 공식 권장 일치:** OpenAI의 *Custom instructions with AGENTS.md*([`[근거]`](references.md#openai-agents-md))와 Anthropic의 *Effective context engineering for AI agents*([`[근거]`](references.md#anthropic-context-engineering)) 양대 연구 모두, 루트 지침을 모듈식 인덱스로 간결하게 유지하고 상세 도메인 문서를 분리하여 온디맨드로 로딩하는 패턴을 공식 모범 사례로 규정한다.
  - **주의력 희석(Attention Dilution) 방지:** 수천 줄의 지침이 프롬프트에 통째로 들어가면 모델이 핵심 규약(TDD, 보안)을 망각하는 'Lost in the Middle' 현상이 발생한다. [`[근거: Stanford 연구]`](references.md#stanford-lost-in-the-middle)
  - **토큰 비용 및 응답 속도 최적화:** 무관한 도메인 지침이 매 턴(Turn)마다 주입되는 낭비를 차단하고, 에이전트가 해당 도메인 작업을 할 때만 파일 읽기 도구로 온디맨드 로딩하게 유도한다.
  - `doctor.mjs`의 `AGENTS.md Size` 진단을 통해 150줄 초과 시 경고를 출력하여 시스템 차원에서 점진적 분리를 자동 유도한다.

