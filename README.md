# Agentic

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Supported Agents](https://img.shields.io/badge/AI_Agents-Codex%20%7C%20Claude%20%7C%20AGY%20%7C%20Cursor%20%7C%20Copilot-orange.svg)](#-5대-에이전트-단일-정본-ssot-구조)

> **"개발자는 오직 `AGENTS.md` 딱 하나에만 프로젝트의 모든 지침을 작성하고 관리하시면 됩니다!"**  
> 특정 벤더에 종속되지 않고, 5대 AI 에이전트(Codex, Claude Code, Antigravity, Cursor, GitHub Copilot)가 내 프로젝트에서 환각 없이 **결정론적 TDD**로 일하게 만드는 크로스 에이전트 개발 하네스 & 검증 툴킷.

Agentic은 여러 AI 코딩 도구가 각 프로젝트를 안전하고 일관되게 개발하도록, 공통 규칙·검증·프로젝트 이해·작업 전략을 제공하는 제어 계층입니다. **에이전트를 실행·통제하는 런타임이 아니라, 모든 에이전트가 동일하고 안전하게 일하는 프로젝트 환경을 만드는 것이 목표입니다.**

---

## 핵심 원칙과 기능

* `AGENTS.md`를 공통 규칙의 SSOT로 관리하고, 도구별 지침은 동기화합니다.
* `npm run check` 같은 프로젝트 네이티브 명령으로 결과를 결정론적으로 검증합니다.
* 프로젝트 스택·제약·검증 방법을 `ProjectProfile`로 분석합니다.
* 일반 작업은 단일 에이전트가 계획 → 구현 → 테스트 → 디버깅 루프로 수행합니다.
* 복잡하거나 고위험·병렬 가능한 작업에만 리뷰 또는 가상 팀 분업을 선택합니다.
* Claude Code·Codex 등의 CLI를 감싸는 자체 런타임은 만들지 않습니다.
* Agentic은 범용 규칙·정책·검증 계약을, 대상 프로젝트는 비즈니스 코드·실제 테스트를 보유합니다.

---

## 🎯 Agentic이 해결하는 5대 핵심 문제

### 1. 자체 러너 재발명과 과도한 오케스트레이션 방지 (Lean Runtime Boundary)
* **문제:** Claude Code, Codex, Antigravity 같은 에이전트 런타임을 자체 래퍼로 감싸면, 벤더별 CLI·인증·세션·출력 형식 변화까지 직접 유지보수해야 합니다. 동시에 Analyst, Builder, Reviewer, QA를 상시 연결하면 handoff, 오케스트레이션, 토큰 비용, 실행 시간이 함께 늘어납니다. Anthropic의 장기 코딩 하네스 실험에서도 멀티 에이전트 하네스는 더 풍부한 결과를 만들 수 있었지만, Solo 실행보다 훨씬 높은 비용과 실행 시간을 필요로 했습니다. ([Anthropic, *Harness design for long-running application development*](https://www.anthropic.com/engineering/harness-design-long-running-apps))
* **해결:** `agentic run` 같은 자체 에이전트 런타임을 만들지 않습니다. 공식 CLI와 IDE가 모델 호출·인증·세션을 소유하고, Agentic은 **"단일 에이전트 + 결정론적 TDD 루프(Red-Green-Refactor)"**를 기본값으로 제공합니다. 작업이 복잡하거나 위험할 때만 Planner·Reviewer·Evaluator를 선택적으로 추가합니다.

### 2. 템플릿 부패와 에이전트 설정 파편화 해결 (Cross-Agent SSOT)
* **문제:** 프로젝트마다 지침과 검증 도구를 복사해 두면 프롬프트 개선과 도구 버그 수정이 누락되어 Template Rot이 발생합니다. 또한 Codex(`AGENTS.md`), Claude Code(`CLAUDE.md`), Antigravity(`.gemini/rules/`), Cursor(`.cursor/rules/`), Copilot(`.github/`)은 서로 다른 지침 위치를 요구하므로 규칙이 쉽게 갈라집니다.
* **해결:** `agentic init`과 `sync`가 5대 에이전트 지침과 검증 도구를 동기화합니다. **`AGENTS.md`를 프로젝트 내 유일한 단일 진실 공급원(SSOT)**으로 삼고 나머지 파일은 이를 참조하게 만들어, 개발자는 한 곳에서만 규칙을 관리합니다.

### 3. 에이전트의 환각과 거짓 완료 보고 원천 차단 (Deterministic Evals)
* **문제:** 에이전트가 코드를 짠 뒤 "테스트를 다 통과했습니다"라고 거짓말(환각)을 하거나 회귀 버그를 내도 사람이 터미널을 열기 전까지 알 수 없었습니다.
* **해결:** 프로젝트에 자가 검증 러너(`tools/agentic/check.mjs`)를 심어주고, 실제 테스트(`npm test`)를 통과하여 `exitCode: 0` 기계 판독 증거(`.agentic/last-check.json`)가 생성되지 않으면 **작업 완료를 인정하지 않는 결정론적 가드레일**을 강제합니다. (테스트 0개는 실패 처리)

### 4. 프로젝트 기술 스택 및 제약사항 자동 감지 (Zero-Configuration)
* **문제:** 프레임워크, 테스트 구성, 데이터 경계 같은 프로젝트 제약을 에이전트에게 매번 수동으로 설명하면 누락과 작업 방식의 불일치가 발생합니다.
* **해결:** `agentic analyze`가 프로젝트 프로필(ProjectProfile)을 만들고, Next.js App Router, TypeScript, Prisma/Drizzle, 패키지 매니저, 테스트 명령 등 작업에 필요한 제약을 감지해 `AGENTS.md`에 요약합니다.

### 5. 작업별 적응형 역할 선택 (Adaptive Harness)
* **문제:** 모든 작업에 멀티 에이전트를 붙이면 비용과 handoff가 늘고, 반대로 복잡하거나 고위험인 변경까지 단일 에이전트에만 맡기면 계획과 검토가 부족할 수 있습니다.
* **해결:** `agentic plan`이 작업 복잡도, 위험도, 병렬 가능성에 맞춰 실행 방식을 선택합니다.
  * **일반적이고 명확한 작업:** 한 에이전트가 계획 → 구현 → 테스트 → 디버깅을 수행합니다.
  * **고위험 변경:** 독립 Reviewer 또는 Verifier를 추가해 변경 근거와 검증 결과를 분리합니다.
  * **크고 병렬 분해 가능한 작업:** Planner, Builder, Reviewer, QA 역할을 가진 가상 팀을 구성할 수 있습니다.
  * **가상 팀 사용 조건:** 작업 단위가 독립적이고, 역할 간 전달 artifact와 완료 기준이 명확할 때만 사용합니다. 그렇지 않으면 handoff 비용을 피하기 위해 단일 에이전트 루프를 유지합니다.

### 왜 상시 가상 팀 분업을 기본값으로 두지 않나요?

Agentic은 멀티 에이전트를 부정하지 않습니다. 다만 일상적인 실무 개발에서는 기획자·설계자·코더·QA 에이전트를 항상 별도로 실행하는 방식이 작업에 비해 과할 수 있으므로, 다음과 같은 이유로 단일 에이전트 루프를 기본값으로 삼습니다.

* **작업 단위가 작을수록 분업 비용이 커집니다:** 여러 에이전트 사이의 handoff가 늘어나면 요구사항과 구현 맥락을 전달·동기화하는 추가 작업이 발생합니다. Anthropic도 장기 작업에서 컨텍스트 리셋과 구조화된 handoff가 오케스트레이션 복잡도, 토큰 오버헤드, 지연 시간을 추가한다고 설명합니다. ([Anthropic, *Harness design for long-running application development*](https://www.anthropic.com/engineering/harness-design-long-running-apps))
* **비용과 품질은 하나의 축이 아닙니다:** Anthropic의 비교 실험에서는 Solo 실행이 약 20분·$9, 전체 하네스 실행이 약 6시간·$200이었고, 전체 하네스가 더 풍부한 결과를 냈습니다. 따라서 “항상 단일 에이전트가 더 정확하다”가 아니라, 작업의 난이도와 품질 요구에 따라 추가 평가 비용을 선택해야 합니다. ([Anthropic, *Harness design for long-running application development*](https://www.anthropic.com/engineering/harness-design-long-running-apps))
* **검증은 에이전트 수보다 증거가 중요합니다:** Agentic은 에이전트 간 구두 승인을 늘리는 대신 `npm run check`로 실제 테스트를 실행하고 기계 판독 가능한 검증 증거를 남깁니다. ([Anthropic, *Demystifying evals for AI agents*](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents))
* **복잡한 작업에는 선택적 분업을 허용합니다:** 모델이 안정적으로 처리하기 어려운 작업이나 고위험 변경에는 리뷰어·평가자·전문 서브에이전트를 추가할 수 있습니다. 핵심은 팀 구성을 기본값으로 고정하지 않고 작업에 맞게 선택하는 것입니다.

### `revfactory/harness`와 Agentic의 위치

`revfactory/harness`는 Claude Code 환경에서 도메인별 에이전트 팀을 설계하고, 전문 에이전트가 사용할 스킬을 생성하는 **meta-skill**입니다. Agent Teams와 Subagents 같은 실행 모드와 여러 팀 구성 패턴을 제공합니다. ([`revfactory/harness` GitHub 저장소](https://github.com/revfactory/harness))

Agentic은 이 도구와 다른 계층을 다룹니다. 특정 Claude Code 팀을 생성하는 대신, Codex·Claude Code·Antigravity·Cursor·Copilot이 공유하는 규칙을 `AGENTS.md`에 모으고, 코드 변경 후 테스트가 실제로 통과했는지 검증하는 공통 계약을 제공합니다.

| 구분 | `revfactory/harness` | `agentic` |
|---|---|---|
| **주요 역할** | Claude Code 내부의 도메인별 팀·스킬 구성 | 여러 에이전트가 공유하는 규칙·검증 계약 |
| **핵심 문제** | 어떤 전문 에이전트와 팀 패턴을 사용할지 | 규칙 파편화와 검증되지 않은 완료 보고 |
| **기본 접근** | 필요에 따라 Agent Teams/Subagents 구성 | 단일 에이전트 + `npm run check` 기본 루프 |

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

### 1. 대상 프로젝트에 주입 (초기화)

작업할 프로젝트 디렉터리에서 명령어 한 줄로 즉시 초기화합니다:

```bash
# 무설치 원격 실행 (GitHub 직접 주입):
npx github:IsthisLee/agentic init

# 또는 로컬 agentic 도구로 직접 실행:
node /path/to/agentic/bin/agentic.mjs init
```

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
│   ├── architecture/            # 확정된 현재 아키텍처
│   ├── architecture-discussion/ # 논의·구현 중인 아키텍처 계약
│   ├── workflow.md              # 실전 워크플로 가이드
│   ├── references.md            # 2026 공식 참고 문헌 및 비교 분석
│   └── adr/                     # 아키텍처 결정 기록
└── package.json
```

---

## 📄 라이선스 (License)

이 프로젝트는 [Apache License 2.0](LICENSE)을 따릅니다. 누구나 자유롭게 수정, 배포, 상업적 이용이 가능합니다.
