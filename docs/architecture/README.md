# Architecture Overview

`agentic`은 5대 크로스 에이전트(Codex, Claude Code, Antigravity, Cursor, GitHub Copilot)를 위한 린 개발 하네스이자 결정론적 검증 툴킷이다. 이 디렉터리는 현재 채택되어 동작하는 아키텍처만 기록한다.

## 핵심 구성 요소

```text
1. AGENTS.md Template & Pointer Adapters
   - templates/AGENTS.md: 대상 프로젝트 SSOT 생성 템플릿
   - CLAUDE.md, .gemini/, .cursor/, .github/: AGENTS.md 포인터
              │
2. CLI Sync Engine
   - bin/agentic.mjs: init, sync, doctor, check
   - bin/analyzer.mjs: 기술 제약 감지
              │
3. Deterministic Verification Kit
   - templates/tools/doctor.mjs
   - templates/tools/check.mjs
   - .agentic/last-check.json
```

## 배포 경계

```text
[agentic Core]
  templates/, bin/, docs/, evals/
              │ agentic init / sync
              ▼
[대상 프로젝트]
  AGENTS.md, 에이전트 포인터 파일, tools/agentic/
  제품 코드, 테스트, 데이터, package.json
```

대상 프로젝트에는 무거운 Agentic 런타임 의존성을 설치하지 않는다. 프로젝트는 주입된 지침과 독립 실행 가능한 검증 도구만 받으며, Agentic 없이도 본래의 빌드와 테스트를 실행할 수 있어야 한다.

## 현재 설계 원칙

* 대상 프로젝트의 `AGENTS.md`가 유일한 규칙 SSOT이며, 다른 에이전트 파일은 이를 참조한다.
* `sync`는 공통 템플릿을 갱신하되 `AGENTS.md`의 프로젝트 규칙 확장 영역을 보존한다.
* 생성된 `tools/agentic/check.mjs`를 실행한 경우, 완료 판단에 필요한 명령·종료 코드·소요 시간·성공 여부를 `.agentic/last-check.json`에 기록한다. 기존 `npm run check` 스크립트의 증거 연결은 아직 보장하지 않으며, [검증 논의](../discussion/architecture/topics/verification.md)에서 개선한다. [근거: [Anthropic Evals 연구](../references.md#anthropic-demystifying-evals)]
* `init`은 테스트 스크립트와 알려진 테스트 파일이 모두 없는 Node 프로젝트에만 내장 테스트 러너와 스모크 테스트를 부트스트랩한다. 기존 테스트가 감지되면 테스트 구성을 변경하지 않는다.
* [런타임 경계](runtime-boundary.md)에 따라 모델 호출·인증·세션·출력 처리는 공식 에이전트 도구가 소유한다.
* `AGENTS.md`는 간결한 지도 역할을 하고, 상세 문서는 `docs/`에 분리한다. [근거: [OpenAI AGENTS.md 가이드](../references.md#openai-agents-md)]

향후 도입을 검토 중인 adaptive harness 설계는 [`../discussion/architecture/`](../discussion/architecture/)에서 관리한다.
