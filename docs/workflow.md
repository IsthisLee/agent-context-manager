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
# 현재 프로젝트 디렉토리에서 실행 (권장)
npx @isthis/agentic init

# 또는 특정 프로젝트 경로 지정:
npx @isthis/agentic init /Users/isthis/Documents/task/EJE
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
# 프로젝트 package.json 스크립트로 실행
npm run check

# 또는 npx 직접 실행
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
