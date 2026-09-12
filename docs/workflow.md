# Agentic 사용 워크플로: 사용자·에이전트·프로젝트·패키지의 경계

이 문서는 npm에 배포된 `@isthis/agentic`을 Node.js 대상 프로젝트에 적용할 때, **누가 무엇을 소유하고 어느 위치에서 명령이 실행되는지**를 현재 구현 기준으로 설명한다. 상호작용 흐름은 [워크플로 다이어그램](assets/agentic-user-workflow.html)에서 확인할 수 있다.

Agentic은 모델을 호출하거나 AI 에이전트를 실행·통제하지 않는다. 사용자가 선택한 Codex·Claude Code·Antigravity·Cursor·Copilot이 대상 프로젝트의 규칙을 읽고 개발하도록, 패키지가 지침·검증 도구를 생성하는 구조다.

## 1. 네 계층과 소유권

| 계층 | 소유자 | 현재 하는 일 | 다른 계층이 대신하지 않는 일 |
| --- | --- | --- | --- |
| 사용자 | 개발자·팀 | 패키지 버전 선택·설치, 초기화·동기화 시작, 정책·요구사항 제공, 프로젝트 규칙 승인, 변경과 결과 검토 | 에이전트의 개발·검증을 자동으로 실행하지 않음 |
| 설치된 `@isthis/agentic` 패키지 | npm 패키지 버전 | `agentic` CLI와 템플릿 제공, 대상 프로젝트 파일 생성·갱신 | 모델 세션·인증·대화·코드 작업을 소유하지 않음 |
| 대상 프로젝트 | 프로젝트 저장소·팀 | `AGENTS.md`, 도구별 포인터, `tools/agentic/`, 실제 제품 코드·테스트·`package.json` 보유 | 공통 템플릿을 직접 유지보수하지 않음 |
| 사용자가 선택한 AI 에이전트 | 사용자가 사용하는 도구·계정 | 프로젝트 규칙을 읽고 TDD 개발, 필요한 프로젝트 규칙 초안 제안, 대상 프로젝트의 검증 실행, 실패·경고 수정, 결과 보고 | Agentic의 하위 프로세스나 런타임이 아니며 생성 도구·포인터를 직접 관리하지 않음 |

```text
사용자 ── 설치·init/sync 시작 ──> 설치된 @isthis/agentic 패키지
  │                                      │ 기본 지침·포인터·도구 생성/갱신
  │ 정책·완료 기준·규칙 승인               ▼
  ├──────────────────────────────> 대상 프로젝트 <── 프로젝트 규칙 초안 ── AI 에이전트
  │                                      │                     │ 승인된 규칙·도구를 읽음
  └──── 작업 의뢰 ─────────────────────────┴──────────────────────────────> TDD 개발·npm run check
```

대상 프로젝트의 `AGENTS.md`가 에이전트가 읽는 최종 규칙 SSOT다. 현재 공통 기본 영역은 패키지 템플릿에서 오고, `## 4. 프로젝트 규칙 확장 (SSOT)` 아래의 프로젝트 고유 규칙은 `sync` 때 보존된다. 여러 프로젝트에 적용할 개인·조직 Core 관리·적용 구조는 아직 구현되지 않았으며, [Core 관리·적용 제안](discussion/architecture/topics/core-management-and-application.md)에서 검토 중이다.

### 프로젝트 지침·도구 갱신 경로

| 입력 주체 | 대상 프로젝트에서 바꾸는 것 | 경계 |
| --- | --- | --- |
| 사용자 → Agentic CLI | 기본 `AGENTS.md` 영역, 도구별 포인터, `tools/agentic/`, 필요한 `package.json`·`.gitignore` 항목 | 사용자가 `init` 또는 `sync`를 명시적으로 실행할 때만 패키지가 생성·갱신 |
| 사용자 → 프로젝트 규칙 | 제품 정책·금지 사항·완료 기준의 승인된 내용 | 프로젝트 고유 규칙은 `AGENTS.md` 확장 영역 또는 연결된 `docs/`에 둠 |
| AI 에이전트 → 프로젝트 규칙 | 사용자 요구를 바탕으로 한 도메인·아키텍처 규칙 초안 | 사용자 검토 후 프로젝트 규칙에만 반영; 포인터·`tools/agentic/`를 직접 수정하지 않음 |

따라서 다이어그램의 “프로젝트 지침·생성 도구” 노드는 하나의 보관 위치를 나타내지만, 화살표의 의미는 다르다. 패키지 CLI는 생성 도구와 기본 지침을 갱신하고, 사용자와 에이전트는 프로젝트 규칙 확장 영역을 제안·승인한다.

## 2. 실제 사용 흐름

| 흐름 | 사용자 | 설치된 패키지 | 대상 프로젝트 | AI 에이전트 |
| --- | --- | --- | --- | --- |
| 도입 | 검토한 버전을 dev dependency로 설치하고 `init` 실행 | 로컬 `agentic` CLI를 제공 | 지침·포인터·도구·필요 시 최소 테스트가 생성됨 | 아직 자동 실행되지 않음 |
| 작업 의뢰 | 정책·제약·완료 기준을 전달하고, 규칙 초안을 검토·승인 | 관여하지 않음 | 승인된 규칙을 `AGENTS.md` 확장 영역 또는 `docs/`에 보유 | 프로젝트 규칙 초안을 제안하고, 승인된 규칙을 읽어 TDD로 변경함 |
| 검증·수용 | diff·검증 결과·남은 한계를 검토 | 관여하지 않음 | 자신의 `npm run check`가 테스트·린트·타입 검사 등을 실행 | 검증 실행, 실패·경고 수정, 재검증·보고 |
| 유지보수 | 새 버전을 설치하고 `sync`·diff·`doctor` 실행 | 최신 템플릿·CLI 제공 | 생성 파일이 갱신되고 프로젝트 확장 규칙은 보존됨 | 필요할 때 변경 영향 검토를 도움 |

`init`과 `sync`는 현재 같은 생성·동기화 엔진을 실행한다. 차이는 사용 의도다. `init`은 도입 시 대상 프로젝트 환경을 만들고, `sync`는 사용자가 패키지 버전을 바꾼 뒤 생성 파일을 새 템플릿으로 갱신할 때 쓴다.

## 3. 한 번: 설치와 초기화

대상 프로젝트 루트에서 설치한다. dev dependency와 lockfile을 사용하면 팀·CI가 같은 Agentic CLI와 템플릿 버전을 사용한다.

```bash
npm install --save-dev @isthis/agentic@<검토한-버전>
npx agentic init .
```

`npx agentic init .`은 전역 Agentic 서비스에 연결하는 명령이 아니다. 현재 대상 프로젝트에 설치된 `@isthis/agentic`의 `agentic` 실행 파일을 호출한다. Node.js 20 이상과 npm이 필요하며, Git은 변경 diff 검토를 위해 권장한다.

### `init`이 대상 프로젝트에 만드는 것

| 대상 파일·설정 | 생성 주체 | 동기화 시 처리 |
| --- | --- | --- |
| `AGENTS.md` | 패키지의 `templates/AGENTS.md`를 프로젝트 정보로 렌더링 | 기본 영역 갱신, 프로젝트 규칙 확장 영역 보존 |
| `CLAUDE.md`, `.gemini/rules/agentic.md`, `.cursor/rules/agentic.mdc`, `.github/copilot-instructions.md` | 패키지 템플릿 | 재생성 |
| `tools/agentic/check.mjs`, `tools/agentic/doctor.mjs` | 패키지 템플릿 | 재생성 |
| `.gitignore`의 `.agentic/` 실행 artifact 항목 | CLI | 필요한 항목만 추가 |
| `package.json`의 `check`·`test` 설정 | CLI | 기존 `check`는 보존; 테스트가 전혀 없는 경우만 최소 스모크 테스트 추가 |

초기화 후 사용자가 생성 결과를 검토한다.

```bash
git diff -- AGENTS.md CLAUDE.md .gemini .cursor .github tools/agentic package.json package-lock.json .gitignore
npx agentic doctor .
```

`doctor`도 설치된 패키지의 CLI로 시작하지만, 실제로는 대상 프로젝트에 생성된 `tools/agentic/doctor.mjs`를 실행한다. 설치 여부·지침 파일·Git 상태·`AGENTS.md` 크기를 진단하는 보조 명령이며, 매 작업의 필수 단계는 아니다.

## 4. 매 작업: 사용자는 의뢰하고, 에이전트가 프로젝트에서 개발한다

사용자는 평소 쓰는 AI 에이전트에 요구사항·금지 사항·완료 기준을 전달한다. 프로젝트 고유 규칙이 새로 필요하면 에이전트가 `AGENTS.md`의 프로젝트 규칙 확장 영역에 초안을 제안하고, 사용자가 코드 변경과 마찬가지로 검토·승인한다. 이 경로는 생성 도구를 갱신하는 `init`·`sync`와 별개다.

```text
사용자: 정책·요구사항·완료 기준 제공 → 규칙 초안과 결과 검토
AI 에이전트: AGENTS.md와 관련 docs/ 읽기 → 실패하는 테스트 작성 → 최소 구현 → 검증 → 수정·재검증 → 결과 보고
대상 프로젝트: 코드·테스트·npm run check를 제공
Agentic 패키지: 이 작업 중 모델·세션을 실행하거나 통제하지 않음
```

일반적이고 명확한 작업은 한 에이전트의 계획 → 구현 → 테스트 → 디버깅 루프가 기본이다. 복잡도·위험도에 따른 추가 역할 선택은 아직 구현되지 않은 다음 단계이며, [적응형 하네스 논의](discussion/architecture/topics/adaptive-harness.md)에서 관리한다.

### 검증은 대상 프로젝트에서 실행한다

에이전트는 코드·문서를 변경한 뒤 대상 프로젝트의 기본 게이트를 실행한다.

```bash
npm run check
```

이 명령은 대상 프로젝트가 정의한 테스트·린트·타입 검사 등을 확인한다. Agentic이 `check` 스크립트를 새로 만든 프로젝트에서는 생성된 `tools/agentic/check.mjs`가 기본적으로 `npm test`를 실행하고, 실행 명령·종료 코드·소요 시간·성공 여부를 `.agentic/last-check.json`에 남긴다.

기존 프로젝트의 `check` 스크립트는 보존된다. 따라서 기존 스크립트가 `tools/agentic/check.mjs`를 호출하지 않으면 증거 파일 생성은 자동 보장되지 않는다. 이 경우에도 에이전트는 기존 `npm run check`를 우회하지 않고 실행 결과를 보고해야 한다. 증거 형식의 공백은 [검증 계약 논의](discussion/architecture/topics/verification.md)에서 다룬다.

`npx agentic check .`은 대상 프로젝트의 생성된 check 도구를 실행하는 보조 CLI다. 기존 프로젝트의 네이티브 `check`에 테스트 외 게이트가 있을 수 있으므로, 일반 개발 완료 판단에 `npm run check`를 대체하는 명령으로 권장하지 않는다.

실패하거나 예상하지 못한 경고·건너뜀이 있으면 에이전트는 완료로 보고하지 않는다. 원인·영향을 확인하고 가능한 범위에서 수정한 뒤 다시 검증한다. 해결할 수 없으면 원인·영향·다음 조치를 사용자에게 명시한다.

## 5. 필요할 때: 패키지 업데이트와 동기화

사용자가 변경을 검토할 수 있을 때만 버전을 바꾸고, 새로 설치된 패키지의 CLI로 `sync`를 실행한다.

```bash
npm install --save-dev @isthis/agentic@<새로-검토한-버전>
npx agentic sync .
git diff
npx agentic doctor .
```

이 흐름의 파일 소유권은 다음과 같다.

* 패키지 버전이 바뀌면 `node_modules/@isthis/agentic/`의 CLI·템플릿이 바뀐다.
* `sync`는 그 템플릿으로 대상 프로젝트의 포인터·`tools/agentic/`·`AGENTS.md` 기본 영역을 갱신한다.
* 대상 프로젝트의 `AGENTS.md` 프로젝트 규칙 확장 영역은 보존한다.
* 사용자는 `git diff`로 생성 파일 변경을 확인하고, 불필요하거나 위험한 변경을 수용하지 않는다.

패키지 설치본을 직접 수정하지 않는다. 재설치·업데이트가 덮어쓰며, 현재 구현은 개인·조직 공통 규칙을 보존하는 별도 계층을 제공하지 않는다.

## 6. 규칙이 커질 때: 프로젝트 안에서 점진적으로 공개한다

`AGENTS.md`는 에이전트가 항상 먼저 읽는 지도다. 긴 도메인 규칙은 대상 프로젝트의 `docs/`에 두고 `AGENTS.md`에서 링크한다. 이 구조는 프로젝트별 규칙에 적용된다.

```text
대상 프로젝트/
├── AGENTS.md                 # 공통 규약·프로젝트 규칙·상세 문서 링크
└── docs/
    ├── payments.md           # 결제·정산 작업에서만 읽는 규칙
    ├── database.md           # DB 모델링·마이그레이션 규칙
    └── deployment.md         # 배포·CI 규칙
```

`doctor`는 `AGENTS.md`가 150줄을 넘으면 상세 규칙을 `docs/`로 분리하라는 진단을 낸다. 이는 절대 제한이 아니라 지침을 읽기 쉬운 지도로 유지하기 위한 권고다. 근거와 세부 가이드는 [참고 문헌](references.md#anthropic-context-engineering) 및 [OpenAI AGENTS.md 지침](references.md#openai-agents-md)을 따른다.

패키지의 책임 경계와 현재·다음 단계의 구분은 [제품 방향](product-direction.md)에서 확인한다.
