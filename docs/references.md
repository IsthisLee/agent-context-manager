# References & Comparative Analysis (공식 출처, 참고 문헌 및 비교 분석)

최종 확인일: **2026-09-12**  
본 문서는 `agentic`의 아키텍처를 설계할 때 직접 확인하고 분석한 공식 엔지니어링 리포트, 학술/기술 문서, 그리고 2026년 현재 오픈소스 생태계와의 비교 분석 총괄이다.

---

## 1. 주요 공식 엔지니어링 리포트 및 연구

### 1) Anthropic Research & Engineering
* <a id="anthropic-harness-design"></a>**[Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) (2026-03-24)**
  * **핵심:** 가상 에이전트 팀 분업의 복잡성을 재검토. 수많은 서브에이전트 오케스트레이션보다 **결정론적 평가(Deterministic Evals)와 단일 TDD 루프의 단순화**가 성공률을 극대화함을 실증.
  * **적용:** 무거운 자체 상태 머신과 상시 멀티에이전트 팀 구성을 배제하고, 단일 에이전트 + 테스트 피드백 계약을 기본안으로 채택.
* <a id="anthropic-demystifying-evals"></a>**[Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (2026-01-09)**
  * **핵심:** 제품 테스트와 에이전트 하네스 평가(Eval)의 분리. 환각을 방지하기 위한 기계 판독 가능 증거 체인 수립.
  * **적용:** `tools/agentic/check.mjs` 및 `.agentic/last-check.json` 기계 증거 메커니즘 도입.
* **[Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) (2025-11-26)**
  * **핵심:** 장기 작업 시 컨텍스트 유실 방지를 위한 구조화된 인수인계 및 체크포인트 설계.
  * **적용:** 세션 간 중단-재개 시 읽어야 할 최소 컨텍스트 경로 규정.
* <a id="anthropic-context-engineering"></a>**[Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (2025-09-29)**
  * **핵심:** 전체 대화 이력 및 도메인 지식의 상시 주입 금지. 필요한 파일만 온디맨드로 점진적 로딩(Progressive Disclosure).
  * **적용:** 루트 지침(`AGENTS.md`) 150줄 이내 제한(지도 역할) 및 상세 도메인 지식의 `docs/` 서랍화. `doctor` 진단을 통해 150줄 초과 경고 자동화.
* <a id="stanford-lost-in-the-middle"></a>**[Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) (Liu et al., Stanford & UC Berkeley)**
  * **핵심:** 입력 컨텍스트가 길어질수록 프롬프트의 중간(Middle) 부분에 위치한 핵심 제약 조건에 대한 모델의 회상률(Recall) 및 주의력(Attention)이 급격히 저하됨.
  * **적용:** 지침을 단일 파일에 비대하게 누적하지 않고, 루트 파일에는 최상단 행동 강령과 목차만 콤팩트하게 유지하여 주의력 희석(Attention Dilution) 방지.
* **[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024-12-19)**
  * **핵심:** 복잡한 프레임워크보다 가장 단순한 프롬프트/도구 조합부터 시작하는 원칙.
* **[Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)**
  * **핵심:** 에이전트가 직접 실행하고 피드백을 받을 수 있는 로컬 테스트 환경 우선.

### 2) OpenAI Platform & Documentation
* <a id="openai-agents-md"></a>**[Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)**
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

### 조사 범위와 결론

아래 비교는 각 도구의 공식 저장소·문서에 명시된 공개 기능을 기준으로 한다. 따라서 “동일한 조합의 도구가 없다”는 시장 전체의 부재를 증명하는 말이 아니라, **조사한 인접 도구와 Agentic의 책임 경계가 다르다**는 뜻이다.

| 도구 | 주된 문제와 접근 | Agentic과 겹치는 부분 | Agentic과의 차이·함께 쓸 때의 역할 |
|---|---|---|---|
| [GitHub Spec Kit](https://github.com/github/spec-kit) | 여러 코딩 에이전트에서 명세 → 계획 → 작업으로 이어지는 Spec-Driven Development 워크플로와 명령 템플릿을 제공 | 다중 에이전트 지원, 단계적 개발 흐름, 명시적 산출물 | Spec Kit는 작업의 **명세·계획 프로세스**에 강점이 있다. Agentic은 프로젝트의 **공통 지침 SSOT·도구별 동기화·네이티브 검증 계약**에 집중하므로, 향후 `ProjectProfile`·`agentic plan`의 상위 입력으로 함께 사용할 수 있다. |
| [obra/superpowers](https://github.com/obra/superpowers) | 여러 코딩 도구에서 재사용 가능한 composable skill과 브레인스토밍·계획·TDD·리뷰 중심의 개발 방법론을 제공 | 크로스 에이전트, TDD, 계획·리뷰·서브에이전트 활용 | Superpowers는 에이전트가 따를 **방법론·스킬 묶음**이다. Agentic은 특정 스킬 흐름을 강제하지 않고, 프로젝트별 지침을 동기화하고 실제 검증 명령과 증거를 관리하는 **프로젝트 환경 계층**이다. |
| [revfactory/harness](https://github.com/revfactory/harness) | Claude Code에서 도메인 설명으로 전문 에이전트 팀과 스킬을 생성하는 Team-Architecture Factory | 역할 정의, 복잡한 작업의 선택적 분업 | Harness는 Claude Code의 Agent Teams·Subagents를 활용해 **팀 아키텍처를 생성**한다. Agentic은 팀을 직접 실행·오케스트레이션하지 않고, 여러 에이전트 도구가 공유할 규칙·검증 계약을 제공한다. |
| [Archon](https://github.com/coleam00/archon) | 코딩 에이전트용 재현 가능한 하네스·워크플로 구성과 다중 역할 검토 파이프라인을 제공 | 결정론성, 반복 가능한 개발 워크플로, 리뷰·검증 관심사 | Archon은 런타임 구성과 워크플로 자동화의 범위가 더 넓다. Agentic은 벤더 CLI 래퍼·세션·출력 파싱을 소유하지 않는 경계를 유지하며, 기존 공식 런타임 위에서 동작한다. |
| **Agentic** | 여러 AI 코딩 도구가 동일한 프로젝트 규칙과 검증 증거 아래에서 일하도록 환경을 구성 | 위 도구들의 명세·스킬·팀 설계와 조합 가능 | 대상 프로젝트의 `AGENTS.md`를 SSOT로 두고 지침·검증 도구를 동기화한다. 기본은 Solo + 프로젝트 네이티브 검증이며, 구조화된 분석·역할 선택은 설계·검증 중이다. |

### 직접 겹치는 도구: SSOT·검사·게이트·설치

| 문제 영역 | 조사한 도구 | 공식적으로 확인한 기능 | Agentic에 주는 비교 결론 |
|---|---|---|---|
| 여러 에이전트 규칙 SSOT·동기화 | [Ruler](https://github.com/intellectronica/ruler) | `.ruler/`의 Markdown 규칙을 중앙 원본으로 두고 다수 에이전트의 네이티브 설정으로 생성한다. 중첩 규칙·MCP·실험적 서브에이전트 배포와 CI 동기화 검사를 제공한다. | Agentic과 가장 직접적으로 겹친다. Ruler는 더 넓은 도구·중첩 규칙·MCP를 지원하고, Agentic은 대상 프로젝트의 `AGENTS.md`를 직접 SSOT로 삼으며 검증 도구까지 함께 배포한다. manifest·`sync --check`는 Agentic의 우선 개선 항목이다. |
| 여러 에이전트 규칙 SSOT·동기화 | [agents-sync](https://github.com/googlarz/agents-sync) | 루트 `AGENTS.md`에서 11개 도구용 파일을 생성하고, drift 검사·엄격 CI 검증·기계 판독 가능한 `Never` 규칙 lint를 제공한다. | Agentic의 `init`·`sync`와 기능 중복이 높다. agents-sync의 drift 검사와 규칙 lint는 Agentic의 `sync --check`·`doctor` 강화에 직접 참고할 수 있다. 단, Agentic은 AI 기반 규칙 생성이나 런타임 hook을 소유하지 않는 경계를 유지한다. |
| 여러 에이전트 규칙 SSOT·동기화 | [agentdef](https://github.com/noord-agency/agentdef) | 하나의 에이전트 정의에서 `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, Cursor 규칙을 생성하는 스킬로 소개된다. | 규칙 파일 생성은 겹치지만, agentdef는 **에이전트 정의 변환**에 가깝고 Agentic은 프로젝트 규칙·검증 계약·운영 문서를 함께 다룬다. 공개 기능 설명은 스킬 카탈로그에서 확인했으므로, 채택 전 원 저장소의 릴리스·호환성 상태를 다시 확인해야 한다. |
| AGENTS.md 품질·드리프트 검사 | [agents-lint](https://github.com/giacomo/agents-lint) | 경로·npm 스크립트·의존성 참조의 최신성, 여러 컨텍스트 파일 간 충돌, 필수 섹션을 검사하고 CI·JSON 출력을 제공한다. | Agentic의 현재 `doctor`보다 훨씬 깊은 컨텍스트 rot 검사다. Agentic은 우선 실행 명령·생성 파일·증거 manifest를 진단하고, 범용 지침 lint는 별도 통합 또는 선택 기능으로 검토하는 편이 적절하다. |
| AGENTS.md 품질·드리프트 검사 | [ctxlint](https://www.npmjs.com/package/@ctxlint/ctxlint) | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` 등 컨텍스트 파일과 MCP 설정을 lint한다. | Agentic의 문서 검사와는 대상이 다르다. 현재 `check:docs`는 **코어 문서 정합성**, ctxlint는 **대상 프로젝트의 에이전트 컨텍스트 품질**에 초점이 있다. |
| AGENTS.md 품질·드리프트 검사 | [Harness Doctor](https://github.com/abpai/harness-doctor) | 오프라인·결정론적 리포지터리 진단, 문서 계약·공급망·dead code 검사, CI·버전 있는 JSON 보고서를 제공한다. | 현재 Agentic `doctor`의 직접적인 상위 비교 대상이다. Agentic은 경량 지침·환경 진단에 머물고 있으므로, 구조화된 진단 결과·명령 발견·CI 모드의 설계 근거로 삼을 수 있다. |
| 검증 게이트가 있는 코딩 하네스 | [Spec-Driven Harness (`@luizsantiago/agentic-harness`)](https://www.npmjs.com/package/@luizsantiago/agentic-harness) | 명세·작업·검증 단계, Python 기반 게이트, 새 컨텍스트의 독립 검증, `.specs/` 상태·handoff를 제공한다. | Agentic의 `ProjectProfile`·`agentic plan`·artifact 논의와 겹친다. 이 도구는 더 강한 워크플로·게이트를 제공하지만, Agentic은 모든 작업에 무거운 단계별 절차를 강제하지 않고 Solo 기본 정책을 유지한다. |
| 작업별 맥락 설치·배포 | [Tech Atlas (`@luizsantiago/tech-atlas`)](https://www.npmjs.com/package/@luizsantiago/tech-atlas) | 작업에 최소한의 관련 기술 맥락을 라우팅하는 Spec-Driven Harness 계열의 보조 패키지로 공개되어 있다. | `ProjectProfile`과 점진적 컨텍스트 로딩의 인접 사례다. 다만 사용자가 말한 “ATLAS”가 이 패키지를 뜻하는지는 별도 확인이 필요하다. |
| 스킬·MCP·지침 설치 | [agent-install](https://www.npmjs.com/package/agent-install) | 한 패키지에서 SKILL.md, MCP 서버, `AGENTS.md` 섹션을 여러 에이전트용 위치에 설치·링크·갱신한다. | Agentic의 지침·도구 동기화와 부분 중복이다. agent-install은 **스킬·MCP 설치 관리자**, Agentic은 **프로젝트 개발 규칙·검증 환경 생성기**다. MCP·스킬 배포를 Agentic 범위에 넣을지는 별도 ADR이 필요한 확장이다. |

### 확인 보류 항목

| 항목 | 상태 | 처리 |
|---|---|---|
| `rulereceipt` | 제시된 npm URL은 조사 환경에서 직접 읽을 수 없었고, 기능·저장소를 확인할 수 있는 1차 출처를 찾지 못했다. | “지침 준수 증거화” 기능의 비교 대상으로 단정하지 않는다. 패키지 저장소 또는 README URL이 확인되면 추가 조사한다. |
| `ATLAS` | 이름만으로는 여러 프로젝트·벤치마크와 충돌한다. 위 표에는 관련 가능성이 있는 `@luizsantiago/tech-atlas`를 별도 표기했다. | 정확한 저장소를 지정받으면 해당 도구 기준으로 비교를 갱신한다. |

### 제품 포지션

Agentic은 에이전트를 호출하거나 여러 에이전트를 상시 조율하는 런타임이 아니다. 따라서 Spec Kit의 명세 프로세스, Superpowers의 스킬, Harness·Archon의 팀 또는 워크플로 구성을 **대체하려는 도구가 아니라**, 어떤 공식 코딩 에이전트를 사용하더라도 프로젝트 규칙·검증·문서화 경계를 일관되게 유지하는 기반 계층이다.

특히 다음 조합이 Agentic의 현재 포지션이다. 이것이 시장 전체에서 유일하다는 주장은 하지 않는다.

1. 대상 프로젝트의 `AGENTS.md`를 규칙 SSOT로 관리하고 여러 에이전트용 포인터를 동기화한다.
2. 벤더 런타임의 인증·세션·출력 형식을 소유하지 않는다.
3. 프로젝트가 원래 제공하는 테스트 명령과 검증 증거를 완료 판단의 기반으로 둔다.
4. 일반 작업은 Solo 루프를 기본으로 하고, 역할 분업은 위험도·복잡도·병렬성이 정당화할 때만 추가하는 방향을 취한다.

비교에서 도출한 구현 우선 과제와 채택 여부는 [생태계 비교 후속 과제](discussion/architecture/topics/ecosystem-follow-ups.md)에서 논의한다.

---

## 3. 기술 채택 및 유보 결정표 (Adoption & Deferral Matrix)

| 방법 및 기술 | 현재 상태 | 근거 및 사유 |
|---|---|---|
| **Core / Project 관심사 분리** | 구현됨 | 범용 규칙·템플릿과 프로젝트 고유 코드·데이터·테스트를 분리 |
| **단일 SSOT에서 지침 동기화** | 구현됨 | `AGENTS.md`와 도구별 포인터의 드리프트 최소화 |
| **프로젝트 네이티브 테스트와 `last-check.json` 증거** | 구현됨 | 현재는 명령·종료 코드·성공 여부·실행 시간을 기록 |
| **빈 Node 프로젝트의 스모크 테스트 부트스트랩** | 구현됨 | 테스트 스크립트와 테스트 흔적이 모두 없을 때만 최소 검증 루프 제공 |
| **구조화된 `ProjectProfile`과 `agentic analyze`** | 제안됨 | 프로젝트 제약·검증 명령·위험 신호를 추측 없이 구조화 |
| **복잡도·위험도 기반 역할 선택과 `agentic plan`** | 제안됨 | Solo를 기본으로 Planner·Reviewer·Verifier·가상 팀을 선택적으로 사용 |
| **테스트 수·프로젝트별 검증 계약 강화** | 제안됨 | 러너별 신뢰 가능한 근거가 있을 때만 테스트 수 정책을 적용 |
| **동기화 manifest, `sync --dry-run`, `sync --check`** | 제안됨 | 생성 파일의 투명성, CI 검사, 롤백 가능성 강화 |
| **자체 모델 추론 엔진 / 래퍼 CLI** | 채택하지 않음 | 벤더 CLI의 플래그·인증·세션·출력 변화는 Core의 안정적 API가 아님 |
| **상시 가상 에이전트 팀 분업** | 채택하지 않음 | 작업의 독립성·완료 기준·병렬 이득이 명확할 때만 역할을 추가 |

---

## 4. 최신성의 범위 (Scope of Timeliness)

* 2026-03-24의 최신 Harness 설계 연구(*Anthropic Engineering*)와 2026-07-28의 MCP 보안 모범 사례 문서를 기반으로 설계되었다.
* 2026년 현재 Claude Code 플러그인 마켓플레이스에서 검증된 `revfactory/harness`와 `Archon`의 장단점을 면밀히 분석하여, 특정 벤더에 종속되지 않는 에이전트 중립적 설계를 도출하였다.
