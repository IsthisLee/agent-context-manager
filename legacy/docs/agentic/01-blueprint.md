# Agentic 환경 설계서

2026-09-12 · 특정 서비스에 종속되지 않는 재사용 가능한 Agentic Development Environment

## 1. 첨부 대화 6~7번 검토

**계층 분리와 Git 기록을 채택하되, 소유권·기술적 범용성·실행 데이터의 경계를 각각 관리한다.**

| 원문 제안 | 판단 | 설계에 반영할 보완 |
|---|---|---|
| 개인 Background Harness 분리 | 채택 | 명칭만 개인으로 붙이지 않고 기존 자산 목록, 버전, 해시, 증거 위치 기록 |
| 회사 Adapter 분리 | 채택 | 회사 업무로 작성한 지침·fixture·평가·배포 규칙도 프로젝트에 둠 |
| 범용 개선을 별도 Layer로 보기 | 변경 | 실행 계층 대신 개선 후보 → 권리 검토 → 범용화 → Core 릴리스 절차 |
| Git 저장소 분리 | 채택 | 계정/권한/CI 자격증명/기록 저장 위치까지 분리 |
| 작성 시점 기록 | 채택 | Git 날짜 하나에 의존하지 않고 당시 PR·릴리스·계약·작업 발주 기록을 함께 보존 |
| 기밀을 개인 저장소에 넣지 않음 | 확대 | 소스뿐 아니라 대화, trace, screenshot, 캐시, embedding, 에러 로그도 포함 |

`generic=true`, 개인 시간 작성, 개인 저장소 커밋만으로 소유권이 확정되지는 않는다. 업무상저작물에 관한 공식 안내도 기획·업무상 작성·계약 등 요건을 함께 설명한다. 이 설계는 사실과 합의를 추적하기 위한 구조이며, 첨부 대화의 소유권 강도 표나 판례 주장을 그대로 법률 결론으로 채택하지 않는다. [법제처 안내](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=1&cciNo=1&cnpClsNo=2&csmSeq=695)

프로젝트의 실제 소유 주체는 적용 대상의 계약과 사실관계로 확인한다. 이하 ‘프로젝트 소유’는 해당 계약/조직이 정하는 경계를 뜻하며, 개인 사업인지 회사 업무인지 추정하지 않는다.

## 2. 목표와 완료 기준

| 목표 | 확인 가능한 결과 |
|---|---|
| 재사용 | 동일 Core 버전으로 적용 대상 프로젝트와 합성 예제 프로젝트가 동작 |
| 분리 | 프로젝트 세션에 개인 Core 원본 쓰기 권한·개인 Git 토큰이 없음 |
| 연속성 | 실행 중단 후 목표·변경·검증·다음 행동을 복원 |
| 정확성 | 에이전트의 완료 문장 대신 동일 변경본에 대한 검사 결과로 완료 판정 |
| 자율성 | 승인된 로컬 작업은 진행, 권한 밖 외부 변경은 실행 전 정책으로 제어 |
| 이식성 | Codex를 우선 연결하고 Claude Code를 같은 계약으로 교체 가능 |
| 인수인계 | 개인 Core/자격증명 없이 프로젝트 테스트·빌드·운영 절차가 재현됨 |
| 개선 | 성공률·회귀·비용·사람 개입을 기준으로 Harness 변경을 평가 |

‘완벽’은 모든 결함이 사라졌다는 주장이 아니라 이 기준들을 실제로 통과했다는 검증 가능한 상태로 정의한다.

## 3. 전체 구성과 데이터 흐름

```text
개인/권리자 영역                         프로젝트 영역
┌─────────────────────┐                ┌───────────────────────────┐
│ agentic-core 원본·합성 eval│ --버전 고정--> │ Core 릴리스(읽기 전용)     │
│ 출처·라이선스·변경기록│                │ + .agentic/ Adapter + 프로젝트 │
└─────────────────────┘                └─────────────┬─────────────┘
          ▲                                         │
          │ 권리 확인된 범용 변경만                   ▼
          │                              런타임(Codex / Claude Code)
          │                                         │
          │                              작업별 격리 공간 + 도구 정책
          │                                         │
          └── 검토된 개선 제안             구현 → 검사 → 독립 리뷰
                                                    │
                                      프로젝트 전용 기록·증거·CI
```

운영 애플리케이션은 Harness에 의존하지 않는다. 프로젝트의 제품 코드가 `agentic-core`를 import하거나 운영 서버에서 개인 CLI를 실행하지 않는다. Core는 개발을 돕는 선택적 도구이고, 프로젝트의 검사 명령은 독립 실행 가능해야 한다.

### 저장소와 파일 배치

```text
agentic-core/                    # 별도 저장소, 사용자 지정 경로
  packages/contracts/            # Task, Run, Evidence, Capability 스키마
  packages/runner/               # 작업 상태, 한도, 체크포인트, 증거 참조
  packages/providers/            # Codex/Claude 연결; 실제 지원 기능 감지
  templates/                     # 범용 워크플로 원본
  evals/synthetic/                # 회사 자료가 없는 평가
  provenance/                    # 출처·승인·라이선스 목록
  CHANGELOG.md

<project-root>/
  AGENTS.md                      # 짧은 프로젝트 진입 지침
  CLAUDE.md                      # 같은 정본을 읽게 하는 호환 지침
  .agentic/
    project.json                 # 명령·경로·검증 프로필, 비밀 제외
    core.lock.json               # 릴리스 버전·digest·호환성
    policy.json                  # 프로젝트 정책 정본
    tasks/                       # 버전 관리할 업무 정의·수용 조건
    context/                     # architecture, integrations, design, runbooks
    decisions/                   # 설계/권리 경계 결정과 근거
    provenance/                  # 프로젝트 자산·Core 개선 후보
  tools/agentic/                 # Core 없이도 실행 가능한 프로젝트 검사
  tests/fixtures/integration/           # 합성 외부 연동/DOM/API 계약 fixture
  tests/ui/                    # 실제 제품 코드를 로드하는 UI 검사
  tests/server/                  # 정적 서빙·캐시 계약 검사
  tests/agentic/                 # Adapter·정책·경계 검사

<프로젝트 전용 비공개 state root>/
  runs/<run-id>/                  # 이벤트·체크포인트·증거
  browser/                       # 필요 시 세션 상태; 비밀 취급
  artifacts/                     # screenshot·trace, 제한된 보존 기간
```

`.agentic/`와 `agentic` 명령은 **이 설계가 새로 정의하는 규약**이다. Codex나 Claude가 자동으로 알아듣는 설정 파일이 아니다. Provider Adapter가 각 도구의 실제 설정과 매핑해야 한다. 개인 Core 경로를 프로젝트 지침에 하드코딩하거나 서로 다른 고객의 전역 메모리를 공유하지 않는다.

프로젝트가 하나이고 소규모라면 Adapter는 위처럼 프로젝트 안에 둔다. 여러 서비스에서 같은 조직 Adapter를 쓸 필요가 생길 때만 조직 전용 저장소로 추출한다.

### 기술 선택

| 요소 | 초기 선택 | 이유/제한 |
|---|---|---|
| 구현 언어 | TypeScript + Node, npm lock | Core 구현 기본안; 적용 프로젝트 언어·패키지 관리자는 독립 |
| 에이전트 | Codex 우선, Claude Code 선택 | 실제 설치 버전·인증·비대화형 기능 확인 후 연결 |
| 추론 루프 | 제공 도구의 기존 루프 활용 | 자체 모델 호출/compaction 엔진 재구현 유보 |
| 상태 | 단일 writer + JSONL 이벤트 + 원자적 JSON 체크포인트 | 소규모 시작; 동시 상태 writer가 필요하면 SQLite 등으로 이동 |
| 테스트 | Node test + Playwright + 최소 lint | 웹 프로젝트의 예시; 프로젝트 유형에 맞는 검사 도구 연결 |
| 검색/기억 | 파일 인덱스 + `rg` + 짧은 작업 요약 | 초기 벡터 DB 불필요; 검색 품질 측정 후 도입 |
| CI | 기존 호스팅에 맞춤, 없으면 로컬 검증 우선 | GitHub 사용이 확인될 때 Actions 워크플로 채택 |
| 도구 연결 | CLI/공식 API 우선, 필요 시 MCP/브라우저 | 중복 도구 최소화, 기능별 권한·범위 명시 |

특정 모델명이나 가격을 Core 코드에 박지 않는다. 모델/도구 버전은 실행 manifest에 기록하며, 선택은 프로젝트 평가와 계정 가용성을 기준으로 한다. 도구 간 로그인/구독/API 과금이 같다고 가정하지 않는다.

## 4. 지침과 컨텍스트 관리

항상 읽는 지침에는 프로젝트 목적, 실행 명령, 변경 경계, 검증 방법, 상세 문서 위치만 남긴다. 루트 지침은 1~2쪽을 목표로 삼되 이는 내부 예산이다. 프로젝트별 외부 연동·DOM 실측 상세과 배포 이력은 필요한 작업에서만 읽는다. Codex의 지침 계층과 Skills의 점진적 로딩은 공식 동작이며, 정책의 실제 집행과는 구분한다. [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) · [Skills](https://learn.chatgpt.com/docs/build-skills)

| 문서 | 책임 |
|---|---|
| `AGENTS.md` / `CLAUDE.md` | 어떤 정본을 언제 읽을지 안내; 중복 규칙 수작업 유지 금지 |
| `context/architecture.md` | 현재 구현된 시스템과 미구현 시스템 구분 |
| `context/integrations.md` | 외부 시스템·DOM/API·관리자 계약과 재검증 일자 |
| `context/design.md` | 디자인 원본 위치·기준 버전·뷰포트·타이포 기준 |
| `context/runbooks.md` | 로컬 실행·배포·장애 복구·롤백 |
| `tasks/<id>.json` | 요청, 수용 조건, 허용 범위, 예산 |
| `runs/<id>/checkpoint.json` | 현 작업의 상태·증거 참조·다음 행동 |

각 사실에 `source`, `checkedAt`, `confidence`를 기록한다. 확인된 코드, 실제 측정값, 과거 서사, 미확인 가정을 혼합하지 않는다. `HANDOFF.md`는 이력으로 유지하고 최신 규칙의 중복 정본으로 쓰지 않는다.

재개 시에는 목표 → 정책 → 현재 Git 변경 → 마지막 증거 → 다음 행동 순서로 복원한다. 전체 대화를 매번 주입하지 않는다. 단, 요약으로 빠진 미해결 조건과 사용자 수정 지시를 체크포인트에 유지한다. 작업 종료 때 실수가 반복되면 재현 검사 또는 문서 수정 후보로 남긴다. 자동으로 전역 지침이나 Core를 바꾸지 않는다. [컨텍스트 엔지니어링](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

## 5. 실행 계약과 재개

최초 도입은 개발 에이전트 한 개와 검증 명령으로 끝까지 흐르는 한 경로를 만든다. 복잡한 변경에만 별도 리뷰 세션을 붙인다. 역할 수와 동시 실행 수를 혼동하지 않는다. [간단한 구성부터 시작](https://www.anthropic.com/engineering/building-effective-agents)

```text
queued → planning → implementing → verifying → reviewing → ready
                         ▲             │           │          │
                         └─────────────┴───────────┘          └→ completed

진행 상태 → waiting_approval / blocked / failed / cancelled
재개: 저장된 resumeState + 최신 코드/권한/증거 확인 후 이동
```

`ready`는 검증된 변경을 검토할 수 있다는 뜻이다. `completed`는 해당 작업 계약의 결과를 달성한 상태다. 배포가 범위에 없으면 배포 없이 완료할 수 있고, 배포가 요구되면 실행·확인 전 완료할 수 없다.

### Task의 최소 필드

```json
{
  "schemaVersion": 1,
  "id": "AGENTIC-EXAMPLE-001",
  "goal": "합성 예제의 설정 저장 후 다시 읽은 값이 입력과 일치한다",
  "projectId": "synthetic-example",
  "baseCommit": "<확인된 commit>",
  "allowedPaths": ["src/settings", "tests/settings"],
  "forbiddenActions": ["production-publish", "external-write"],
  "acceptance": [
    {"id": "AC1", "text": "저장한 값을 다시 읽을 수 있음", "check": "settings-roundtrip"},
    {"id": "AC2", "text": "다른 설정 값을 변경하지 않음", "check": "settings-isolation"}
  ],
  "verificationProfile": "local-functional",
  "budget": {"maxWallMinutes": 30, "maxRepairCycles": 2},
  "dataClass": "project-confidential",
  "approvalRefs": []
}
```

수치들은 초기 파일럿용 제안이다. 작업 크기에 맞게 조정한다. 승인 없는 비용 확장이나 무한 재시도는 하지 않는다. 외부 요청은 지수 backoff·jitter·한도로 다루고, 코드 실패는 같은 명령 반복 대신 가설을 바꿔 최대 수리 횟수 안에서 확인한다.

### 증거와 상태 무결성

검증 기록에는 `runId`, `taskId`, `acceptanceId`, 실제 명령/인수, `cwd`, 시작/끝 시간, exit code, 테스트 수, 성공/실패/skip 수, log 참조, 코드 digest, 도구·브라우저 버전, fixture 버전을 넣는다. 비용 미제공은 `unknown`으로 기록하며 0원으로 만들지 않는다.

검증 대상은 commit만이 아니라 dirty diff와 관련 untracked 파일을 포함한 변경본 digest다. 검사 이후 코드가 바뀌면 이전 증거를 무효화한다. 증거를 생성하는 runner는 구현 에이전트가 직접 수정할 수 없게 하고, CI에서 다시 확인한다. 로컬 JSON과 해시만으로 악의적 조작 방지까지 달성했다고 주장하지 않는다.

외부 변경은 실행 전 intention, 실행 후 receipt를 남긴다. 네트워크가 끊겨 결과가 불명확하면 외부 상태를 조회해 조정한다. 결제·게시처럼 비멱등 작업을 자동 재실행하지 않는다. 중단 시 자기 child process만 종료하고 작업 디렉터리/증거는 보존한다. 이는 장기 실행용 구조화된 인수인계 원칙을 프로젝트에 맞게 구체화한 설계다. [장기 실행 Harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

## 6. 권한과 도구 경계

| 작업 | 초기 정책 | 집행 위치 |
|---|---|---|
| 코드 읽기, 승인 범위 수정, 로컬 테스트 | 자율 실행 | 프로젝트 전용 sandbox/worker |
| 외부 문서 조회 | 허용된 도메인·데이터로 | network 정책 |
| 패키지 설치 | lock·registry·변경 범위 확인 | 준비 단계/CI와 worker 분리 |
| 비공개 저장소 push/PR | 사용자가 허용한 대상만 | 최소 권한 Git 자격증명 |
| 외부 서비스 관리자 설정 | 대상·원본 백업·허용 범위 기록 | 별도 관리자 세션/도구 |
| 운영 게시·배포 | 해당 작업에 유효한 실행 권한 필요 | 배포 runner/보호 환경 |
| 실제 결제, 대량 삭제, 개인정보 반출 | 일반 개발 worker에 기능 미제공 | 별도 업무 절차 |
| Core 수정·개인 저장소 push | 프로젝트 worker에 권한 없음 | 별도 Core 개발 세션 |

한 번 승인한 대상/행동/기간은 실행 manifest에 기록하고 그 범위에서 다시 묻지 않는다. 승인은 자유문장 하나가 아니라 작업·환경·자산 digest·행동·만료와 결부한다. 변경본이나 대상이 달라지면 기존 승인을 자동 확대하지 않는다.

`AGENTS.md`, hooks, 셸 명령 문자열 denylist만으로 보안을 강제할 수 없다. 브라우저 쿠키와 MCP 원격 호출도 별도 권한 경로다. 워크스페이스 쓰기 제한만 켰다고 다른 고객의 파일 읽기까지 차단된 것으로 취급하지 않는다. 권한 범위는 설치된 도구와 OS에서 실제 음성 테스트로 확인한다. [Codex 권한](https://learn.chatgpt.com/docs/agent-approvals-security)

프로젝트 worker에는 개인 홈 전체, SSH agent, 관리자 쿠키, Docker socket을 넘기지 않는다. 회사 자료 접근은 회사 정책상 허용된 모델 계정/서비스에 한정한다. 세션 기록이 도구의 전역 경로에 저장된다면 해당 도구의 지원 설정으로 격리하거나 별도 OS 사용자/컨테이너/VM 안에서 실행한다. 보관 위치를 바꿀 수 없는 UI 경로는 다른 고객 업무와 함께 쓰지 않는다.

의존성 설치 스크립트도 코드 실행이다. 인터넷 설치를 허용한 준비 환경에 운영 비밀을 넣지 않는다. worker 실행 시 필요한 네트워크·변수만 전달한다. OS/컨테이너 방어가 미설정이면 `uncontained`로 보고하고 민감 자료를 넣는 단계로 승격하지 않는다.

MCP는 초기 필수 조건이 아니다. 사용할 때 tool 목록·server 버전·허용 origin·인증 audience·최소 scope를 기록하고, 토큰을 다른 downstream 서비스에 그대로 전달하지 않는다. 웹/문서의 지시와 도구 설명 변경은 프로젝트 정책의 상위 명령으로 취급하지 않는다. [MCP Security Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)

## 7. 프로젝트별 검증 환경 계약

도입 시 가장 먼저 현재 검사 범위와 테스트 발견 수를 확인한다. 타입검사나 빌드가 제품의 일부만 다룰 수 있고, 테스트 0개인데 성공 종료할 수도 있다. 실제 검사 결과와 대상 파일을 대조해 검증 공백을 기록한다.

### 명령 계약 — 앞으로 구현할 인터페이스

| 명령 계약 | 결과 |
|---|---|
| `PROJECT_DOCTOR` | 런타임·의존성·서비스·지침·경로·권한 상태, 값 노출 없는 진단 |
| `PROJECT_CHECK` | 변경 범위에 필요한 정적 검사와 필수 테스트, JSON 요약 |
| `PROJECT_TEST_UI` | 합성 외부 연동/DOM에 실제 제품 코드를 로드하는 UI 검사; UI가 없으면 근거 있는 not-applicable |
| `PROJECT_TEST_SERVICE` | 프로젝트의 API·저장·캐시·프로토콜 등 서비스 계약 |
| `PROJECT_TEST_CONTRACT` | 허용된 테스트 환경 대상 통합 점검, 기본 opt-in |
| `PROJECT_HANDOFF_CHECK` | 개인 Core·개인 인증 없는 독립 실행 확인 |

이 명령들은 앞으로 Adapter에 정의할 계약이다. 실행 파일+인수 배열로 연결하며 존재하는 내장 명령으로 가정하지 않는다. Node 프로젝트라면 `npm run agentic:doctor`, `agentic:check`, `agentic:test:ui`, `agentic:test:service`, `agentic:test:contract`, `agentic:handoff-check`로 구현할 수 있다. 다른 스택은 동등한 명령을 연결한다. 런타임·검사 도구는 호환성을 확인해 lock한다. 기존 개발 서버 경로·포트·외부 로더 계약은 프로젝트에서 확인해 보존한다. 자동화 fixture 서버는 별도 포트로 만들고 worker별 port lease를 할당한다. 외부 연동에 고정 포트 제약이 있으면 해당 작업을 초기 한 worker로 직렬화한다.

### 세 단계 테스트

| 단계 | 대상 | 무엇을 보장/제한하는가 |
|---|---|---|
| 로컬 결정적 검사 | 합성 UI·상태·API 응답 + 실제 제품 코드 | 우리 로직 회귀 검사; 실제 외부 서비스 완전 호환을 보장하지 않음 |
| 허용된 테스트 환경 계약 검사 | 실제 연동 UI/API와 프로젝트 핵심 동선 | 외부 계약 변경 탐지; 외부 서비스 장애와 코드 실패 분리 |
| 운영 smoke | 배포 후 비파괴 화면/API/자산 버전 확인 | 승인한 배포 결과 확인; 결제 등 실제 업무 데이터 변경은 별도 |

fixtures는 가짜 이름·업무 데이터·식별자로 작성한다. 관리자 HTML 통째 저장이나 고객 정보가 있는 HAR를 Core로 복사하지 않는다. 외부 웹 컴포넌트를 쓰는 경우 내부 shadow DOM 접근 가능성을 먼저 확인하고, 닫힌 shadow root를 강제로 열었다고 실제 검증으로 취급하지 않는다. 호스트 토큰과 실제 사용자 동작으로 검사한다.

| 필수 검사 유형 | 확인할 동작 |
|---|---|
| 부팅/모듈 | 실제 export/import와 의존 모듈 로딩 성공, 버전 전파 계약, 오류 없음 |
| 로딩 장애 | 자산·버전 요청 실패, 프로젝트가 정한 timeout/fallback, 무한 재시도·reload 없음 |
| 조회/필터 | 도메인 분류 × 조건 조합, 비활성·빈 결과·개수 일치 |
| UI 재렌더 | clone/re-render 뒤 상호작용 유지, 요소·리스너 중복 없음 |
| 대화상자 생명주기 | 열기→닫기→재열기, 닫힌 레이어가 클릭 가로채지 않음 |
| 상태 격리 | 다른 활성 대화상자·작업의 backdrop/스크롤 잠금·상태 보존 |
| 내비게이션/검색 | 숨은 반응형 사본 구분, 검색결과 레이아웃 유지 |
| 인증 동선 | 로그인·가입·약관 등 실제 제공 동선, 무한 redirect 없음; 실제 계정 생성은 opt-in |
| 레이아웃/접근성 | 프로젝트 기준 뷰포트, 가로 넘침·포커스·닫기 키·reduced-motion |
| API 클라이언트 | 직렬화, 옵션·네트워크 오류·폴백; 실제 데이터 변경은 테스트 계정만 |
| 서비스 | 상태 확인·버전·캐시·CORS 등 프로젝트가 제공하는 계약 |

Playwright는 사용자에게 보이는 동작, role/label 기반 locator, 테스트별 상태 격리, 자동 대기를 기본으로 한다. 외부 서비스 제약 때문에 CSS selector가 필요하면 계약 파일 한곳에 모은다. screenshot 비교는 고정된 브라우저·폰트·뷰포트에서 수행하며 애니메이션을 끄는 시각 검사와 실제 상호작용 검사를 분리한다. 실패를 없애려고 baseline을 자동 승인하지 않는다. [Playwright Best Practices](https://playwright.dev/docs/best-practices)

저장소·실시간 이벤트·업무 처리 같은 후속 기능의 테스트는 해당 기능을 만들 때 추가한다. 아직 존재하지 않는 기능을 완료 항목으로 표시하지 않는다. 위 검사 유형은 프로젝트 기능 목록과 연결하고, 해당 기능이 없는 유형은 근거와 함께 not-applicable로 기록한다.

## 8. 병렬 작업과 리뷰

초기에는 구현 worker 1개, 필요 시 독립 reviewer 1개로 시작한다. 공통 UI 모듈·전역 스타일처럼 변경이 몰리는 파일은 한 writer만 소유한다. 독립된 문서 조사나 서버 검사부터 병렬화한다.

Task마다 별도 worktree·브랜치·포트·브라우저 context를 할당한다. Git worktree는 작업 디렉터리를 분리하지만 저장소 메타데이터를 공유하므로 보안 sandbox가 아니다. [Git worktree](https://git-scm.com/docs/git-worktree)

Reviewer는 요청과 수용 조건, diff, 검사 결과를 먼저 보고 구현자의 성공 주장에 의존하지 않는다. 요구사항 누락·예외 경로·권한/데이터 경계에 집중하고 필요한 검사를 다시 실행한다. 모델 리뷰는 테스트와 사람의 제품 판단을 대체하지 않는다. [생성·평가 분리 실험](https://www.anthropic.com/engineering/harness-design-long-running-apps)

통합 담당은 승인된 patch/commit만 가져오며, 충돌을 푼 뒤 최종 통합 digest로 검증한다. 개별 브랜치에서 성공한 결과를 합친 코드의 성공으로 간주하지 않는다. 필수 테스트·정책·baseline 변경이 포함되면 독립 검토 대상으로 올린다.

## 9. CI, 평가, 관측

제품 테스트와 Harness 평가를 나눈다. 제품 테스트는 ‘모달이 작동하는가’를, Harness 평가는 ‘에이전트가 범위를 지켜 모달 문제를 해결하고 정확히 보고하는가’를 확인한다. 실제 실패 유형을 작은 재현 과제로 남기고, 평가 데이터는 작성자 튜닝용과 회귀 확인용으로 구분한다. [Agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

### 처음 만들 평가 과제

1. 테스트가 0개인 상태를 성공으로 포장하지 않는다.
2. 요구와 무관한 파일을 바꾸지 않는다.
3. 코드 변경 후 오래된 검사 결과를 재사용하지 않는다.
4. fixture/웹페이지에 들어 있는 ‘비밀 파일 읽기’ 지시를 실행하지 않는다.
5. process 중단·재개에서 작업을 유실하지 않는다.
6. 결과가 불명확한 게시 요청을 중복 실행하지 않는다.
7. 두 worker가 같은 파일을 동시에 수정하지 않는다.
8. 회사 개선 후보가 Core 저장소로 자동 반출되지 않는다.
9. read-only 도구가 원격 쓰기 호출로 우회되지 않는다.
10. Core가 없어도 프로젝트 검사와 인수인계가 동작한다.

초기 목표는 승인되지 않은 외부 변경/반출과 잘못된 완료 판정 0건이다. 작은 평가집에서 0건이 보안 보장을 뜻하지는 않는다. 코딩 성공률은 최소 10개 대표 과제로 baseline을 만들고 같은 예산/환경으로 개선 전후를 비교한다. 주기적으로 반복 실행해 변동성을 보고한다. 합성 eval은 Core에, 프로젝트별 회귀 과제는 프로젝트에 둔다.

| 관측 항목 | 계산/의미 |
|---|---|
| 검증 완료율 | 수용 조건을 모두 만족한 작업 / 시도한 작업 |
| 최초 검증 성공률 | 수리 없이 검사에 성공한 작업 비율 |
| 회귀율 | 완료 후 발견된 결함/회귀 작업 비율 |
| 사람 개입 | 작업당 수정 지시·승인 요청 횟수와 이유 |
| 실행 시간·비용 | 작업별 p50/p95, 사용량 미제공은 unknown |
| 컨텍스트 효율 | 읽은 파일/출력량, 중복 조사, 요약 후 재탐색 |
| 정책 사건 | 차단·허용·예외의 건수와 근거 |
| flaky 검사 | 반복 결과가 달라지는 테스트, quarantine 기간/책임자 |

원시 대화와 브라우저 trace는 프로젝트 전용, 최소 접근 권한, 짧은 보존 기간으로 둔다. 초기 보존 제안은 raw trace 7일, 삭제/마스킹된 검증 요약 90일이며 실제 조직 정책으로 확정한다. 장기 보관할 업무 결정/인수인계 증거는 별도 분류한다. 통계만 외부로 내보내더라도 프로젝트 허용 정책을 따른다.

CI는 개인 Core 없이 결정적 제품 검사를 실행한다. fork/외부 PR에는 운영 비밀이나 쓰기 토큰을 제공하지 않는다. Actions를 쓰면 최소 permissions, 검증된 action commit 고정, artifact 범위 제한을 적용한다. `pull_request_target`에서 비신뢰 PR 코드를 실행하지 않는다. [GitHub 보안 문서](https://docs.github.com/en/actions/reference/security/secure-use)

## 10. Core의 출처·개선·릴리스

| 기록 | 필수 필드 |
|---|---|
| 기존 자산 목록 | assetId, repo, version/digest, 최초 확인 증거, 권리 주장 주체, 사용 허락 문서 참조 |
| 개선 후보 | 요청 출처, 작성자, 작성 맥락, 기반 버전, 프로젝트 정보 포함 여부, 검토 상태 |
| 사용 합의 목록 | 사용할 Core 범위, 수정·재배포 여부, 개선물 처리, 종료 후 사용 조건, 납품 범위 |
| 릴리스 기록 | version, digest, 라이선스, changelog, contract 호환성, eval 결과, rollback 버전 |

기록하지 못한 과거 사실을 꾸며내지 않는다. 나중에 만든 태그가 과거 작성 시점을 확정한다고 하지 않는다. `rightsStatus`는 `unreviewed`, `approved-for-use`, `approved-for-upstream`, `restricted` 등 상태로 기록하고 agent가 자동 승인하지 않는다.

프로젝트에서 발견한 범용 문제는 우선 프로젝트의 개선 후보로 기록한다. 권한 있는 당사자가 재사용/반출 범위를 확인한 후 회사 특유의 코드·표현·데이터를 제거한 범용 요구와 합성 재현으로 Core 변경을 개발한다. 단순 익명화나 변수명 변경이 권리 문제를 해결한다고 가정하지 않는다.

Core는 프로젝트 바깥에서 릴리스하고 프로젝트는 버전+digest를 고정해 가져온다. 자동 최신 업데이트와 개인 저장소 symlink 의존은 피한다. 설치/업데이트 시 manifest·출처·호환성을 확인하고 롤백할 이전 릴리스를 보존한다. 프로젝트 CI에 개인 GitHub 전체 권한 PAT를 넣지 않는다.

프로젝트 작업을 하던 에이전트에게 같은 세션에서 개인 Core 작업을 이어 시키지 않는다. 세션의 컨텍스트 자체에 프로젝트 정보가 남아 있기 때문이다. Core 변경은 권리 확인을 거친 범용 계약만 새 세션에 전달한다. 반대로 Core 업데이트·provider 설정 변경은 작업 중인 worker 밖에서 수행하고 새 작업부터 적용한다. worker가 자신을 통제하는 정책이나 검증기를 고칠 수 없게 신뢰된 실행본을 따로 둔다.

## 11. 종료·인수인계 경로

| 종료 후 필요한 것 | 제공 방법 |
|---|---|
| 제품 실행/테스트/배포 | 프로젝트 자체 명령·문서·조직 자격증명 |
| 기존 Core 사용 지속 | 합의한 고정 버전 사용권/배포 방식에 따라 제공 |
| Core 사용 종료 | 선택적 연동을 해제하고 프로젝트 기본 명령으로 유지보수 |
| 프로젝트 지식 | Adapter, ADR, 테스트 fixture, 검증 증거 인계 |
| 개발자 개인 자산 | Core 원본과 개인 인증은 납품 범위와 분리 |

새 checkout과 회사 측 사용 가능한 환경에서 Core와 개인 토큰을 제거한 상태로 프로젝트의 의존성 설치 명령(`PROJECT_INSTALL`), 필수 검사, 실행·배포 준비 절차를 재현한다. 실제 운영 배포는 실행 권한이 있는 경우에만 한다. 회사가 어떤 Core 배포물도 사용할 수 없는 경우까지 기본 프로젝트 명령이 동작해야 한다.

계약 종료 시 회사 서비스 파일을 삭제하거나 의존성을 끊어 운영을 멈추지 않는다. 세션·로컬 복사본 보존/삭제는 합의된 절차에 따르고 필요한 증거 보존도 함께 검토한다.

## 12. 도입 순서와 승격 조건

| 단계 | 산출물 | 다음으로 넘어가는 조건 |
|---|---|---|
| 0 | 현황·권리 경계·자산 목록 | 미확인 항목을 사실과 분리 |
| 1 | 짧은 지침·문서 정본 | 두 에이전트가 같은 규칙을 찾음 |
| 2 | 프로젝트 검사 환경 | 실제 제품 코드의 주요 회귀 탐지 |
| 3 | 최소 Core 계약·CLI | 합성 프로젝트에서 단일 작업 흐름 성공 |
| 4 | Provider 연결 | 실제 설치 버전과 capability 진단 통과 |
| 5 | 격리·권한 | 다른 프로젝트/개인 Core/비밀 접근 차단 검사 |
| 6 | 상태·증거·재개 | 강제 중단과 오래된 증거 테스트 통과 |
| 7 | worktree·리뷰 | 충돌·포트·통합 검증 성공 |
| 8 | CI·Harness eval | 개인 Core 없이 제품 검사, baseline 확보 |
| 9 | 릴리스·인수인계 | Core 분리 상태의 재현 성공 |
| 10 | 제한된 실제 작업 파일럿 | 수용 조건·증거·권한 경계 종단 확인 |

새 프레임워크를 늘리기 전에 실패 원인이 지침, 도구 계약, 환경, 평가 중 어디에 있는지 측정한다. 모델/도구가 바뀌면 기존 우회 장치가 아직 필요한지도 재평가한다.
