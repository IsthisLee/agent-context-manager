# Practical Workflow Guide (실전 워크플로 가이드)

---

## 1. 프로젝트에 하네스 주입하기 (`agentic init`)

새로운 프로젝트나 기존 프로젝트에 에이전트 지침 및 검증 도구를 10초 만에 주입합니다:

```bash
# npx로 원격 실행 (권장)
npx github:IsthisLee/agentic init

# 또는 대상 경로 지정 실행:
npx github:IsthisLee/agentic init /Users/isthis/Documents/task/EJE
```

### 프로젝트에 생성되는 파일:
* `AGENTS.md` (OpenAI Codex용 지침)
* `CLAUDE.md` (Anthropic Claude Code용 지침)
* `.gemini/rules/agentic.md` (Google Antigravity용 지침)
* `.cursor/rules/agentic.mdc` (Cursor용 지침)
* `.github/copilot-instructions.md` (GitHub Copilot용 지침)
* `tools/agentic/doctor.mjs` (환경 및 지침 진단 도구)
* `tools/agentic/check.mjs` (결정론적 TDD 자가 검증기)
* `.gitignore` 자동 보완 (`.agentic/runs/`, `.agentic/last-check.json`)

> **Note:** 대상 프로젝트에는 무거운 코어 프레임워크나 외부 런타임 의존성이 설치되지 않습니다. 프로젝트 본연의 빌드와 테스트는 독립적으로 유지됩니다.

---

## 2. 역할별 2대 운영 모드 (Dogfooding 워크플로)

### 모드 A. 평소 프로젝트 개발 시 (Consumer / Dogfooding 모드)
* 일상적인 앱(쇼핑몰, 웹 서비스 등)을 개발할 때:
* **코어 저장소의 소스코드를 직접 링크하거나 수정하지 않습니다.**
* 일반 사용자와 동일하게 `npx github:IsthisLee/agentic init`으로 주입받아 사용합니다.
* **효과:** 코어 소스코드 오염 방지 및 일반 사용자와 동일한 설치/사용 환경 검증(Dogfooding).

### 모드 B. 코어 자체를 개선할 때 (Maintainer 모드)
* 여러 프로젝트를 겪으며 공통 TDD 룰 개선이나 진단 도구 업그레이드가 필요할 때만 **이 저장소([`agentic`](file:///Users/isthis/Documents/task/agentic))**를 엽니다:
  1. 템플릿([`templates/`](file:///Users/isthis/Documents/task/agentic/templates/)) 또는 CLI 소스 수정
  2. 기계 검증 수행 (`npm run check`)
  3. `git commit` & `git push`로 정식 릴리즈

---

## 3. 원본 코어 개선(PR)과 내 코어 커스텀의 공존

### 시나리오:
1. 다른 기여자가 원본 GitHub 저장소(`agentic`)에 PR을 올려 유용한 프롬프트나 버그 수정이 머지됨.
2. 나는 이미 내 취향이나 팀 표준에 맞게 내 코어(`agentic`)를 커스텀하여 사용 중인 상태임.

### 해결 워크플로 (Git Upstream Merge):
오픈소스의 표준 동기화 절차에 따라 안전하게 병합합니다:

```bash
# 1. 원본 저장소의 최신 커밋 가져오기
git fetch upstream

# 2. 내 코어 브랜치에 병합
git merge upstream/main
```

* Git의 3-way merge를 통해 다른 사람의 PR 개선사항과 내 커스텀 규칙이 자동으로 합쳐집니다.
* 겹치는 부분이 있다면 충돌(Conflict) 지점을 확인하고 원하는 규칙을 취사선택하여 확정합니다.

---

## 4. 프로젝트 내 에이전트 협업 일상 개발 루프

프로젝트 안에서 Codex, Claude Code, Antigravity, Cursor 중 원하는 에이전트를 실행합니다:

```text
[1. 지침 확인] ──▶ [2. Red-TDD] ──▶ [3. 최소 Green] ──▶ [4. 자가 검증 & 증거]
  (AGENTS.md 등)     (실패 테스트)        (최소 구현)         (check.mjs 통과)
```

1. 에이전트가 주입된 지침 파일(`AGENTS.md`, `CLAUDE.md` 등)을 읽고 프로젝트의 TDD 원칙과 검증 명령을 숙지합니다.
2. **Red:** 코드 수정 전 실패하는 테스트를 먼저 작성합니다.
3. **Green:** 테스트를 통과시키는 최소한의 코드만 작성합니다.
4. **자가 검증:** 에이전트가 터미널에서 `node tools/agentic/check.mjs`를 스스로 실행하여 `exitCode: 0` 증거를 확인한 뒤 사용자에게 완료를 보고합니다.
