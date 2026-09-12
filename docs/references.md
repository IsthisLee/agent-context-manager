# References & Comparative Analysis (공식 출처, 참고 문헌 및 비교 분석)

최종 확인일: **2026-09-12**  
본 문서는 `agentic`의 아키텍처를 설계할 때 직접 확인하고 분석한 공식 엔지니어링 리포트, 학술/기술 문서, 그리고 2026년 현재 오픈소스 생태계와의 비교 분석 총괄이다.

---

## 1. 주요 공식 엔지니어링 리포트 및 연구

### 1) Anthropic Research & Engineering
* **[Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) (2026-03-24)**
  * **핵심:** 가상 에이전트 팀 분업의 복잡성을 재검토. 수많은 서브에이전트 오케스트레이션보다 **결정론적 평가(Deterministic Evals)와 단일 TDD 루프의 단순화**가 성공률을 극대화함을 실증.
  * **적용:** 무거운 자체 상태 머신과 상시 멀티에이전트 팀 구성을 배제하고, 단일 에이전트 + 테스트 피드백 계약을 기본안으로 채택.
* **[Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (2026-01-09)**
  * **핵심:** 제품 테스트와 에이전트 하네스 평가(Eval)의 분리. 환각을 방지하기 위한 기계 판독 가능 증거 체인 수립.
  * **적용:** `tools/agentic/check.mjs` 및 `.agentic/last-check.json` 기계 증거 메커니즘 도입.
* **[Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) (2025-11-26)**
  * **핵심:** 장기 작업 시 컨텍스트 유실 방지를 위한 구조화된 인수인계 및 체크포인트 설계.
  * **적용:** 세션 간 중단-재개 시 읽어야 할 최소 컨텍스트 경로 규정.
* **[Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (2025-09-29)**
  * **핵심:** 전체 대화 이력 및 도메인 지식의 상시 주입 금지. 필요한 파일만 온디맨드로 점진적 로딩(Progressive Disclosure).
  * **적용:** 루트 지침(`AGENTS.md`) 150줄 이내 제한(지도 역할) 및 상세 도메인 지식의 `docs/` 서랍화. `doctor` 진단을 통해 150줄 초과 경고 자동화.
* **[Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) (Liu et al., Stanford & UC Berkeley)**
  * **핵심:** 입력 컨텍스트가 길어질수록 프롬프트의 중간(Middle) 부분에 위치한 핵심 제약 조건에 대한 모델의 회상률(Recall) 및 주의력(Attention)이 급격히 저하됨.
  * **적용:** 지침을 단일 파일에 비대하게 누적하지 않고, 루트 파일에는 최상단 행동 강령과 목차만 콤팩트하게 유지하여 주의력 희석(Attention Dilution) 방지.
* **[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024-12-19)**
  * **핵심:** 복잡한 프레임워크보다 가장 단순한 프롬프트/도구 조합부터 시작하는 원칙.
* **[Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)**
  * **핵심:** 에이전트가 직접 실행하고 피드백을 받을 수 있는 로컬 테스트 환경 우선.

### 2) OpenAI Platform & Documentation
* **[Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)**
  * **핵심:** OpenAI Codex 및 ChatGPT/Copilot 생태계의 프로젝트 레벨 진입 지침 표준.
    - **비대화 방지 및 모듈화 권장:** *"AGENTS.md는 간결하고 핵심적인 행동 강령에 집중해야 하며, 전체 API 명세나 DB 스키마 같은 방대한 문서를 루트 파일 하나에 쏟아붓지 마라."*
    - **서브 문서 참조(Index/Pointer) 패턴:** 복잡한 도메인 지식은 저장소 내 `docs/` 디렉터리 등의 전문 문서로 분리하고, `AGENTS.md`에는 해당 문서들의 목차(색인)와 포인터를 제공하여 에이전트가 필요할 때만 동적으로 읽도록 권장.
  * **적용:** `AGENTS.md`를 단일 정본(SSOT)이자 '지도'로 유지하고, 150줄 초과 시 `docs/` 서랍으로 분리하는 아키텍처 및 `doctor.mjs` 진단 규칙의 공식 근거로 채택.
* **[Build skills — OpenAI](https://learn.chatgpt.com/docs/build-skills)**
  * **핵심:** 지침, 도구, 자원을 단위 모듈로 캡슐화하는 스킬 아키텍처.
* **[Agent approvals & security — OpenAI](https://learn.chatgpt.com/docs/agent-approvals-security)**
  * **핵심:** OS 레벨 샌드박스와 셸 문자열 거부 목록만으로는 보안 강제가 불가능함. 네트워크 및 권한 분리 원칙.

### 3) Protocol & Infrastructure Standards
* **[MCP Security Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices) (2026-07-28)**
  * **핵심:** Model Context Protocol의 토큰 audience 분리, confused deputy 공격 방지 및 최소 권한 scope.
* **[Secure use reference — GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use)**
  * **핵심:** 비신뢰 코드 실행 분리, 최소 권한 PAT 및 commit sha 고정.
* **[git-worktree](https://git-scm.com/docs/git-worktree)**
  * **핵심:** 동일 저장소 내 독립 작업 트리 격리.
* **[Playwright Best Practices](https://playwright.dev/docs/best-practices)**
  * **핵심:** 사용자 가시적 동작, 자동 대기, 테스트별 상태 격리.

---

## 2. 2026년 오픈소스 생태계 도구와의 비교 분석

| 비교 기준 | `revfactory/harness` | `coleam00/Archon` | `affaan-m/everything-claude-code` | **`agentic` (본 프로젝트)** |
|---|---|---|---|---|
| **지원 에이전트** | **Claude Code 전용** (`.claude/`) | Claude Code 전용 | Claude Code 전용 | **Codex, Claude, Antigravity, Cursor (중립)** |
| **핵심 설계 초점** | 6개 팀 패턴 기반 에이전트 팀/스킬 생성 | 런타임 결정론적 설정 생성 | 규칙 및 설정 템플릿 모음 | **단일 SSOT 규칙 동기화 + OS 네이티브 TDD 검증** |
| **에이전트 구조** | 5인 다중 에이전트 팀 (Analyst, Builder, QA) | 단일/멀티 런타임 제어 | 지침 템플릿 | **단일 TDD 루프 + 온디맨드 서브에이전트(Lean)** |
| **품질 보증 방식** | 에이전트 간 리뷰 (Reviewer agent) | 런타임 설정 검증 | 수동 확인 | **기계 판독 가능한 JSON 증거 (`exitCode`, passCount)** |
| **프로젝트 분리** | 프로젝트 내 종속 | 프로젝트 내 종속 | 프로젝트 내 복사 | **Core(규칙/템플릿)와 Project(코드/데이터) 분리** |
| **유지보수 비용** | 중간 (Claude 플러그인 규격 종속) | 높음 (전용 바이너리) | 낮음 (정적 마크다운) | **극소 (표준 마크다운 + Node 내장 스크립트)** |

---

## 3. 기술 채택 및 유보 결정표 (Adoption & Deferral Matrix)

| 방법 및 기술 | 결정 | 근거 및 사유 |
|---|---|---|
| **Core / Project 관심사 분리** | **즉시 채택** | 범용 하네스 템플릿의 재사용성과 프로젝트 고유 정보 보호를 위해 필수 |
| **단일 SSOT에서 지침 일괄 생성** | **즉시 채택** | `AGENTS.md`, `CLAUDE.md`, `.gemini/rules`의 동기화 실패(Drift) 원천 차단 |
| **단일 Agent + 결정론적 테스트 루프** | **즉시 채택** | 2026년 Anthropic 연구 및 실무에서 가장 높은 성공률과 낮은 비용 증명 |
| **기계 판독 가능 증거 체인 (`last-check.json`)** | **즉시 채택** | 에이전트의 구두 완료 선언(환각) 방지 및 자동화된 파이프라인 검증 기준 확립 |
| **서브에이전트 기반 규칙 승격 (Promote)** | **즉시 채택** | 프로젝트 작업 중 얻은 팁을 컨텍스트 오염 없이 Core 규칙으로 안전하게 반영 |
| **온디맨드 서브에이전트 조사** | **즉시 채택** | 메인 에이전트의 컨텍스트 낭비를 막고 복잡한 조사를 병렬 격리 실행 |
| **독립 에이전트 리뷰 (Reviewer)** | **선택적 채택** | 단순 작업에는 오버헤드이므로, 복잡한 PR이나 크리티컬 로직에만 선별 적용 |
| **Git Worktree 병렬화** | **단계적 채택** | 동일 파일 동시 수정 충돌을 확인한 뒤 독립 작업 공간 분리에 적용 |
| **중앙 벡터 DB / 임베딩 메모리** | **유보** | 소규모~중규모 코드베이스에서는 `rg`, 파일 인덱스 대비 비용/기밀 관리 복잡도 정당화 불가 |
| **자체 모델 추론 엔진 / 래퍼 CLI** | **영구 폐기** | 공식 에이전트 런타임(`claude`, `codex`, `agy`)의 기능과 업데이트 속도를 개인이 래핑하는 것은 바퀴의 재발명 |
| **상시 5인 가상 에이전트 팀 분업** | **영구 폐기** | 2026년 모델의 고도화된 추론 능력 하에서는 토큰 낭비 및 맥락 유실(Chinese Whispers) 유발 |

---

## 4. 최신성의 범위 (Scope of Timeliness)

* 2026-03-24의 최신 Harness 설계 연구(*Anthropic Engineering*)와 2026-07-28의 MCP 보안 모범 사례 문서를 기반으로 설계되었다.
* 2026년 현재 Claude Code 플러그인 마켓플레이스에서 검증된 `revfactory/harness`와 `Archon`의 장단점을 면밀히 분석하여, 특정 벤더에 종속되지 않는 에이전트 중립적 설계를 도출하였다.
