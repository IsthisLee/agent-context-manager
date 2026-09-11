# Agentic 환경 구축용 단계별 프롬프트

2026-09-12 · 아래는 구현 에이전트에 전달할 작업 지시문이다. 아직 구현된 명령의 사용 설명서가 아니다.

## 사용 방법

0~10단계를 순서대로 실행한다. 적용할 실제 프로젝트가 정해지지 않았다면 별도 합성 예제 프로젝트를 PROJECT_ROOT로 지정해 Core 구축을 진행한다. 특정 업무 저장소를 자동 선택하지 않는다. 각 세션에 **공통 프롬프트 + 실행할 단계 프롬프트**를 함께 전달한다. 단계가 끝날 때 작성한 `implementation-state.md`를 다음 세션의 입력으로 사용한다. 필요한 경로/권한만 설정한 새 세션으로 프로젝트 작업과 Core 작업을 분리한다.

| 변수 | 지정 방법 |
|---|---|
| `ENV_DOCS_ROOT` | 범용 설계 문서 절대 경로. 이 환경에서는 `/Users/isthis/Documents/task/agentic/docs/agentic` |
| `PROJECT_ROOT` | 적용 대상 또는 합성 예제 프로젝트의 실제 절대 경로. 환경/Core root와 구분 |
| `PROJECT_DOCS_ROOT` | 프로젝트 기록·적용 문서 경로. 기본 `<PROJECT_ROOT>/docs/agentic`; Adapter에서 지정 |
| `CORE_ROOT` | 개인/권리자용 별도 환경 root. 이 환경에서는 `/Users/isthis/Documents/task/agentic` |
| `PROJECT_STATE_ROOT` | 조직 정책에 맞는 프로젝트 전용 비공개 절대 경로 |
| `PROJECT_INSTALL`, `PROJECT_CHECK`, `PROJECT_START` | 확인한 의존성 설치·검사·실행 명령; 실행 파일+argv로 지정 |
| `PROJECT_TEST_UI`, `PROJECT_TEST_SERVICE` | 실제 제공 기능에 맞는 검사 명령; 비해당은 근거를 기록 |
| `PRIMARY_PROVIDER` | 기본 `codex`; 설치/인증 확인 후 사용 |
| `SECONDARY_PROVIDER` | 선택 `claude`; 미설치이면 optional/unavailable |
| `PROJECT_OWNER` | 실제 권리자/계약 주체 확인값. 추정해서 채우지 않음 |

비밀 키나 세션 쿠키를 프롬프트에 붙이지 않는다. 미확정 소유권 때문에 프로젝트 테스트 같은 독립적인 개발까지 멈추지 말고, 반출·Core upstream처럼 그 판단에 의존하는 행동만 보류한다.

## 매 단계 공통 프롬프트

```text
너는 이 Agentic 환경을 단계적으로 구현하는 개발 에이전트다.

입력:
- ENV_DOCS_ROOT: <범용 설계 문서의 실제 절대 경로>
- PROJECT_ROOT: <적용 대상 또는 합성 예제 프로젝트의 절대 경로>
- PROJECT_DOCS_ROOT: <프로젝트 기록·적용 문서의 실제 절대 경로>
- PROJECT_INSTALL / PROJECT_CHECK / PROJECT_START: <확인된 명령>
- CORE_ROOT: <지정값; 아직 없으면 미지정>
- PROJECT_STATE_ROOT: <지정값; 아직 없으면 미지정>
- PRIMARY_PROVIDER: codex
- SECONDARY_PROVIDER: claude (선택)
- 설계: ENV_DOCS_ROOT/01-blueprint.md (PROJECT 세션에는 이 문서만 읽기 전용 제공)
- 단계 기록: PROJECT_DOCS_ROOT/implementation-state.md (존재할 때)
- 이번 범위: 아래에 붙인 단일 단계

시작할 때:
1. cwd, 실제 Git root, 현재 HEAD, 변경 파일, 관련 로컬 지침을 확인한다.
2. PROJECT 세션은 설계와 직전 단계 산출물을 읽고 실제 파일/명령이 존재하는지 검증한다.
   CORE 세션은 별도로 전달된 범용 계약·직전 Core 산출물만 읽는다.
   위 PROJECT_ROOT 경로와 프로젝트 설계/상태 파일에 접근하지 않는다.
3. 사용자 기존 변경을 보존한다. dirty 작업 트리는 변경 내용을 파악해 겹치지 않게
   처리하고, 자동 stash/reset/checkout/clean을 하지 않는다.
4. 최신 도구 옵션은 설치된 CLI --help와 공식 문서로 확인한다.
   설계의 .agentic/ 및 agentic 명령은 새로 만들 규약이지 기존 내장 기능이 아니다.

구현 원칙:
- PROJECT 작업 세션은 Core 원본을 수정하거나 프로젝트 자료를 개인 저장소로 보내지 않는다.
- CORE 작업은 별도 깨끗한 세션에서 합성 프로젝트/범용 계약만 입력받는다.
  같은 대화에서 경로만 바꾸는 것을 데이터 격리라고 하지 않는다.
- 설치/개발/검사는 단계 범위 안에서 진행한다. 존재하지 않는 권한·경로·증거를 꾸미지 않는다.
- 제품 코드의 무관한 리팩터링, 원격 저장소 생성, 공개 게시, 운영 배포는 이번 단계가
  명시적으로 포함하고 유효한 사용자 권한이 있는 경우에만 한다.
- AGENTS/CLAUDE 지침과 OS/API 권한 집행을 구분한다. hooks만으로 sandbox라고 하지 않는다.
- 비밀값, 관리자 HTML, 브라우저 저장 상태를 로그/커밋/개인 저장소에 기록하지 않는다.
- 테스트/수용 조건/정책을 약하게 바꿔 통과시키지 않는다. 설계 수정이 필요한 경우
  원인·대안·영향을 결정 기록에 남기고 요청 범위에서 해결한다.
- 프로젝트 검사 명령은 개인 Core 설치/인증 없이 동작해야 한다.
- 프로젝트 제약을 범용 Core에 하드코딩하지 않는다.
- 런타임 의존성을 최소화하고 lockfile을 갱신한다.

검증:
- 해당 단계의 완료 조건을 실제로 검사한다. 실행 불가능은 blocked/not-run으로 기록한다.
- 검사 대상 변경본, 테스트 수, exit code, 결과 위치를 기록한다.
- 성공한 mock 검사와 실제 provider/실사이트 검사를 구분한다.
- 실패하면 근거를 읽고 수정한다. 동일 원인 반복이나 예산 소진 시 현재 상태·재개 방법을 남긴다.

종료 산출물:
1. 무엇을 구현했고 실제로 동작하는지
2. 변경 파일과 실행 명령
3. 수용 조건별 pass/fail/blocked 및 증거
4. 잔여 제약과 다음 단계 입력
5. 이번 단계만 implementation-state.md에 반영

Core 세션은 회사 state 파일에 직접 쓰지 않는다. 범용 release manifest/검증 요약만
반환하고 PROJECT 세션이 받아 단계 기록을 갱신한다.
커밋/원격 반영은 사용자가 정한 권한과 기존 세션 지시를 따른다.
```

## 0단계 · 현황과 자산 경계 확정

```text
PROJECT 세션에서 작업한다. 현재 저장소를 증거로 Agentic 도입 baseline을 작성하라.

할 일:
1. README, 에이전트 지침, 인수인계 문서, 제품 코드, 도구, 의존성 manifest,
   타입검사/빌드/배포 설정을 비교한다. 현재 사실/과거 기록/계획/미확인을 구분한다.
2. 런타임 버전, 설치된 의존성, Git remote 존재 여부, CI 파일, 테스트 발견 수를 확인한다.
   remote에 인증정보가 있으면 마스킹한다. 비밀 파일 내용은 읽어 출력하지 않는다.
3. 프로젝트 명령 정의를 먼저 읽어 부작용 없는 기존 검사를 실행한다.
   검사에서 제외되는 제품 경로와 테스트 발견 수, 테스트 0개의 의미를 baseline에 적는다.
4. .agentic/provenance/assets.json과 PROJECT_DOCS_ROOT/baseline.md를 만든다.
   자산마다 id, 위치, purpose, evidenceRef, claimedOwner, rightsStatus,
   dataClass, allowedUses를 기록한다. 소유 미확정은 unknown/unreviewed다.
5. .agentic/decisions/0001-boundaries.md에 Core/Adapter/실행 기록 경계와
   사용자 확인이 필요한 계약 항목을 적는다. 기존 코드를 Core로 옮기지 않는다.
6. PROJECT_DOCS_ROOT/implementation-state.md를 만들고 단계 상태·검사 결과·다음 입력을 기록한다.

완료 조건:
- 현재 HEAD와 검사 범위/결과가 실제 명령 출력과 일치한다.
- 기존 제품 파일을 수정하지 않는다.
- 개인/회사 소유를 임의로 판정한 항목이 없다.
- 후속 단계에서 필요한 경로·조직 정책의 미확정 목록이 명확하다.
```

## 1단계 · 지침과 프로젝트 지식 정리

```text
PROJECT 세션. 0단계 baseline을 기준으로 짧은 진입 지침과 상세 정본을 구성하라.

만들 것:
- AGENTS.md
- 정본을 연결하는 CLAUDE.md
- .agentic/context/architecture.md, integrations.md, design.md, runbooks.md
- 지침 링크/내용 충돌을 검사하는 tools/agentic/check-context.mjs

규칙:
1. 기존 CLAUDE.md의 유효한 프로젝트 규칙을 유실하지 않고 상세 문서로 이동한다.
   문서 경로 변경과 원래 규칙의 대응표를 남긴다. HANDOFF.md는 이력으로 표시한다.
2. 최초 진입은 목적·검사·작업 경계·상세 읽기 경로만으로 1~2쪽을 목표로 한다.
3. 프로젝트의 UI/외부 연동 제약, 재렌더/이벤트 처리, 모듈 버전 전달,
   장애 복구 timeout, 관리자 게시 등 실제 확인된 계약을 상세 정본에 보존한다.
4. 운영 주소·DOM 계약 등 변동 사실에 source/checkedAt를 적고 미검증은 표시한다.
5. 두 provider가 같은 프로젝트 정본을 실제로 읽도록 각 공식 로딩 방식을 확인한다.
   도구가 자동으로 읽지 않는 파일은 진입 지침에서 명시적으로 읽게 한다.
6. 전역 개인 지침은 수정하지 않는다. 운영자 설정 권한은 기존 사용자 지시를 보존한다.

검증:
- 링크 깨짐, 상충된 현재 명령, 중복 정본을 검사한다.
- 사용 가능한 provider의 새 읽기 전용 세션에서 핵심 제약 5개를 질문해 확인한다.
  인증/도구 부재는 실제 검증 미실행으로 표시한다.
- 기능 코드 diff가 없다.
```

## 2단계 · 프로젝트별 결정적 검증 환경

```text
PROJECT 세션. Core 없이 실행되는 검사 경로를 구축하라.

산출물:
- tools/agentic/doctor.mjs, check.mjs
- tests/fixtures/integration/, tests/ui/, tests/service/ (프로젝트 구조에 맞춰 지정)
- 프로젝트에 필요한 최소 정적 검사/테스트 설정과 실행 명령
- 웹 프로젝트는 Playwright 등을 사용하고, UI가 없는 프로젝트는 기능 기반 대체 검사를 명시
- PROJECT_DOCTOR / PROJECT_CHECK / PROJECT_TEST_UI / PROJECT_TEST_SERVICE 명령 계약

구현:
1. 프로젝트의 기존 런타임/빌드 실행 방식을 유지한다. 설치할 개발 의존성의 공식 사용법과
   현재 런타임 호환성을 확인하고 버전을 lock한다. 무관한 전체 코드 포맷 변경은 피한다.
2. 합성 외부 연동 fixture를 격리된 환경/별도 포트로 만든다. 실제 제품 코드를 실행하고
   주요 UI/API·상태 전환·재실행을 재현한다. 제품 로직을 테스트용으로 복제하지 않는다.
3. 외부 네트워크를 로컬 fixture로 intercept해 운영 URL에 요청하지 않도록 한다.
   폰트/이미지 요청도 허용한 로컬 자산 또는 stub으로 고정한다.
4. 설계서 7장의 검사 유형을 실제 프로젝트 기능에 매핑해 구현한다. 상태 종료/재실행/격리,
   재렌더 뒤 동작, 버전 전달, 명시된 fallback, 조회 결과를 해당 기능이 있으면 assert한다.
   비해당 항목의 근거와 프로젝트별 수용 조건을 기록한다.
5. 프로젝트 서비스가 있으면 고유 포트의 child process로 띄워 실제 API/캐시/상태 계약을 검사한다.
   finally에서 자신이 생성한 process만 종료한다. 실제 .env를 자동 주입하지 않는다.
6. 실제 사이트 검사는 별도 opt-in 명령으로 계획하고, 미설정이면 명확히 not-run이다.
7. check 결과 JSON은 명령별 status, counts, exitCode, duration, evidencePath를 포함한다.
   필수 테스트 0개는 fail, 미구현 기능의 검사는 not-applicable로 구분한다.

완료 조건:
- 새 checkout에서 PROJECT_INSTALL 후 Core 없이 결정적 검사가 돌아간다.
- 의도적으로 결함을 심은 임시 fixture/격리 복사본에서 검사가 실패하고 원복 후 통과한다.
- API/브라우저 mock 성공을 실사이트 통합 성공으로 보고하지 않는다.
- 테스트가 기존 제품 결함을 드러내면 별도 결함 기록으로 남긴다.
  검증 환경 구축 범위를 넘어 기능을 조용히 바꾸지 않는다.
```

## 3단계 · 범용 Core 최소 구현

이 단계는 공통 프롬프트의 PROJECT 경로·설계/상태 참조를 제거한 Core 전용 사본으로 전달한다. 이후 Core 변경에도 같은 방식을 적용한다.

```text
CORE 전용 새 세션에서 실행한다. 입력은 이 프롬프트의 범용 계약뿐이다.
회사/프로젝트 저장소, 대화 기록, fixtures, 내부 문서는 읽지 않는다.
CORE_ROOT가 미지정이면 실제 생성 경로 하나를 물어 확정한다.

목표: 작은 TypeScript CLI와 합성 프로젝트로 단일 작업 생명주기를 구현한다.

구조:
- packages/contracts: Task, Run, Evidence, Capability, ApprovalRef의 schema/version 검증
- packages/runner: 상태 전이, 예산, subprocess, checkpoint
- packages/providers: 우선 fake provider; 실제 도구 연결은 다음 단계
- evals/synthetic, provenance, CHANGELOG

우선 제공할 CLI 계약:
- agentic doctor --project <path> --json
- agentic run --project <path> --task <file> --provider fake
- agentic status --run <id> --json
- agentic resume --run <id>
- agentic cancel --run <id>

가드:
1. project.json의 schema, canonical path, project identity를 검증한다.
2. 명령은 실행 파일+argv 배열로 전달한다. 임의 입력을 shell 문자열로 결합하지 않는다.
3. 승인되지 않은 adapter script를 자동 실행하지 않는다.
4. run 상태/수용 조건 정의/관측 증거의 쓰기 주체를 구분한다.
5. 단일 supervisor writer, JSONL 사건 기록, atomic checkpoint로 시작한다.
6. 잘못된 상태 전이, 예산 초과, task path escape, 중복 run-id를 거부한다.
7. 미확정 라이선스를 임의로 OSS로 정하지 않는다. provenance 상태로 남긴다.

완료 조건:
- 합성 프로젝트에서 run→verify→ready/completed 흐름이 동작한다.
- 실패한 필수 검사/테스트 0개/범위 밖 변경에서 완료가 거부된다.
- 제품 도메인명이나 개인 인증값이 Core에 없다.
- 실제 provider는 아직 연결하지 않았음을 명확히 보고한다.
- 테스트 결과와 manifest를 프로젝트에 전달 가능한 범용 요약으로 반환한다.
```

## 4단계 · 실제 provider 연결과 버전 고정

```text
CORE 작업과 PROJECT 작업을 별도 세션으로 수행하라.

CORE 세션:
1. 설치된 codex/claude의 버전·--help와 공식 문서를 확인한다.
   비대화형 실행, structured events, resume, cancel, sandbox, tool scope,
   usage reporting 기능을 capability matrix로 기록한다.
2. 인터페이스 start/observe/cancel/resume을 실제 지원 기능에 맞춰 구현한다.
   native resume 부재 시 checkpoint 기반 새 실행임을 명시한다.
3. 기존 agent loop/compaction을 재구현하지 않는다.
4. 인증은 도구의 지원 방식 또는 세션 환경 주입을 사용한다.
   인증 정보를 manifest나 subprocess 로그에 저장하지 않는다.
5. unknown event, 도구 종료, 비정상 출력, 사용량 미제공을 처리한다.
6. 합성 프로젝트에서 실제 provider로 제한된 파일 변경+검사를 실행한다.
   가용하지 않은 secondary provider는 optional/unavailable로 남긴다.
7. version/digest/contracts/support matrix가 있는 로컬 release를 만든다.

PROJECT 세션:
1. Core release를 개발 의존으로 읽기 전용 연결한다. 개인 원본 symlink를 쓰지 않는다.
2. .agentic/core.lock.json과 .agentic/project.json을 작성한다.
3. project.json에 작업 root, 검사 명령, context route, 허용 환경과 data class를 선언한다.
4. 제품 runtime과 기본 npm 검사 명령이 Core에 의존하지 않는지 확인한다.

완료 조건:
- 적어도 primary provider의 실제 합성 실행 증거가 있다. mock으로 대체 보고하지 않는다.
- 도구별 차이와 미지원 기능이 doctor에서 드러난다.
- 프로젝트에 개인 Core 쓰기/개인 Git credential이 전파되지 않는다.
```

## 5단계 · 실제 격리와 권한 집행

```text
PROJECT 세션. 프로젝트 전용 실행 격리와 정책을 구성하라.
실행 가능한 격리 방식은 현 OS/컨테이너/도구 지원과 조직 정책으로 정한다.

구현:
1. .agentic/policy.json에 프로젝트 root, output/state root, tool capability,
   network destination, env allowlist, external-write authorization을 선언한다.
2. 신뢰된 runner가 이를 읽고 worker 시작 전 환경/마운트/자격증명을 제한한다.
   프롬프트나 hook만 적용한 상태를 집행 완료로 표시하지 않는다.
3. Core 릴리스 read-only, 개인 Core 원본 미마운트, 회사 밖 파일 미노출,
   운영 token 미주입을 확인한다. dependency 설치는 비밀 없는 준비 단계로 분리한다.
4. provider 세션/캐시 저장 위치를 점검해 프로젝트 경계로 격리한다.
   별도 OS 사용자/컨테이너가 필요하면 그 방식을 적용하거나 미충족을 표시한다.
5. 브라우저 context는 프로젝트 전용으로 만들고 기본은 로그인 정보 없는 상태다.
   관리자 세션과 테스트 계정은 별도 권한으로 다룬다.
6. 사용자 승인 기록은 task/action/target/artifactDigest/expiry로 저장하고
   같은 범위에 대한 재승인을 요구하지 않는다. 범위 변경 시 자동 확대하지 않는다.
7. PROJECT_DOCS_ROOT/security-verification.md에 실측한 통제와 미설정 통제를 구분한다.

음성 테스트는 모두 합성 canary로 수행한다:
- 다른 프로젝트 파일 읽기/쓰기, symlink path escape
- 개인 Core 수정, 가짜 secret 출력, 허용 밖 network POST
- fixture의 prompt injection, 도구 응답의 배포 지시
- 허용된 명령이 내부적으로 다른 프로그램을 호출하는 우회

완료 조건:
- 합성 canary 접근이 실제로 차단되며 runner가 근거를 기록한다.
- OS 강제 격리를 확인하지 못하면 uncontained이고 민감 데이터 실행은 허용하지 않는다.
- 일반 로컬 테스트는 불필요한 승인 없이 진행한다.
```

## 6단계 · 재개와 검증 증거 무결성

```text
CORE의 범용 변경은 별도 CORE 세션에서 합성 데이터로 구현하고,
PROJECT 세션에서 승인된 릴리스를 받아 연동한다.

구현:
1. queued/planning/implementing/verifying/reviewing/ready/completed 및
   waiting_approval/blocked/failed/cancelled 상태와 resumeState를 검사한다.
2. 체크포인트에 목표, 원본 acceptance, 현재 수정, last evidence,
   실패 가설, 다음 행동, 남은 예산, 사용자의 추가 지시를 보존한다.
3. 검증 대상 fingerprint는 base commit + tracked diff + 관련 untracked
   파일 + 검사 설정/fixture/tool version을 포함한다. 비밀을 fingerprint 입력으로 읽지 않는다.
4. trusted verifier가 command/argv/cwd/exit/tests/logRef/fingerprint를 생성한다.
   구현 worker는 완료 판정 파일을 직접 변경할 수 없다.
5. 에이전트의 성공 문장을 완료 신호로 사용하지 않는다.
6. 외부 부작용은 intent/receipt/reconciliation으로 관리한다.
   mock 외부 API로 요청 성공 뒤 연결 단절을 재현하고 중복 호출을 막는다.
7. restart 시 원래 저장소와 HEAD/diff가 바뀌었는지 재확인한다.
8. SIGINT/timeout에서 자신의 자식 프로세스만 정리하고 재개 가능한 기록을 남긴다.

필수 검사:
- 구현 중 kill→resume
- 검증 성공→코드 변경→오래된 증거 거절
- 부분 로그/손상 checkpoint에서 안전한 오류와 복구 경로
- 동시에 두 supervisor가 같은 run을 쓰려 할 때 하나만 허용
- 예산 소진 시 미완료로 정지, completed 아님
- 실패/skip/테스트 0개를 성공으로 오인하지 않음

최종 통합 검증은 실제 프로젝트 검사 명령으로 수행한다.
```

## 7단계 · 제한된 병렬 작업과 독립 리뷰

```text
PROJECT 세션. 먼저 단일 worker 흐름이 실제로 통과했는지 확인하라.
병렬화는 독립된 변경에만 허용하고 기본 동시 writer는 최대 2개로 시작한다.

구현:
1. supervisor만 worktree/branch를 생성·통합한다. Task에 파일/영역 lease,
   worktree path, port, browser context, base revision을 기록한다.
2. 프로젝트 Adapter가 지정한 공통 파일/전역 스타일/변경 집중 파일의 동시 변경은 직렬화한다.
3. reader/reviewer는 독립 context에서 원래 요청·수용 조건·diff·검사 결과를 읽는다.
   처음에는 역할별 상시 daemon이나 별도 에이전트 서버를 만들지 않는다.
4. worker 완료 결과는 요약+patch/commit+evidence 참조로 받는다.
5. 통합 뒤 전체 필요한 검사를 새 digest로 실행한다.
6. dirty worktree를 자동 삭제하지 않는다. 충돌은 원인과 소유자를 기록해 해결한다.
7. worktree를 sandbox로 간주하지 않는다. 정책은 5단계 격리를 유지한다.

검증:
- 독립 영역 2개 작업의 완료/통합
- 동일 파일 lease 충돌 거절
- 포트/브라우저 세션 충돌 없음
- 한 worker 실패 시 다른 결과와 사용자 변경 보존
- 의도한 예외 경로 결함을 독립 reviewer 또는 결정적 검사가 탐지

관측된 시간/충돌/비용 개선이 없으면 병렬 기본값을 1로 유지한다.
```

## 8단계 · CI와 Harness 평가

```text
PROJECT 세션. 결정적 제품 검사와 에이전트 행동 평가를 분리해서 구축하라.

제품 CI:
1. 실제 Git 호스팅과 기존 CI를 확인한다. GitHub가 없으면 로컬 ci 명령과
   비활성 예제 설정만 제공하고 원격 저장소를 임의로 만들지 않는다.
2. CI는 개인 Core/개인 token 없이 PROJECT_INSTALL과 PROJECT_CHECK를 실행한다.
3. 신뢰하지 않는 PR에 secret/write token을 주지 않는다. action은 확인한 commit에 고정한다.
4. 변경된 검사·baseline·policy에 대한 별도 리뷰를 표시한다.
5. artifact 업로드는 명시적 파일 목록만 사용하고 browser auth/HAR/raw secret을 제외한다.

평가:
1. 설계서 9장의 10개 실패 유형을 재현 가능한 평가로 만든다.
2. 회사 기반 과제는 프로젝트에, 범용 합성 과제는 별도 Core 세션에 둔다.
3. 시도/성공/실패/미실행 분모를 기록하고 model/provider/version/budget을 남긴다.
4. 동일 예산 baseline을 만들고 반복 실행 변동성을 보고한다.
5. 비용 미제공은 unknown이다. raw 대화는 프로젝트 밖으로 내보내지 않는다.
6. 제품 회귀 0건, 권한 위반 0건, 거짓 완료 0건을 초기 승격 조건으로 둔다.
   작은 평가집 통과를 일반적 안전 보장으로 표현하지 않는다.

산출물:
- tools/agentic/ci 명령, 조건에 맞는 CI 파일
- eval 과제/평가 명령/결과 JSON
- PROJECT_DOCS_ROOT/evaluation-baseline.md

완료 조건: 실제 실행 증거가 있고 mock/provider/실사이트 결과가 서로 구분된다.
```

## 9단계 · 배포물과 인수인계 리허설

```text
PROJECT 세션. Core 사용 여부와 관계없이 프로젝트를 넘겨 유지보수할 수 있게 검증하라.

구현:
1. Core lock의 version/digest/호환성/출처를 검증하고 rollback 절차를 작성한다.
2. .agentic/provenance의 자산·라이선스·개선 후보·승인 상태를 검토한다.
   권리 미확정 항목은 자동 재사용/반출하지 않는다.
3. 프로젝트 명령/도메인 지침/fixtures/검증 증거의 인수인계 목록을 만든다.
4. Core가 없는 임시 새 checkout에서 PROJECT_INSTALL, PROJECT_CHECK, PROJECT_START을 재현한다.
   프로젝트 측에서 사용할 수 없는 private 패키지나 개인 토큰 의존을 찾아 제거한다.
5. 운영 배포 절차를 dry-run/문서 검토로 확인한다. 실제 배포는 유효한 권한이 있을 때만 한다.
6. Core를 계속 쓰는 경로와 사용하지 않는 경로를 각각 문서화한다.
7. PROJECT_STATE_ROOT의 기록 보존·인계·삭제 대상을 합의 상태와 함께 정리한다.

산출물:
- PROJECT_DOCS_ROOT/handoff.md
- PROJECT_HANDOFF_CHECK 명령
- dry-run 결과, Core 제거/고정 버전 유지/rollback 안내

완료 조건:
- 개인 Core와 개인 자격증명 없이 기본 개발·검사 가능
- 회사 서비스 코드를 삭제하거나 운영 의존성을 깨뜨리지 않음
- Core 권리와 사용권의 미확정 항목을 숨기지 않음
```

## 10단계 · 실제 작업으로 최종 파일럿

```text
PROJECT 세션. Agentic 환경을 실제 한 작업으로 종단 검증하라.

선행 조건:
- 0~9단계의 필수 검사가 통과하고 실제 primary provider 연결 증거가 있다.
- 미충족 격리/권한 항목은 우회하지 않는다. 필요한 입력만 요청한다.

파일럿 과제:
프로젝트 Adapter에서 선택한 작은 실제 기능의 회귀 검사를 강화한다.
실제 프로젝트가 없으면 합성 예제의 '설정 저장→다시 읽기→다른 설정 보존'을 사용한다.
이미 해결된 버그라고 가정하지도, 현재 버그라고 단정하지도 않는다.
실제 제품 수정은 재현한 결함이 있고 이 과제 범위 내인 경우만 최소한으로 수행한다.

절차:
1. .agentic/tasks/agentic-pilot.json에 요청·allowedPaths·수용 조건·예산을 고정한다.
2. 격리 작업 공간에서 실제 provider로 구현하고 프로젝트 기능에 맞는 실제 제품 검사를 실행한다.
3. 중간 checkpoint에서 한 번 중단/재개해 작업과 증거가 이어지는지 확인한다.
4. 독립 reviewer가 선택한 기능의 정상 흐름·재실행·다른 상태 보존을 검토한다.
5. 최종 변경본 digest에서 검사를 재실행한다.
6. 회사 프로젝트 기록은 PROJECT_STATE_ROOT에만 남긴다.
7. 운영 게시 없이 검토 가능한 diff와 인수인계 요약을 전달한다.

완료 조건:
- 실제 provider→구현→제품 검사(웹이면 브라우저 포함)→재개→리뷰→증거 흐름이 확인됨
- 성공/실패/미검증 범위를 정확히 보고함
- 개인 Core 수정·회사 자료 반출·무단 배포 0건
- 실행 시간, 수리 횟수, 사람 개입, 제공되는 사용량과 개선 후보 기록
- 미통과 단계가 있으면 '구축 완료' 대신 남은 조건과 재개 명령을 제시
```

## 구축 후 일상 작업 프롬프트

```text
이 프로젝트의 Agentic 환경으로 다음 작업을 수행하라.

요청: <사용자에게 필요한 동작>
수용 조건: <관찰 가능한 조건>
허용 변경 범위: <경로/기능>
외부 작업 권한: <없음 또는 승인한 대상/행동>
한도: <시간/비용/수리 횟수>

프로젝트 지침과 최신 task/checkpoint를 읽고, 환경을 진단한 뒤 작업한다.
요청을 task 계약으로 기록하고 범위 안에서 구현·검증·필요한 리뷰까지 수행한다.
현재 변경본과 일치하는 증거만 사용하고, 테스트 0개나 미실행을 성공으로 보고하지 않는다.
동일 원인 재시도에 갇히면 가설·실패 증거·다음 행동을 기록한다.
최종적으로 변경 결과, 검사 결과, 미검증 사항, 인수인계 위치를 전달한다.
```
