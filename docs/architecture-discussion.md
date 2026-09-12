# Architecture Discussion

최종 확인일: **2026-09-12**

이 문서는 현재 `agentic` 저장소의 구현과 목표 아키텍처 사이의 차이를 기록하고, 향후 개편 방향을 논의하기 위한 문서다. 채택된 설계 결정을 기록하는 ADR이 아니라, 개편 작업의 범위와 우선순위를 정리하는 분석 문서다.

## 목차

1. [현재 저장소의 부족한 점](#1-현재-저장소의-부족한-점)
2. [목표 아키텍처](#2-목표-아키텍처)
3. [프로젝트 분석 기능](#3-프로젝트-분석-기능)
4. [역할 계약](#4-역할-계약)
5. [역할 선택 정책](#5-역할-선택-정책)
6. [Handoff와 artifact](#6-handoff와-artifact)
7. [결정론적 검증 개편](#7-결정론적-검증-개편)
8. [권장 개편 순서](#8-권장-개편-순서)
9. [외부 도구와의 관계](#9-외부-도구와의-관계)
10. [핵심 설계 결정 후보](#10-핵심-설계-결정-후보)

## 1. 현재 저장소의 부족한 점

| 요구사항 | 현재 상태 | 개편 방향 |
|---|---|---|
| 프로젝트 분석 | 프레임워크·언어·ORM·패키지 매니저 정도만 감지 | 구조화된 `ProjectProfile` 생성 |
| 역할 정의 | 에이전트별 지침 파일 매핑만 존재 | Planner, Builder, Reviewer, Verifier 역할 계약 추가 |
| 단일 에이전트 루프 | 문서상 원칙으로만 설명 | 계획 → 구현 → 테스트 → 디버깅을 기본 실행 모델로 정의 |
| 선택적 분업 | 역할 선택 정책 없음 | 작업 복잡도·위험도에 따른 역할 선택 |
| 결정론적 평가 | `npm test` 실행 및 성공 여부 기록 | 검증 명령·테스트 수·실패 증거를 구조화 |
| handoff 관리 | 에이전트 간 전달 artifact 구조 없음 | 필요한 경우에만 파일 기반 artifact 전달 |

현재 [`bin/analyzer.mjs`](../bin/analyzer.mjs)의 `detectProjectConstraints()`는 프레임워크, 언어, ORM, 패키지 매니저를 감지해 Markdown 문자열을 반환한다. 하지만 소스·테스트 구조, 실행 스크립트, ADR·지침 존재 여부, 위험 신호를 포함한 구조화된 프로젝트 프로필은 아직 제공하지 않는다.

현재 [`bin/agentic.mjs`](../bin/agentic.mjs)는 `init`, `sync`, `doctor`, `check`만 제공한다. 프로젝트 분석 결과를 읽기 전용으로 확인하거나 JSON으로 소비할 `agentic analyze` 명령은 없다.

현재 [`templates/AGENTS.md`](../templates/AGENTS.md)는 공통 TDD 라이프사이클을 정의하지만, Planner·Builder·Reviewer·Verifier의 책임·입력·출력·수행 조건을 독립적인 역할 계약으로 정의하지 않는다.

현재 [`templates/tools/check.mjs`](../templates/tools/check.mjs)는 검증 명령을 실행하고 `exitCode`, `success`, 실행 시간을 기록하지만, `testCount`와 실패 요약 등 검증 강도를 판단할 정보가 부족하다. 또한 구현상 기본 명령은 `npm test`로 고정되어 있다.

## 2. 목표 아키텍처

개편 후에는 다음 흐름을 지원해야 한다.

```text
agentic analyze
      │
      ▼
ProjectProfile
      │
      ▼
Role Policy
      ├─ 일반 작업          → Solo Agent
      ├─ 넓거나 불명확한 작업 → Planner 추가
      ├─ 고위험 변경          → Reviewer + Verifier
      └─ 구현 완료            → npm run check
```

역할은 기본적으로 별도 프로세스나 별도 모델을 의미하지 않는다. 한 에이전트가 Planner·Builder·Verifier 역할을 순서대로 수행할 수 있으며, 작업이 요구할 때만 추가 에이전트나 평가 단계를 활성화한다.

## 3. 프로젝트 분석 기능

기존 `detectProjectConstraints()`를 유지하되, 별도로 구조화된 `ProjectProfile`을 반환하는 분석 계층을 추가한다.

```js
{
  name: "agentic",
  language: "javascript",
  framework: "node",
  packageManager: "npm",
  sourceDirs: ["bin", "tools", "evals"],
  testDirs: ["evals"],
  scripts: {
    test: "node --test evals/**/*.test.mjs",
    check: "node ./bin/agentic.mjs check"
  },
  hasAdr: true,
  hasAgentsMd: true,
  riskSignals: [
    "cli",
    "filesystem-write",
    "template-generation"
  ]
}
```

추가할 명령은 다음과 같다.

```bash
agentic analyze .
agentic analyze . --json
```

* 기본 출력은 사람이 읽는 프로젝트 요약이다.
* `--json` 출력은 역할 정책과 후속 도구가 소비하는 구조화된 분석 결과다.
* 기본 동작은 읽기 전용이어야 한다.
* `.env`, 비밀값, 소스 본문, 세션 로그는 분석하지 않는다.

## 4. 역할 계약

`templates/AGENTS.md`에는 역할 선택의 핵심 규칙을 추가하고, 상세 역할 계약은 [`docs/workflow.md`](workflow.md)에 분리한다.

### Planner

* 요구사항을 작업 단위로 분해한다.
* 범위와 완료 조건을 정의한다.
* 기본적으로 코드를 수정하지 않는다.
* 결과물은 `plan.md`다.

### Builder

* 테스트 우선으로 구현한다.
* 최소 변경 원칙을 준수한다.
* 구현과 테스트를 함께 수정한다.
* 결과물은 코드 변경과 테스트다.

### Verifier

* `npm run check`를 실행한다.
* 종료 코드와 테스트 결과를 확인한다.
* 결과물은 `.agentic/last-check.json`이다.

### Reviewer

* 고위험 변경에만 선택적으로 실행한다.
* 기본적으로 코드를 수정하지 않는다.
* 문제와 근거를 `review.md`에 기록한다.

기본 작업에서는 다음처럼 한 에이전트가 모든 역할을 수행할 수 있다.

```text
Solo Agent:
  Planner 역할 → Builder 역할 → Verifier 역할
```

## 5. 역할 선택 정책

새로운 `role-policy.mjs`를 두고 작업 복잡도와 위험도에 따라 역할을 결정한다.

```text
작고 명확한 버그 수정
  → Solo Agent

여러 모듈에 걸친 기능
  → Solo Agent + 내부 Planner 단계

요구사항이 불명확하거나 범위가 큼
  → Planner 추가

인증·결제·데이터 마이그레이션·보안 변경
  → Reviewer + Verifier 추가

서로 독립적인 대규모 영역
  → 전문 Subagent 또는 병렬 작업 선택
```

역할 선택 결과를 확인하는 명령은 다음 정도가 적당하다.

```bash
agentic plan --task "sync 동작에 ADR 검증 추가"
```

예상 출력:

```text
Recommended mode: SOLO_WITH_REVIEW
Roles:
  - Planner: optional
  - Builder: primary agent
  - Reviewer: required
  - Verifier: required
Reason:
  - modifies synchronization behavior
  - affects project instructions
```

이 명령은 에이전트를 직접 생성하지 않는다. 어떤 역할이 필요한지 결정하고, 각 에이전트가 읽을 수 있는 역할 계약과 artifact 경로를 제공하는 역할만 한다.

## 6. Handoff와 artifact

에이전트 간 메시지 왕복을 만들기보다 파일 기반 artifact로 제한한다.

```text
.agentic/runs/<run-id>/
├── profile.json
├── plan.md
├── review.md
└── last-check.json
```

각 artifact는 다음 규칙을 가진다.

* 짧고 구조화된 형식을 사용한다.
* 원본 대화 전체를 전달하지 않는다.
* 요구사항, 결정, 실패 증거만 전달한다.
* 기본 작업에서는 Planner·Reviewer artifact를 만들지 않는다.

이렇게 하면 handoff로 인한 맥락 유실과 토큰 비용을 줄이면서도 복잡한 작업에는 확장할 수 있다.

## 7. 결정론적 검증 개편

현재 [`templates/tools/check.mjs`](../templates/tools/check.mjs)는 실제로 기본 `npm test`를 실행하고 `exitCode`와 `success`만 기록한다. 목표 증거 형식은 다음과 같다.

```json
{
  "command": "npm test",
  "exitCode": 0,
  "success": true,
  "testCount": 7,
  "durationMs": 642,
  "timestamp": "..."
}
```

필요한 변경:

* 프로젝트별 검증 명령을 명시적으로 결정한다.
* 실제 실행 명령을 기록한다.
* 테스트 0개를 실패로 처리한다.
* 가능하면 테스트 수와 실패 요약을 기록한다.
* 실패 시 원인과 재실행 정보를 artifact에 남긴다.
* `npm run check`가 성공해야만 완료 상태로 간주한다.

검증은 에이전트 수보다 증거가 중요하다. 에이전트의 자기 평가보다 실행 결과와 기계적으로 확인 가능한 평가 증거를 분리하는 방향을 따른다. ([Anthropic, *Demystifying evals for AI agents*](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents))

## 8. 권장 개편 순서

1. `detectProjectConstraints()`와 별도로 구조화된 `ProjectProfile` 분석 결과를 정의한다.
2. `agentic analyze [path] [--json]`를 추가한다. 기본 동작은 읽기 전용이어야 한다.
3. `templates/AGENTS.md`에 역할 선택의 핵심 규칙을 추가하고, `docs/workflow.md`에 Planner·Builder·Reviewer·Verifier 역할 계약을 기록한다.
4. 복잡도·위험도 신호를 입력으로 받는 `role-policy.mjs`를 추가한다.
5. `agentic plan --task`로 역할 선택 결과와 계획 artifact를 생성한다.
6. `check.mjs`의 검증 명령 선택과 증거 형식을 강화한다. 최소한 실제 명령, 종료 코드, 성공 여부, 테스트 수 또는 테스트 수를 확인할 수 없는 사유를 기록해야 한다.
7. 필요한 경우에만 `.agentic/runs/<run-id>/` 아래에 `profile.json`, `plan.md`, `review.md`, `last-check.json`을 생성한다.
8. 각 단계의 동작을 eval로 고정한 뒤, 채택된 구조적 결정은 새 ADR로 기록한다.

## 9. 외부 도구와의 관계

[`revfactory/harness`](https://github.com/revfactory/harness)는 Claude Code 환경에서 도메인별 에이전트 팀을 설계하고 전문 에이전트가 사용할 스킬을 생성하는 meta-skill이다. Agent Teams와 Subagents 같은 실행 모드와 여러 팀 구성 패턴을 제공한다.

Agentic은 이 도구와 다른 계층을 다룬다. 특정 Claude Code 팀을 생성하는 대신, Codex·Claude Code·Antigravity·Cursor·Copilot이 공유하는 규칙을 `AGENTS.md`에 모으고, 코드 변경 후 테스트가 실제로 통과했는지 검증하는 공통 계약을 제공한다.

| 구분 | `revfactory/harness` | `agentic` |
|---|---|---|
| **주요 역할** | Claude Code 내부의 도메인별 팀·스킬 구성 | 여러 에이전트가 공유하는 규칙·검증 계약 |
| **핵심 문제** | 어떤 전문 에이전트와 팀 패턴을 사용할지 | 규칙 파편화와 검증되지 않은 완료 보고 |
| **기본 접근** | 필요에 따라 Agent Teams/Subagents 구성 | 단일 에이전트 + `npm run check` 기본 루프 |

Anthropic의 장기 코딩 하네스 실험은 멀티 에이전트 구조가 더 풍부한 결과를 낼 수 있지만 Solo보다 20배 이상 높은 비용을 요구할 수 있음을 보여준다. 동시에 모델 성능 향상으로 일부 작업에서는 evaluator가 불필요한 오버헤드가 되었고, 작업 난이도에 따라 planner·evaluator를 선택하는 방향을 제시한다. ([Anthropic, *Harness design for long-running application development*](https://www.anthropic.com/engineering/harness-design-long-running-apps))

따라서 Agentic은 멀티 에이전트를 금지하지 않는다. 대부분의 작업에서는 단순한 단일 에이전트 루프를 사용하고, 복잡하거나 고위험인 작업에서만 추가 분업과 평가를 적용한다.

## 10. 핵심 설계 결정 후보

향후 구현을 시작하기 전에 다음 방향을 ADR로 채택할 수 있다.

> Agentic은 에이전트 팀을 항상 실행하는 오케스트레이터가 아니라, 프로젝트를 분석해 필요한 역할만 선택하고 기본적으로는 한 에이전트의 작업을 결정론적으로 검증하는 adaptive harness다.

이 방향이면 `revfactory/harness`의 프로젝트 분석·역할 정의 장점을 가져오면서도 Agentic의 차별점인 **벤더 중립성, SSOT, 낮은 오버헤드, `npm run check` 기반 검증**을 유지할 수 있다.
