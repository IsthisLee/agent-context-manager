# User and Agent Workflow Guide

이 문서는 npm에 배포된 `@isthis/agentic`을 대상 Node.js 프로젝트에서 사용하는 기준 흐름이다. 핵심은 **사용자가 환경과 규칙을 준비하고, AI 에이전트가 개발·검증을 수행하며, 사용자가 결과를 검토하는 것**이다.

Agentic은 에이전트를 실행하거나 모델을 호출하지 않는다. 사용자가 선택한 Codex·Claude Code·Antigravity·Cursor·Copilot이 `AGENTS.md`와 프로젝트 검증 명령을 읽고 작업하도록 환경을 구성한다.

전체 흐름은 [사용자·에이전트 워크플로 다이어그램](assets/agentic-user-workflow.html)에서 볼 수 있다.

## 역할 구분

| 주체 | 하는 일 | 매 작업마다 직접 실행할 명령 |
| --- | --- | --- |
| 사용자 | 패키지 설치·초기화, 정책 의도·요구사항 제공, 규칙 초안·변경·검증 결과 승인 또는 검토, 업데이트 승인 | `npx agentic init .` 등 도입·유지 명령만 실행 |
| AI 에이전트 | 규칙 초안 제안, `AGENTS.md`를 읽은 TDD 구현, 프로젝트 검증, 실패·경고 수정, 결과 보고 | `npm run check` |
| Agentic CLI | 지침·도구 설치와 동기화, 선택적 환경 진단 | `npx agentic init .`, `npx agentic sync .`, `npx agentic doctor .` |

## 사용자 4대 흐름

| 흐름 | 사용자 행동 | 에이전트·도구의 행동 | 완료 기준 |
| --- | --- | --- | --- |
| 1. 도입 | 개발 의존성 설치 후 `npx agentic init .` 실행 | Agentic CLI가 규칙 포인터·검증 도구를 프로젝트에 설치 | 생성 파일과 변경 diff를 검토함 |
| 2. 규칙·작업 의뢰 | 정책 의도와 요구사항을 제공하고, 에이전트의 규칙 초안을 승인 | 에이전트가 `AGENTS.md` 확장 영역의 초안을 제안하고 규칙을 읽어 개발함 | 승인된 규칙과 완료 기준이 프로젝트에 반영됨 |
| 3. 검증 결과 검토 | diff·테스트 결과·경고를 검토하고 다음 결정을 내림 | 에이전트가 `npm run check`를 실행하고 실패·경고를 수정·재검증 | 사용자가 변경과 검증 결과를 수용함 |
| 4. 업데이트 | 검토할 패키지 버전을 선택하고 `npx agentic sync .` 실행 | Agentic CLI가 생성 파일·도구를 새 템플릿으로 갱신 | `git diff`와 `doctor`로 영향 확인 |

`doctor`는 설치·동기화 이상을 확인하는 보조 진단이며, 사용자가 매 작업마다 실행하는 주 흐름은 아니다.

## 1. 한 번만: 설치와 초기화

대상 프로젝트 루트에서 Agentic을 개발 의존성으로 설치한다. 버전은 lockfile에 고정되므로 팀과 CI가 같은 CLI·템플릿을 사용한다.

```bash
npm install --save-dev @isthis/agentic@<검토한-버전>
npx agentic init .
```

Node.js 20 이상과 npm이 필요하다. Git은 필수는 아니지만, 생성·동기화 변경을 `git diff`로 검토하기 위해 권장한다.

`init`은 다음을 설치하거나 갱신한다.

* `AGENTS.md`: 프로젝트 공통 규칙의 SSOT
* `CLAUDE.md`, `.gemini/rules/agentic.md`, `.cursor/rules/agentic.mdc`, `.github/copilot-instructions.md`: 도구별 포인터
* `tools/agentic/check.mjs`, `tools/agentic/doctor.mjs`: 독립 실행 가능한 검증·진단 도구
* `.gitignore`의 Agentic 실행 artifact 항목

기존 `check` 스크립트는 덮어쓰지 않는다. 없을 때만 생성된 검증 실행기를 `npm run check`로 등록한다. `test` 스크립트와 알려진 테스트 파일이 모두 없는 Node 프로젝트에만 최소 `node --test` 스크립트와 `tests/smoke.test.mjs`를 추가한다.

초기화 직후 사용자는 생성된 파일만 검토한다.

```bash
git diff -- AGENTS.md CLAUDE.md .gemini .cursor .github tools/agentic package.json package-lock.json .gitignore
npx agentic doctor .
```

## 2. 한 번 또는 필요할 때: 규칙은 에이전트가 초안, 사용자가 승인

사용자가 모든 규칙을 직접 작성할 필요는 없다. 사용자는 제품 정책·금지 사항·완료 기준을 설명하고, 에이전트가 프로젝트 고유의 도메인·아키텍처 규칙을 `AGENTS.md`의 `## 4. 프로젝트 규칙 확장 (SSOT)` 아래에 초안으로 제안할 수 있다. 사용자는 이 변경을 다른 코드 변경처럼 검토·승인한다.

Agentic이 관리하는 공통 TDD·보안·검증 규약은 상단 영역에 둔다. 도구별 포인터 파일이나 `tools/agentic/`에 프로젝트 규칙을 직접 추가하지 않는다. `sync`가 생성 파일을 갱신할 수 있기 때문이다.

## 3. 매 작업: 사용자는 의뢰하고, 에이전트는 개발·검증한다

사용자는 평소 쓰는 에이전트에게 작업을 의뢰한다. 별도의 Agentic 런타임 명령을 실행할 필요는 없다. 규칙 변경이 필요한 작업이라면 에이전트가 먼저 `AGENTS.md` 초안을 제안하고 사용자의 검토를 받는다.

```text
사용자: 요구사항·제약·완료 기준 제공, 규칙 초안·결과 검토
에이전트: 필요 시 AGENTS.md 초안 제안 → 승인된 규칙 읽기 → 실패하는 테스트 작성 → 최소 구현 → npm run check → 실패·경고 수정 → 결과 보고
사용자: diff·검증 결과·남은 한계 검토
```

일반적이고 명확한 작업은 한 에이전트의 계획 → 구현 → 테스트 → 디버깅 루프가 기본이다. Agentic은 이 루프의 규칙과 검증 환경을 제공할 뿐, 에이전트의 세션·인증·모델 호출을 통제하지 않는다.

### 에이전트가 실행하는 검증

에이전트는 코드·문서를 변경한 뒤 프로젝트의 기본 게이트를 실행한다.

```bash
npm run check
```

이 명령은 프로젝트가 정의한 테스트·린트·타입 검사 등을 확인한다. 새로 생성된 `check` 스크립트는 기본적으로 `npm test`를 실행하고, 실행 명령·종료 코드·소요 시간·성공 여부를 `.agentic/last-check.json`에 기록한다.

기존 프로젝트의 `check` 스크립트는 보존된다. 따라서 해당 스크립트가 `tools/agentic/check.mjs`를 호출하지 않으면 증거 파일 생성은 아직 자동 보장되지 않는다. 이 공백은 [검증 계약 논의](discussion/architecture/verification.md)에서 개선 중이다. 그 경우에도 에이전트는 기존 프로젝트의 `npm run check`를 우회하지 말고 실행 결과를 보고해야 한다.

검증이 실패하거나 예상하지 못한 경고·건너뜀을 발견하면 에이전트는 완료로 보고하지 않는다. 원인과 영향 범위를 확인하고, 범위 안에서 수정한 뒤 다시 검증한다. 해결할 수 없으면 원인·영향·다음 조치를 사용자에게 설명한다.

## 4. 필요할 때: 진단과 업데이트

### 환경 진단

사용자는 초기화·동기화 뒤, 또는 에이전트가 규칙을 읽지 않는 것처럼 보일 때만 `doctor`를 실행한다.

```bash
npx agentic doctor .
```

현재 `doctor`는 Git 상태, 에이전트 지침 파일 존재, `AGENTS.md` 크기, `node_modules` 존재를 진단한다. 지침 내용의 품질, `package.json` 검증 스크립트의 유효성, 도구 실행 가능 여부는 아직 자동 진단하지 않는다. 이 개선은 [운영·릴리즈 논의](discussion/architecture/operations-and-release.md)에서 관리한다.

### 업데이트와 동기화

사용자는 변경 내용을 검토할 수 있을 때만 패키지를 업데이트하고 동기화한다.

```bash
npm install --save-dev @isthis/agentic@<새로-검토한-버전>
npx agentic sync .
git diff
npx agentic doctor .
```

`sync`는 `AGENTS.md`의 `## 4. 프로젝트 규칙 확장 (SSOT)` 아래 사용자 규칙을 보존한다. 반면 도구별 포인터 파일과 `tools/agentic/`는 최신 템플릿으로 덮어쓸 수 있다. 그러므로 동기화 전후 diff를 검토하고, 프로젝트 고유 규칙은 반드시 보존 영역 또는 `docs/`에 둔다.

## 규칙이 커질 때: 점진적 지침 공개

`AGENTS.md`는 모든 규칙을 담는 긴 매뉴얼이 아니라, 에이전트가 항상 먼저 읽어야 하는 **지도**다. 상세 규칙은 `docs/`에 분리하고 필요한 작업에서만 링크를 따라 읽게 한다. 이는 관련 맥락만 작업에 제공하는 [컨텍스트 엔지니어링 원칙](references.md#anthropic-context-engineering)과, 간결한 `AGENTS.md` 및 전문 문서 포인터를 권장하는 [OpenAI 지침](references.md#openai-agents-md)을 따른다.

```text
내 프로젝트/
├── AGENTS.md                 # 항상 읽는 지도: 불변 규약·상세 문서 링크
└── docs/
    ├── payments.md           # 결제·정산 작업에서만 읽는 규칙
    ├── database.md           # DB 모델링·마이그레이션 규칙
    └── deployment.md         # 배포·CI 규칙
```

루트 `AGENTS.md`에는 TDD·비밀값 보호·검증 명령·최소 변경 같은 공통 규약과 문서 목차만 둔다. 결제 API 세부 규격, 방대한 DB 정책, 배포 절차처럼 특정 작업에서만 필요한 내용은 `docs/`에 두고 링크한다.

```markdown
## 4. 프로젝트 규칙 확장 (SSOT)

### 도메인별 상세 지침
* 결제·정산 작업: [docs/payments.md](docs/payments.md)를 먼저 읽는다.
* DB 모델링·마이그레이션: [docs/database.md](docs/database.md)를 따른다.
* 배포·CI 변경: [docs/deployment.md](docs/deployment.md)를 확인한다.
```

`doctor`는 `AGENTS.md`가 150줄을 넘으면 상세 규칙을 `docs/`로 분리하라는 경고를 낸다. 이는 모델 품질의 절대 기준이나 강제 제한이 아니라, 루트 지침을 읽기 쉬운 지도로 유지하기 위한 진단 기준이다.

패키지의 책임 경계와 현재/다음 단계의 구분은 [제품 방향](product-direction.md)에서 확인한다.
