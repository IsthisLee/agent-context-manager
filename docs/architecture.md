# Architecture Overview

`agentic`은 **크로스 에이전트(Codex, Claude Code, Antigravity, Cursor)를 위한 개발 하네스이자 결정론적 검증 툴킷**이다.

---

## 1. 3계층 아키텍처

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Core Specification & Generator Layer (agentic 저장소)    │
│    - specifications/ : 단일 진실 공급원(SSOT) 규칙           │
│    - templates/      : 에이전트별 지침 및 진단/검사 템플릿     │
│    - bin/agentic.mjs : 프로젝트 초기화/동기화 CLI           │
└──────────────────────────────┬──────────────────────────────┘
                               │  agentic init / sync
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Project Directive & Tool Layer (대상 프로젝트)           │
│    - AGENTS.md, CLAUDE.md, .gemini/rules/                   │
│    - tools/agentic/doctor.mjs, check.mjs                    │
│    - package.json ("npm test", "npm run check")             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Execution & Verification Layer (AI 에이전트 런타임)       │
│    - Codex, Claude Code, Antigravity CLI 및 IDE             │
│    - 변경본 수정 ──▶ tools/agentic/check.mjs 자가 검증       │
│    - .agentic/last-check.json 기계 증거 생성 및 확인        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 핵심 메커니즘

### 1) 단일 정본 동기화 (Single Source of Truth)
* 개발 원칙(TDD, 최소 변경, 비밀값 보호)을 `specifications/`에서 한 번만 수정하면, 동기화 스크립트가 모든 프로젝트의 지침 파일에 동일한 내용으로 반영한다.
* 에이전트 간 규칙 불일치(Drift)가 원천 차단된다.

### 2) 결정론적 검증 계약 (Deterministic Verification Contract)
* 에이전트는 기계가 검증한 사실(Fact)만 신뢰할 수 있다.
* `node tools/agentic/check.mjs`는 실제 프로젝트의 테스트 명령을 실행하고, 다음 형식의 JSON 증거를 생성한다:
  ```json
  {
    "timestamp": "2026-09-12T08:00:00.000Z",
    "command": "npm test",
    "exitCode": 0,
    "durationMs": 312,
    "success": true
  }
  ```
* exitCode가 0이 아니거나 테스트가 실패하면 에이전트는 작업을 완료할 수 없으며 자가 수정 루프를 돌아야 한다.

### 3) 자산 및 보안 격리 (Asset & IP Boundary)
* `agentic` Core 저장소는 누구나 쓸 수 있는 순수 범용 도구 및 템플릿만 보관한다.
* 프로젝트 코드, DB, 대화 로그, 브라우저 세션은 해당 프로젝트 경계 내부에 머물며 외부로 반출되지 않는다.
