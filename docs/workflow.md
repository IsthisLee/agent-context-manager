# Practical Workflow Guide (실전 워크플로 가이드)

---

## 1. 신규/기존 프로젝트에 적용하기 (10초)

새로운 프로젝트나 기존 업무 프로젝트에 `agentic` 하네스를 적용할 때 (설치 불필요):

```bash
# npx로 즉시 실행
npx github:IsthisLee/agentic init

# 또는 로컬 저장소 기준:
node /path/to/agentic/bin/agentic.mjs init .
```

* **자동 생성 산출물:**
  * `AGENTS.md` (OpenAI Codex)
  * `CLAUDE.md` (Anthropic Claude Code)
  * `.gemini/rules/agentic.md` (Google Antigravity)
  * `.cursor/rules/agentic.mdc` (Cursor)
  * `.github/copilot-instructions.md` (GitHub Copilot)
  * `tools/agentic/doctor.mjs` (환경 및 지침 진단기)
  * `tools/agentic/check.mjs` (결정론적 TDD 자가 검증기)
  * `.gitignore` 자동 보완

---

## 2. 일상 개발 워크플로 (에이전트 활용)

에이전트는 선호하는 도구를 자유롭게 선택하여 실행합니다:

* **터미널 위주 작업:** `claude` 또는 `codex` 실행
* **IDE / 복합 작업:** Antigravity, Cursor, 또는 VS Code Copilot 실행

### 에이전트의 내부 행동 루프:
1. 에이전트가 생성된 `AGENTS.md` 또는 `CLAUDE.md`를 읽고 프로젝트의 코딩/테스트 규칙을 숙지합니다.
2. 기능 구현 또는 버그 수정을 진행합니다.
3. 코드 수정 후 터미널에서 `node tools/agentic/check.mjs`를 스스로 실행합니다.
4. 테스트 통과 및 기계 증거를 확인한 뒤 사용자에게 완료를 보고합니다.

---

## 3. 프로젝트별 규칙 확장 및 독립성 (Project Customization)

`agentic init`으로 생성된 지침 파일들은 **프로젝트 내부의 독립된 사본**입니다.

* **로컬 규칙 확장:** 프로젝트 고유의 DB 스키마, 특수한 린트 규칙, 도메인 제약 등은 생성된 `AGENTS.md`나 `CLAUDE.md` 하단에 자유롭게 작성하여 관리합니다.
* **오픈소스 Core 불변성:** 프로젝트 안에서 어떤 규칙을 추가하거나 수정하더라도, **오픈소스 원본 저장소(`agentic`)의 공통 규칙은 절대 임의로 변경되지 않습니다.**
* **Core 개선 기여:** 오픈소스 공통 규칙 자체를 업그레이드하고 싶다면, `agentic` 저장소에서 정식 PR이나 릴리스 버저닝을 통해 안전하게 기여합니다.
