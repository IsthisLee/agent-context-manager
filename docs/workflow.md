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

## 3. 규칙 개선 및 승격 워크플로 (Rule Promotion)

프로젝트를 진행하다가 다른 프로젝트에도 유용할 훌륭한 패턴이나 버그 회피 팁을 발견한 경우:

### 서브에이전트(Subagent) 활용 (권장):
메인 에이전트에게 다음과 같이 지시합니다:
> *"이번에 해결한 이슈의 순수 기술 패턴을 서브에이전트를 띄워 `agentic/specifications/` 공통 규칙에 추가해줘. 단, 현재 프로젝트의 고유 명칭과 비즈니스 로직은 100% 제거하고 순수 기술 추상화 규칙으로만 작성해."*

* 서브에이전트는 프로젝트의 기밀과 격리된 깨끗한 상태에서 Core 저장소의 규칙 파일만 간결하게 갱신합니다.

### 모든 프로젝트에 규칙 재동기화:
```bash
# 규칙을 수정한 뒤 각 프로젝트에서 실행
node /path/to/agentic/bin/agentic.mjs sync .
```
모든 프로젝트의 `AGENTS.md`, `CLAUDE.md`, `.gemini/rules/`가 최신 공통 규칙으로 일괄 동기화됩니다.
