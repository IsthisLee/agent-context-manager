# Practical Workflow Guide (npm 실전 워크플로 가이드)

`agentic`은 별도의 복잡한 설치나 Git clone 없이, 현대적인 개발 표준인 **`npm`과 `npx` 명령어**를 통해 모든 기능을 제로 설치(Zero-Install)로 제공합니다.

---

## 1. 실전 4대 npm 워크플로

```text
┌──────────────────────────────────────────────────────────────┐
│ 1. 초기화 (npx @isthis/agentic init)                         │
│    5대 에이전트 지침 및 검증 도구 10초 만에 주입             │
├──────────────────────────────────────────────────────────────┤
│ 2. 개발 및 TDD 기계 검증 (npm run check)                     │
│    에이전트가 코드 수정 후 스스로 테스트 실행 & 증거 생성    │
├──────────────────────────────────────────────────────────────┤
│ 3. 환경 진단 (npx @isthis/agentic doctor)                    │
│    지침 파일 및 검증 환경 정합성 검사                        │
├──────────────────────────────────────────────────────────────┤
│ 4. 최신 코어 동기화 (npx @isthis/agentic sync)               │
│    사용자 커스텀 규칙은 보존하고 도구/지침만 최신으로 업그레이드│
└──────────────────────────────────────────────────────────────┘
```

---

### 1) 프로젝트 초기화 (`init`)

새로운 프로젝트나 기존 업무 프로젝트에서 5대 에이전트(Codex, Claude Code, Antigravity, Cursor, Copilot) 지침과 TDD 검증 도구를 즉시 세팅합니다:

```bash
# 전역 설치한 경우 (가장 간결함):
agentic init

# 또는 무설치 npx 1회성 실행:
npx @isthis/agentic init

# 특정 프로젝트 경로 지정 시:
agentic init /Users/isthis/Documents/task/EJE
# (또는: npx @isthis/agentic init /Users/isthis/Documents/task/EJE)
```

* **생성되는 산출물:**
  * **에이전트 지침 파일:** `AGENTS.md`, `CLAUDE.md`, `.gemini/rules/agentic.md`, `.cursor/rules/agentic.mdc`, `.github/copilot-instructions.md`
  * **로컬 검증 스크립트:** `tools/agentic/doctor.mjs`, `tools/agentic/check.mjs`
  * **`.gitignore` 자동 보완:** `.agentic/runs/`, `.agentic/last-check.json`

> **Note:** 대상 프로젝트에는 무거운 코어 프레임워크나 외부 런타임 의존성이 설치되지 않으므로, 프로젝트 본연의 빌드/테스트 파이프라인은 100% 독립적으로 유지됩니다.

---

### 2) 개발 및 TDD 기계 검증 (`check`)

프로젝트에서 AI 에이전트와 함께 코딩할 때, 에이전트와 개발자가 실제 테스트를 실행하여 기계 증거를 만듭니다:

```bash
# 전역 설치한 경우:
agentic check

# 프로젝트 package.json 스크립트로 실행:
npm run check

# 무설치 npx 직접 실행:
npx @isthis/agentic check
```

* **동작 원리:**
  * 프로젝트의 실제 테스트 명령(`npm test`)을 실행합니다.
  * 테스트 실행 결과(종료 코드, 실행 시간, 성공 여부)를 `.agentic/last-check.json`에 기계 증거로 기록합니다.
  * 테스트가 성공(`exitCode: 0`)한 경우에만 에이전트가 작업을 완료할 수 있습니다.

---

### 3) 지침 및 환경 진단 (`doctor`)

프로젝트의 에이전트 지침 파일들이 누락되지 않았는지, TDD 검증 환경이 올바르게 설정되어 있는지 진단합니다:

```bash
# 전역 설치한 경우:
agentic doctor

# 무설치 npx 실행:
npx @isthis/agentic doctor
```

* **진단 항목:**
  * 5대 에이전트 지침 파일 존재 및 필수 섹션(기계 검증 우선, TDD 준수) 포함 여부
  * `package.json`의 `check` 및 `test` 스크립트 등록 상태
  * `tools/agentic/` 스크립트의 실행 가능 상태

---

### 4) 최신 코어 동기화 (`sync`)

오픈소스 코어에 새로운 기여자의 PR이 머지되어 npm에 새 버전(예: 신규 에이전트 지원, 프롬프트 개선, 도구 버그 수정)이 배포되었을 때:

```bash
# 전역 설치한 경우:
agentic sync

# 무설치 npx 실행:
npx @isthis/agentic sync
```

* **스마트 동기화 계약 (Smart Sync):**
  * **사용자 커스텀 규칙 보존:** 사용자가 `AGENTS.md`나 `CLAUDE.md`에 추가해 둔 프로젝트 고유의 도메인/아키텍처 규칙은 안전하게 보존됩니다.
  * **도구 및 공통 지침 갱신:** `tools/agentic/*` 검증 도구와 공통 지침 템플릿만 최신 릴리즈 버전으로 깔끔하게 업그레이드됩니다.
  * 사용자는 Git 충돌이나 브랜치 머지를 신경 쓸 필요 없이, `npx` 명령 한 줄로 최신 개선사항을 흡수할 수 있습니다.

---

## 2. 메인테이너 릴리즈 워크플로 (npm 배포)

코어 저장소([`agentic`](file:///Users/isthis/Documents/task/agentic))에서 새로운 기능을 개발하고 npm에 정식 릴리즈할 때의 절차입니다:

```bash
# 1. 템플릿 및 도구 수정 후 자체 검증
npm run check

# 2. 버전 태깅 및 npm 배포
npm version patch  # 0.1.0 -> 0.1.1
npm publish --access public

# 3. GitHub 푸시
git push --follow-tags
```

---

## 3. 점진적 지침 공개 가이드 (Progressive Disclosure: AGENTS.md ➔ docs/)

프로젝트가 성장하면서 비즈니스 로직, API 규격, DB 정책 등 수많은 지침이 추가됩니다. 이때 모든 내용을 `AGENTS.md`에 계속 누적하면 LLM의 주의력 결핍과 토큰 낭비가 발생합니다.

`agentic`은 2026년 공식 엔지니어링 모범 사례에 기반하여 **"지도와 서랍 (Map & Drawer)" 패턴**을 권장합니다.

```text
내 프로젝트/
├── AGENTS.md                 ◀── [루트 지도 (150줄 이내 유지)]
│                                 - 불변의 핵심 규약 (TDD, 기계 검증, 최소 변경)
│                                 - 상세 지식 목차 (Index):
│                                   * 결제 연동 작업 시: `docs/payments.md` 참고
│                                   * DB 스키마/마이그레이션: `docs/database.md` 참고
│                                   * 배포/CI 규칙: `docs/deployment.md` 참고
│
└── docs/                     ◀── [상세 지식 서랍 (프로젝트와 함께 무한 확장)]
    ├── payments.md           - 토스/PG사 멱등키 및 샌드박스 API 규칙
    ├── database.md           - Prisma 트랜잭션 및 인덱싱 정책
    └── deployment.md         - Docker 빌드 및 환경변수 주입 규칙
```

### 1) 왜 150줄 기준인가? (공식 엔지니어링 근거)

1. **주의력 희석 방지 (Attention Dilution & Lost in the Middle):** [`[근거: Stanford 연구]`](references.md#stanford-lost-in-the-middle)
   - Stanford 연구(Liu et al.) 및 최신 LLM 주의력 연구에 따르면, 단일 파일이 과도하게 길어질수록 중간에 위치한 중요한 핵심 제약(예: "기계 검증 통과 전 완료 보고 금지", "비밀값 노출 금지")을 모델이 무시하거나 망각할 확률이 비선형적으로 증가합니다.
2. **OpenAI 공식 AGENTS.md 모듈화 권장:** [`[근거: OpenAI 가이드라인]`](references.md#openai-agents-md)
   - OpenAI는 공식 문서(*Custom instructions with AGENTS.md*)에서 *"AGENTS.md는 간결하고 핵심적인 행동 강령에 집중해야 하며, 대규모 API 명세나 세부 문서를 루트 파일 하나에 과도하게 채우지 말라"*고 명시합니다. 대신 프로젝트 내 `docs/` 디렉터리에 전문 문서를 분리하고 `AGENTS.md`에는 목차(Index)와 참조 링크를 제공하여 에이전트가 필요할 때만 동적으로 읽도록 권장합니다.
3. **Anthropic 온디맨드 점진적 로딩:** [`[근거: Anthropic 연구]`](references.md#anthropic-context-engineering)
   - Anthropic 공식 리포트(*Effective context engineering for AI agents*) 역시 *"루트 프롬프트는 최소한의 목차(Index)로 유지하고, 에이전트가 특정 도메인 작업을 시작할 때 해당 문서를 파일 읽기 도구로 온디맨드 로딩하게 만드는 것"*이 작업 성공률을 극대화함을 실증했습니다.
4. **토큰 비용 및 응답 속도(Latency) 최적화:**
   - 단순한 버그 수정이나 UI 작업 1개를 수행할 때도 무관한 1,000줄의 결제/DB/배포 지침이 매 턴(Turn)마다 컨텍스트에 주입되면 비용이 낭비되고 에이전트의 추론 레이턴시가 지연됩니다.

### 2) 실전 분리 방법

`AGENTS.md`의 `## 4. 프로젝트 규칙 확장` 섹션을 아래와 같이 목차(Index) 형태로 작성합니다:

```markdown
## 4. 프로젝트 규칙 확장 (SSOT)

이 프로젝트에만 적용되는 도메인 규칙이나 아키텍처 제약은 오직 이 파일(`AGENTS.md`)의 하단이나 `docs/`에 추가하여 단일 정본으로 관리한다. 모든 에이전트는 이 규칙을 공통으로 따른다.

### 도메인별 상세 지침 목차
* **결제/정산 작업 시:** [`docs/payments.md`](docs/payments.md) 규약을 필독하라.
* **DB 모델링 및 쿼리 작성 시:** [`docs/database.md`](docs/database.md) 규칙을 준수하라.
* **배포 및 CI 파이프라인 수정 시:** [`docs/deployment.md`](docs/deployment.md)를 참고하라.
```

### 3) 자동 진단 지원 (`agentic doctor`)

`npx @isthis/agentic doctor` (또는 `node tools/agentic/doctor.mjs`)를 실행하면 `AGENTS.md`의 줄 수를 자동으로 진단합니다:
- **150줄 이하:** `✓ [PASS] AGENTS.md Size: 45 lines (optimal)`
- **150줄 초과:** `⚠ [WARN] AGENTS.md Size: 182 lines (>150 lines: consider splitting detailed domain rules into docs/ to save LLM tokens)`
경고 발생 시 상세 도메인 규칙을 `docs/`로 이동하면 에이전트의 집중도와 속도를 최상으로 유지할 수 있습니다.

