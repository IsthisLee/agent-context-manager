# References

외부 연구와 오픈소스 도구의 사실을 기록하는 참고 문서다. 이 문서는 프로필 지침의 정본이 아니며, 제품 방향과 구현 계약의 근거로만 사용한다.

## 제품 방향에 반영하는 원칙

- 복잡한 에이전트 하네스는 작업·모델에 따라 비용과 지연을 크게 늘릴 수 있으므로, 기본 기능은 작게 유지하고 선택적으로 확장한다. [Anthropic Harness 연구](https://www.anthropic.com/engineering/harness-design-long-running-apps) (확인일: 2026-09-14)
- 테스트 실행 결과는 유용한 검증 신호지만, 요구사항 충족·지침 준수·제품 품질 전체의 증명은 아니다. 별도 grader나 사람 검토가 필요할 수 있다. [Anthropic Evals 설명](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (확인일: 2026-09-14)
- 루트 지침은 필요한 고신호 정보를 제공하고 상세 지침은 필요할 때 찾을 수 있게 구성한다. 특정 줄 수를 공식 기준으로 취급하지 않는다. [Anthropic Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [OpenAI AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) (확인일: 2026-09-14)

## 프로젝트 지침 자동 생성에 관한 근거

코드베이스를 분석해 프로젝트 지침을 작성하는 기능을 agctx에 두지 않는 결정([ADR 0006](adr/0006-no-codebase-analysis-guidance.md))과, 프로필 초안을 사용자의 에이전트가 만들 때 그 범위를 정한 결정([ADR 0023](adr/0023-profile-drafting-through-agent-skill.md))의 외부 근거다.

- **각 에이전트가 초안 생성 기능을 기본으로 제공한다.** Claude Code의 `/init`은 코드베이스를 분석해 빌드 명령·테스트 방법·프로젝트 관례를 담은 `CLAUDE.md` 초안을 만든다. 기존 `CLAUDE.md`가 있으면 덮어쓰지 않고 개선안을 제안한다. Codex의 `/init`은 `AGENTS.md` 초안을 만들며 생성 결과를 검토한 뒤 저장소 관례에 맞게 고치라고 안내한다. [Claude Code memory](https://code.claude.com/docs/en/memory), [Codex developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli) (확인일: 2026-09-14)
- **공식 가이드는 에이전트가 코드를 읽어 알아낼 수 있는 내용을 지침에서 빼라고 권한다.** Anthropic은 넣을 내용으로 추측할 수 없는 Bash 명령, 기본값과 다른 코드 스타일, 테스트 방법, 프로젝트 고유의 아키텍처 결정, 흔한 함정을 든다. 뺄 내용으로는 "코드를 읽으면 알 수 있는 모든 것", 파일별 코드베이스 설명, 자주 바뀌는 정보를 든다. `/doctor`는 디렉터리 구조·의존성 목록·아키텍처 개요처럼 코드에서 도출할 수 있는 내용을 잘라내자고 제안한다. [Claude Code best practices](https://code.claude.com/docs/en/best-practices), [Claude Code memory](https://code.claude.com/docs/en/memory) (확인일: 2026-09-14)
- **공식 가이드는 지침이 길어지면 규칙이 무시된다고 경고한다.** Anthropic best practices는 "Bloated CLAUDE.md files cause Claude to ignore your actual instructions!"라고 쓰고, 실패 패턴으로 "If your CLAUDE.md is too long, Claude ignores half of it because important rules get lost in the noise."를 든다. 규칙이 있는데도 원치 않는 행동이 반복되면 파일이 너무 길어 규칙이 묻혔을 가능성이 크다고 안내한다. memory 문서는 CLAUDE.md 파일마다 200줄 미만을 목표로 하라고 권하며 "Longer files consume more context and reduce adherence."라고 설명한다. 이 권고는 운영 지침이며 길이에 따른 준수율 측정값은 제시하지 않는다. 아래 연구는 이와 달리 지시를 따르는지가 아니라 따랐을 때 도움이 되는지를 측정했다. [Claude Code best practices](https://code.claude.com/docs/en/best-practices), [Claude Code memory](https://code.claude.com/docs/en/memory) (확인일: 2026-09-15)
- **실측 연구도 저장소 개요의 효과를 확인하지 못했다.** Gloaguen 외(ETH Zurich)는 LLM이 생성한 컨텍스트 파일을 붙인 SWE-bench 과제와 개발자가 커밋한 컨텍스트 파일이 있는 저장소의 이슈로 여러 LLM과 코딩 에이전트를 평가했다. 컨텍스트 파일은 과제 성공률을 일반적으로 높이지 않았으며 추론 비용을 평균 20% 넘게 늘렸다. 생성한 파일과 개발자가 쓴 파일 모두 같은 경향이었다. 에이전트는 파일 안의 지시를 잘 따랐지만 저장소 개요는 도움이 되지 않았다. 저자들은 컨텍스트 파일이 비표준 코딩 관례를 지정할 때 유용하다고 결론 내렸다. [arXiv 2602.11988](https://arxiv.org/abs/2602.11988) (확인일: 2026-09-14)
- **지침을 만드는 방식이 결과를 가른다는 반대 결과도 있다.** probe-and-refine 방식은 합성 버그 수정 과제로 지침 파일의 부족한 곳을 찾아 LLM 호출로 반복 수정한다. SWE-bench Verified에서 Qwen3.5-35B-A3B로 4회 시행한 평균 해결률은 지침 없음 25.5%, 수정 전 지침 28.3%, 수정 후 지침 33.0%였다. 향상은 수정의 정밀도가 아니라 에이전트가 올바른 파일에 도달하는 비율에서 나왔다. 진단용 출력을 충분히 만들지 못한 다른 모델에서는 수정 루프의 효과가 떨어졌다. 이 방식도 모델 호출로 지침을 만들므로 모델 호출을 범위 밖에 둔 agctx의 결정을 바꾸지 않는다. [arXiv 2606.20512](https://arxiv.org/abs/2606.20512) (확인일: 2026-09-14)

## 기본 지침의 근거와 분량에 관한 자료

패키지가 배포하는 기본 지침의 근거 기준과 분량 예산 논의([기본 지침의 근거 기준과 분량 예산](discussion/architecture/topics/guidance-evidence-and-budget.md))의 외부 근거다. 지침이 길어지면 규칙이 무시된다는 경고는 [프로젝트 지침 자동 생성에 관한 근거](#프로젝트-지침-자동-생성에-관한-근거)에 있다.

- **공식 가이드는 지침 한 줄마다 필요성을 따지고 확인할 수 있게 쓰라고 권한다.** best practices는 "For each line, ask: *Would removing this cause Claude to make mistakes?* If not, cut it."라고 쓴다. memory 문서는 "Use 2-space indentation" instead of "Format code properly"처럼 지켰는지 확인할 수 있는 지침을 예로 든다. [Claude Code best practices](https://code.claude.com/docs/en/best-practices), [Claude Code memory](https://code.claude.com/docs/en/memory) (확인일: 2026-09-15)
- **지침은 권고이고 반드시 지켜야 하는 동작은 hooks의 몫이다.** best practices는 "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens."라고 구분한다. 지침을 바꾼 뒤에는 "test changes by observing whether Claude's behavior actually shifts"라고 권한다. [Claude Code best practices](https://code.claude.com/docs/en/best-practices) (확인일: 2026-09-15)
- **성공을 주장하지 말고 증거를 보이게 하라고 권한다.** "Have Claude show evidence rather than asserting success: the test output, the command it ran and what it returned, or a screenshot of the result." [Claude Code best practices](https://code.claude.com/docs/en/best-practices) (확인일: 2026-09-15)
- **좋은 컨텍스트는 신호가 높은 최소한의 토큰이다.** Anthropic은 "good context engineering means finding the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome."라고 정의한다. 토큰이 늘수록 "the model's ability to accurately recall information from that context decreases."라고 설명하고, 시스템 프롬프트는 너무 경직되지도 모호하지도 않은 "right altitude"를 찾으라고 권한다. [Anthropic Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (확인일: 2026-09-15)
- **Claude Code는 지침 파일 분량의 목표치와 한도를 밝힌다.** "target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence." 4 MiB를 넘는 CLAUDE.md는 읽지 않는다. `@path` import는 정리에는 도움이 되지만 "doesn't reduce context, since imported files load at launch"이다. 자동 메모리의 200줄·25KB 한도는 "applies only to `MEMORY.md`"이다. [Claude Code memory](https://code.claude.com/docs/en/memory) (확인일: 2026-09-15)
- **Codex는 지침 파일의 합산 크기에 한도를 둔다.** "Codex skips empty files and stops adding files once the combined size reaches the limit defined by `project_doc_max_bytes` (32 KiB by default)." 한도에 닿으면 "Raise the limit or split instructions across nested directories when you hit the cap."라고 안내한다. [OpenAI AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) (확인일: 2026-09-15)

## 에이전트 규칙 파일 로드 근거

[ADR 0009](adr/0009-agent-rule-frontmatter.md)의 근거다. 아래 내용은 모두 2026-09-14에 확인했다. 에이전트 도구가 갱신되면 결과가 달라질 수 있다. 실험은 이름을 바꾸기 전에 했으므로 규칙 파일이 당시 이름 `.agents/rules/agentic.md`로 적혀 있다. 현재 이름은 `.agents/rules/agctx.md`다.

- **Antigravity 공식 문서는 규칙 위치와 켜지는 방식의 종류만 적는다.** 전역 규칙은 `~/.gemini/GEMINI.md`, 워크스페이스 규칙은 워크스페이스나 git 루트의 `.agents/rules` 폴더에 둔다. 켜지는 방식(activation)은 Manual·Always On·Model Decision·Glob 네 가지다. 켜지는 방식의 기본값과 frontmatter 문법은 적혀 있지 않고, 루트 `AGENTS.md`도 언급하지 않는다. [Google Antigravity Rules](https://antigravity.google/docs/rules-workflows/) (확인일: 2026-09-14)

  > "Workspace rules live in the `.agents/rules` folder of your workspace or git root."
  >
  > 번역: 워크스페이스 규칙은 워크스페이스나 git 루트의 `.agents/rules` 폴더에 있습니다.

- **Antigravity frontmatter 키는 비공식 자료에서 가져왔다.** Rulesync는 Antigravity 규칙 frontmatter의 `trigger` 값으로 `always_on`·`glob`·`manual`·`model_decision`을 적는다. 공식 문서가 아니므로 아래 실험으로 효과를 확인했다. [Rulesync File Formats](https://rulesync.dyoshikawa.com/reference/file-formats) (확인일: 2026-09-14)
- **Claude Code는 `AGENTS.md`를 직접 읽지 않는다.** 대신 `CLAUDE.md`에서 `@AGENTS.md`로 불러오라고 안내한다. [Claude Code memory](https://code.claude.com/docs/en/memory) (확인일: 2026-09-14)

  > "Claude Code reads `CLAUDE.md`, not `AGENTS.md`."
  >
  > 번역: Claude Code는 `AGENTS.md`가 아니라 `CLAUDE.md`를 읽습니다.

- **Codex는 `AGENTS.md`를 직접 읽는다.** [OpenAI AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) (확인일: 2026-09-14)
- **실험: 에이전트 CLI가 실제로 불러온 지침.** 빈 git 프로젝트에 `profile apply personal`을 실행하고, `AGENTS.md`의 프로젝트 확장 영역에 전역 규칙과 겹치지 않는 마커 문자열을 넣었다. 각 에이전트 CLI에 도구를 쓰지 말고 컨텍스트에 이미 들어온 지침만 보고 마커와 포인터 파일 제목이 보이는지 답하게 했다. 모든 응답이 도구를 쓰지 않았다고 답했지만, 이는 에이전트의 자기 보고다.

  | 에이전트 (실행 명령) | 루트 `AGENTS.md` 마커 | 에이전트별 파일 |
  | --- | --- | --- |
  | Claude Code (`claude -p`) | 보임 | `CLAUDE.md` 보임 |
  | Codex (`codex exec --sandbox read-only`) | 보임 | 해당 없음 |
  | GitHub Copilot CLI (`copilot -p`) | 보임 | `.github/copilot-instructions.md`와 `CLAUDE.md` 보임 |
  | Antigravity CLI (`agy --add-dir <project> -p`) | 보임 | frontmatter 없는 `.agents/rules/agentic.md` 보이지 않음 |
  | Cursor CLI (`cursor-agent -p --trust`) | 보임 | 첫 줄이 관리 마커인 `.cursor/rules/agentic.mdc` 보이지 않음, `CLAUDE.md` 보임 |

  - Antigravity CLI는 `--add-dir`로 워크스페이스를 주지 않으면 루트 `AGENTS.md`도 보지 못했다. 폴더를 열고 쓰는 IDE와는 실행 조건이 다르다.
  - 같은 프로젝트에서 `.agents/rules/agentic.md` 맨 앞에 `trigger: always_on` frontmatter만 추가하자 Antigravity CLI가 규칙 파일 제목을 보았다. ADR 0009를 반영한 코드로 새 프로젝트에 적용했을 때도 같은 결과였다.
  - 수정 전 코드가 만든 `.cursor/rules/agentic.mdc`는 첫 줄이 관리 마커이고 `alwaysApply: true` frontmatter가 둘째 줄부터 시작했다. Cursor CLI는 이 파일을 로드하지 않았다. ADR 0009를 반영한 코드로 frontmatter가 첫 줄에 오게 적용한 프로젝트에서는 규칙 파일 제목을 보았다.
  - Cursor CLI는 신뢰하지 않은 폴더에서 확인 화면을 띄우고 멈추므로, 실험에서는 실행마다 `--trust`를 붙였다.

## 에이전트 지침 로드와 전달 확인 근거

`agctx explain`의 로드 규칙, `agctx verify`의 세션 기록 판독과 probe, 에이전트용 스킬 배포([ADR 0019](adr/0019-explain-verify-and-agent-skills.md))가 기대는 외부 사실이다. Antigravity 규칙 파일의 `trigger` 실측은 [에이전트 규칙 파일 로드 근거](#에이전트-규칙-파일-로드-근거)에 있다.

- **공식 문서(Codex 지침 파일):** Codex는 Codex 홈(기본 `~/.codex`)에서 `AGENTS.override.md`가 있으면 그것을, 없으면 `AGENTS.md`를 읽는다. 프로젝트에서는 Git 저장소 루트부터 현재 작업 폴더까지 내려가며 폴더마다 `AGENTS.override.md`, `AGENTS.md`, `project_doc_fallback_filenames`에 적은 이름 순서로 찾고, 한 폴더에서 파일을 최대 하나만 넣는다. 파일은 루트부터 차례로 이어 붙이며 합산 크기가 `project_doc_max_bytes`(기본 32 KiB)에 닿으면 더 넣지 않는다. [OpenAI AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) (확인일: 2026-09-15)
- **공식 문서(Claude Code 지침 파일):** 작업 폴더와 그 위 모든 폴더의 `CLAUDE.md`·`CLAUDE.local.md`를 시작할 때 읽고, 작업 폴더 아래 폴더의 파일은 Claude가 그 폴더의 파일을 읽을 때 넣는다. 프로젝트 지침은 `./CLAUDE.md` 또는 `./.claude/CLAUDE.md`, 사용자 지침은 `~/.claude/CLAUDE.md`, 관리 정책 파일은 macOS `/Library/Application Support/ClaudeCode/CLAUDE.md`, Linux·WSL `/etc/claude-code/CLAUDE.md`, Windows `C:\Program Files\ClaudeCode\CLAUDE.md`에 둔다. `.claude/rules/`에서 `paths` frontmatter가 없는 규칙은 시작할 때, 있는 규칙은 맞는 파일을 읽을 때 들어간다. [Claude Code memory](https://code.claude.com/docs/en/memory) (확인일: 2026-09-15)
- **공식 문서(Claude Code 가져오기):** `@path` 가져오기는 가져오는 파일 기준 상대 경로로 풀리고 최대 네 단계까지 이어진다. 코드 블록과 코드 스팬 안의 `@`는 가져오지 않는다. 프로젝트 수준 파일이 작업 폴더 밖을 가져오면 처음 한 번 승인 창을 띄우며, 사용자 수준 파일(`~/.claude/CLAUDE.md`, `~/.claude/rules/`)의 가져오기는 묻지 않는다. [Claude Code memory](https://code.claude.com/docs/en/memory) (확인일: 2026-09-15)

  > "An import in a project-level memory file is external when its path resolves outside your working directory, like the home directory import above. The first time Claude Code encounters external imports in a project, it shows an approval dialog listing the files. If you decline, the imports stay disabled and the dialog doesn't appear again."
  >
  > 번역: 프로젝트 수준 메모리 파일의 가져오기는 그 경로가 작업 폴더 밖으로 풀리면 외부 가져오기입니다. 위의 홈 폴더 가져오기가 그 예입니다. Claude Code는 한 프로젝트에서 외부 가져오기를 처음 만나면 파일 목록과 함께 승인 창을 보여 줍니다. 거절하면 그 가져오기는 꺼진 채로 남고 승인 창은 다시 나타나지 않습니다.

- **공식 문서(Claude Code 압축과 확인 수단):** `/compact` 뒤에는 프로젝트 루트 `CLAUDE.md`를 디스크에서 다시 읽어 넣고, 하위 폴더 `CLAUDE.md`와 `paths` 규칙은 맞는 파일을 읽을 때 다시 들어간다. 어떤 지침 파일이 언제 왜 들어갔는지 기록하려면 `InstructionsLoaded` 훅을 쓰라고 안내한다. [Claude Code memory](https://code.claude.com/docs/en/memory) (확인일: 2026-09-15)
- **공식 문서(Claude Code 세션 기록):** 세션 기록은 `~/.claude/projects/<project>/<session-id>.jsonl`에 JSONL로 저장되고, `<project>`는 작업 폴더 경로의 영숫자가 아닌 문자를 `-`로 바꾼 이름이다. 바꾼 이름이 200자를 넘으면 200자로 자르고 전체 경로의 해시를 붙인다. `CLAUDE_CONFIG_DIR`로 저장 위치를, `CLAUDE_CODE_PROJECT_DIR_NAME`으로 폴더 이름을 바꿀 수 있다. [Claude Code sessions](https://code.claude.com/docs/en/sessions) (확인일: 2026-09-15)

  > "The entry format is internal to Claude Code and changes between versions, so scripts that parse these files directly can break on any release."
  >
  > 번역: 항목 형식은 Claude Code 내부용이며 버전마다 바뀌므로, 이 파일을 직접 파싱하는 스크립트는 어느 릴리스에서든 깨질 수 있습니다.

- **공식 문서(Claude Code CLI):** `--print`·`-p`는 대화형 모드 없이 응답을 출력한다. `--no-session-persistence`는 세션을 디스크에 저장하지 않으며 print 모드에서만 쓴다. [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference) (확인일: 2026-09-15)
- **공식 문서(Claude Code 스킬):** `disable-model-invocation: true`는 Claude가 스킬을 스스로 불러오지 못하게 하고 사용자가 `/이름`으로 부를 때만 쓰게 한다. 스킬 목록에서 `description`과 `when_to_use`를 합친 글은 1,536자에서 잘린다. 프로젝트 스킬은 `.claude/skills/<skill-name>/SKILL.md`에 둔다. [Claude Code skills](https://code.claude.com/docs/en/skills) (확인일: 2026-09-15)
- **공식 문서(Codex 스킬):** Codex는 현재 폴더부터 저장소 루트까지의 `.agents/skills`에서 스킬을 찾고, `SKILL.md`에는 `name`과 `description`이 있어야 한다. `agents/openai.yaml`의 `policy.allow_implicit_invocation`을 `false`로 두면 명시적으로 부를 때만 쓴다. 처음 넣는 스킬 목록은 모델 컨텍스트 창의 2%, 창 크기를 모르면 8,000자까지만 쓴다. [Codex skills](https://learn.chatgpt.com/docs/build-skills) (확인일: 2026-09-15)

  > "Codex won't implicitly invoke the skill based on user prompt; explicit `$skill` invocation still works."
  >
  > 번역: Codex는 사용자 프롬프트를 보고 스킬을 암묵적으로 호출하지 않지만, `$skill`로 명시해 호출하는 방식은 여전히 동작합니다.

- **비공식 자료(skills CLI):** skills CLI는 저장소의 `skills/` 등에서 스킬을 찾고, `add`의 `--skill`(`'*'`는 전부), `-a`·`--agent`, `-g`·`--global`, `-y`·`--yes`, `--list`로 설치 대상을 고른다. 프로젝트 설치 위치는 Claude Code `.claude/skills/`, Codex와 Antigravity `.agents/skills/`다. 익명 사용 통계를 모으며 `DISABLE_TELEMETRY=1`이나 `DO_NOT_TRACK=1`로 끈다. [vercel-labs/skills](https://github.com/vercel-labs/skills) (확인일: 2026-09-15)

  > "This CLI collects anonymous usage data to help improve the tool. No personal information is collected."
  >
  > 번역: 이 CLI는 도구를 개선하려고 익명 사용 데이터를 수집합니다. 개인 정보는 수집하지 않습니다.

- **직접 실험(CLI 도움말, 2026-09-15):** probe가 쓰는 옵션이 설치된 CLI에 있는지 확인했다. `codex exec --help`(codex-cli 0.154.0)에는 `-s`·`--sandbox`, `-C`·`--cd`, `--skip-git-repo-check`, `--ephemeral`이, `claude --help`(Claude Code 2.1.272)에는 `-p`·`--print`, `--tools`, `--no-session-persistence`가, `agy --help`(1.2.2)에는 `-p`·`--print`, `--add-dir`, `--print-timeout`(기본 5m0s)이 있다.
- **직접 실험(세션 기록 구조, 2026-09-15):** 이 컴퓨터에서 가장 최근 기록 20개씩의 필드 구조만 셌다. 대화 내용은 출력하지 않았다.
  - Codex `~/.codex/sessions/**/rollout-*.jsonl`: 20개 모두 `session_meta.payload.cwd`가 있고, 19개에 `world_state.payload.state.agents_md.text`와 `# AGENTS.md instructions`를 담은 `response_item` 메시지가 있다.
  - Claude Code `~/.claude/projects/*/*.jsonl`: 20개 모두 `attachment.type`이 `instructions`이고 `attachment.files[].path`가 있는 기록을 가지며, 7개는 이 기록이 두 번 이상 나온다. 6개에 `nested_memory` 기록의 `attachment.path`가 있다.
- **직접 확인(skills CLI 코드, 2026-09-16):** 설치된 skills@1.5.26의 `dist/cli.mjs`에서 `isEnabled()`는 `DISABLE_TELEMETRY`와 `DO_NOT_TRACK`이 모두 없을 때만 참을 돌려주고, 사용 통계를 보내는 `track()`과 감사 데이터를 받는 `fetchAuditData()`는 이 값이 거짓이면 바로 끝난다. 네트워크 요청을 직접 관찰하지는 않았다.
- **직접 실험(skills CLI 설치, 2026-09-15):** `node tools/skills-smoke.ts`가 임시 프로젝트에서 `npx -y skills@1.5.26 add <사본> --list`와 `add <사본> --skill '*' -a claude-code -a codex -a antigravity -y`를 `DISABLE_TELEMETRY=1`, `DO_NOT_TRACK=1`로 실행했다. 두 스킬이 `.agents/skills/`와 `.claude/skills/`에 설치됐고, `agctx-author`에는 `disable-model-invocation: true`와 `agents/openai.yaml`이 함께 들어갔다.
- **직접 실험(verify --probe, 2026-09-15~16):** 빈 Git 저장소에 `team-backend` 프로필을 적용하고 `services/payments/AGENTS.md`, `trigger: glob` 규칙 `.agents/rules/payments.md`, `.cursorrules`를 더한 뒤 `agctx verify services/payments --probe --yes`를 실행했다(codex-cli 0.154.0, Claude Code 2.1.272, agy 1.2.2). 세 에이전트를 차례로 실행하는 데 약 48초가 걸렸다.
  - Codex는 루트 `AGENTS.md`와 `services/payments/AGENTS.md`의 표지 줄을 모두 되풀이했다.
  - Claude Code는 루트 `CLAUDE.md`의 표지 줄만 되풀이하고, 그 파일이 `@AGENTS.md`로 가져오는 루트 `AGENTS.md`의 표지 줄은 되풀이하지 않았다. 새로 만든 사본이라 외부 가져오기를 승인한 적이 없고 루트 `AGENTS.md`가 시작 폴더 밖에 있으므로, 위 공식 문서의 외부 가져오기 규칙과 맞는 결과다. 이 결과에 따라 `explain`이 이 파일을 `conditional`로 판정하게 바꿨다.
  - Antigravity는 루트 `AGENTS.md`와 `trigger: always_on`인 `.agents/rules/agctx.md`의 표지 줄을 되풀이했고, `trigger: glob` 규칙과 `services/payments/AGENTS.md`의 표지 줄은 되풀이하지 않았다. 같은 사본에 루트 `GEMINI.md`와 `trigger: model_decision` 규칙을 더해 `--agent antigravity`로 다시 실행하자 `GEMINI.md`의 표지 줄은 되풀이했고 `model_decision` 규칙의 표지 줄은 되풀이하지 않았다.
  - 판정은 에이전트가 출력한 표지 줄로만 한다. Codex는 `--sandbox read-only`, Claude Code는 `--tools ""`로 도구를 막았지만 Antigravity CLI에는 같은 옵션이 없어 프롬프트의 지시에만 기댄다.

## APM과 함께 쓰기 근거

agctx가 Microsoft APM(Agent Package Manager)과 한 저장소에서 부딪히지 않게 하는 판정([ADR 0020](adr/0020-apm-coexistence-and-monorepo-links.md))이 기대는 사실이다.

- **직접 확인(APM 코드, 2026-09-16):** 가상환경에 설치한 apm-cli 0.30.0의 소스에서 확인했다.
  - `compilation/constants.py`는 `AGENTS.md` 생성 표시로 `<!-- Generated by APM CLI from .apm/ primitives -->`와 `<!-- Generated by APM CLI from distributed .apm/ primitives -->`를 정의한다. `has_generated_marker_header`는 파일의 처음 다섯 줄 가운데 한 줄이 표시와 정확히 같으면 APM이 만든 파일로 본다.
  - `compilation/claude_formatter.py`의 `CLAUDE_HEADER`는 `<!-- Generated by APM CLI -->`이고, `compilation/agents_compiler.py`는 `CLAUDE.md`에도 같은 판정을 쓴다.
  - `compilation/managed_section.py`는 `agents_md.mode: managed_section`일 때 `<!-- apm:start -->`와 `<!-- apm:end -->` 사이만 바꾸고 표지 밖은 그대로 둔다. 표지가 없거나 두 번 이상 나오면 오류로 멈춘다.
- **이전 실험(2026-09-15):** 이름을 바꾸기 전의 Agentic과 APM 0.30.0을 한 저장소에서 실행했다(`scratchpad/coexist.sh`). APM 기본 모드가 먼저 만든 `AGENTS.md`에 Agentic을 적용하자 생성 표시가 다섯째 줄 밖으로 밀렸고, 다음 `apm compile`은 파일을 갱신하지 않고 경고만 냈다.

  > "Protected AGENTS.md: hand-authored file will not be overwritten."
  >
  > 번역: 보호된 AGENTS.md: 사람이 쓴 파일이므로 덮어쓰지 않습니다.

- **직접 실험(agctx와 APM, 2026-09-16):** `scratchpad/m4-drafts/apm-e2e.sh`로 가짜 HOME에서 이 브랜치의 agctx와 apm 0.30.0을 함께 실행했다. APM 패키지는 `applyTo: "**"` 지침 파일 하나, 대상은 `codex`·`claude`다.
  - agctx를 먼저 적용하고 `AGENTS.md` 끝에 APM 표지를 둔 뒤 `managed_section`으로 `apm install`·`apm compile`을 실행했다. 프로필과 APM 패키지를 번갈아 고쳐 `agctx profile sync`와 `apm compile`을 반복해도 두 도구의 규칙이 모두 남았다. 이어서 실행한 `agctx profile sync --dry-run`은 바꿀 파일이 없었고, `apm audit --ci`와 `agctx check`는 0으로 끝났다. APM은 같은 규칙을 `.claude/rules/team.md`에도 넣었다.
  - APM 기본 모드가 먼저 `AGENTS.md`(둘째 줄에 생성 표시)와 `.claude/rules/team.md`를 만든 저장소에서 `agctx profile apply --yes`는 파일을 쓰지 않고 2로 멈췄다. 안내대로 `apm.yml`에 `managed_section`을 넣고 `AGENTS.md`를 옮긴 뒤 다시 적용하고, 표지를 넣어 `apm compile`을 실행하자 두 도구의 규칙이 모두 들어갔고 `agctx check`가 0으로 끝났다.


## 모노레포 연결 파일 근거

하위 `AGENTS.md`마다 Claude Code 연결 파일을 만드는 결정([ADR 0020](adr/0020-apm-coexistence-and-monorepo-links.md))이 기대는 조사다. Claude Code가 `AGENTS.md`를 직접 읽지 않는다는 공식 문서 내용은 [에이전트 규칙 파일 로드 근거](#에이전트-규칙-파일-로드-근거)에 있다.

- **직접 실험(공개 모노레포 조사, 2026-09-16):** `scratchpad/m4-drafts/monorepo-links-survey.sh`가 `gh api repos/<저장소>/git/trees/HEAD?recursive=1`로 널리 알려진 공개 모노레포 24곳의 기본 브랜치 파일 목록을 받아 셌다. 21곳이 루트 `AGENTS.md`를 두었고, 15곳에 하위 폴더 `AGENTS.md`가 151개 있었다. 그 가운데 77개(13곳)는 같은 폴더에 `CLAUDE.md`도 `.claude/CLAUDE.md`도 없었다. PostHog/posthog와 elastic/kibana는 API가 파일 목록을 잘라 보냈으므로(`truncated`) 두 곳의 수는 일부만 센 값이다.

## 공개 npm·GitHub 저장소 운영 근거

- npm은 배포 패키지의 `files` 필드로 포함 파일을 제한할 수 있고, `npm pack --dry-run`으로 실제 포함 목록을 확인할 수 있다고 설명한다. README·LICENSE·package.json은 npm의 기본 포함 규칙이 있으므로, 배포물에 필요한 안내와 실행 파일을 별도로 점검한다. [npm `package.json` 문서](https://docs.npmjs.com/files/package.json), [npm publish 문서](https://docs.npmjs.com/cli/commands/npm-publish/) (확인일: 2026-09-14)
- npm trusted publishing은 장기 토큰 대신 CI의 OIDC를 사용하고 provenance attestation을 생성한다. GitHub Actions에서 사용하려면 저장소·workflow·`repository.url`을 정확히 연결하고 publish job에 `id-token: write` 권한을 부여해야 한다. [npm Trusted publishing](https://docs.npmjs.com/trusted-publishers), [GitHub Node.js package publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages) (확인일: 2026-09-14)
- npm은 신뢰된 게시를 npmjs.com의 패키지 설정에서 연결한다고 설명한다. 명령줄의 `npm trust github`로 연결하려면 npm 11.15.0 이상, 레지스트리에 이미 있는 패키지, 계정의 2단계 인증이 필요하다. 연결한 뒤에는 Publishing access에서 "Require two-factor authentication and disallow tokens"를 골라 토큰 게시를 막으라고 권한다. 새 패키지의 첫 버전을 OIDC로 게시하게 해 달라는 npm/cli 이슈(2025-09-01 등록)는 확인 시점에 열려 있으며, 이슈 본문은 첫 버전을 수동으로 게시하거나 토큰으로 게시해야 한다고 적는다. [npm Trusted publishing](https://docs.npmjs.com/trusted-publishers), [npm trust 문서](https://docs.npmjs.com/cli/v11/commands/npm-trust/), [npm/cli#8544](https://github.com/npm/cli/issues/8544) (확인일: 2026-09-16)
- npm은 trusted publisher마다 허용 동작을 고르게 한다. `npm stage publish`는 항상 허용되고 `npm publish`로 바로 게시하는 것은 따로 허용해야 하며, 2026-09-03 이후 만든 설정은 기본으로 `npm stage publish`만 허용한다. 스테이징한 버전은 공개되지 않고, `npm stage approve`가 2단계 인증을 받아 공개한다. 직접 실험: 기본 설정 그대로 이 저장소의 `publish.yml`이 v0.3.1에서 `npm publish --provenance --access public`을 실행하자 provenance 서명은 투명성 로그에 기록됐지만 레지스트리 PUT이 `403 Forbidden - PUT https://registry.npmjs.org/agent-context-manager - OIDC permission denied for this action`으로 거부됐다(GitHub Actions 실행 35011746381). [npm Trusted publishing](https://docs.npmjs.com/trusted-publishers/), [npm stage 문서](https://docs.npmjs.com/cli/v11/commands/npm-stage/) (확인일: 2026-09-16)
- npm 신뢰된 게시는 npm CLI 11.5.1 이상과 Node.js 22.14.0 이상을 요구한다. 게시 workflow가 쓰는 Node.js 24.x의 최신판 v24.21.0(2026-09-07 배포)은 npm 11.19.0을 포함한다. [npm Trusted publishing](https://docs.npmjs.com/trusted-publishers), [Node.js 배포 목록](https://nodejs.org/dist/index.json) (확인일: 2026-09-16)
- GitHub는 공개 저장소의 community profile에서 README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT 같은 커뮤니티 건강 파일을 점검한다. 기여 안내는 저장소 루트·`docs`·`.github`에 둘 수 있으며, 공개 저장소 운영자는 이를 통해 기여 기대치를 명확히 할 수 있다. [GitHub community profile](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories), [GitHub contributing guidelines](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors) (확인일: 2026-09-14)
- GitHub는 공개 저장소에서 Dependabot alerts, secret scanning, push protection, code scanning을 최소 보안 기준으로 권장하고, Dependency Review는 PR에 새 취약 의존성이 들어오는 것을 확인하는 게이트로 사용할 수 있다고 설명한다. [GitHub security settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository), [GitHub dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review) (확인일: 2026-09-14)
- GitHub의 "Rebase and merge"는 PR의 커밋을 base 브랜치에 하나씩 올리면서 "Always updates the committer information and creates new commit SHAs"(번역: 항상 커미터 정보를 갱신하고 새 커밋 SHA를 만든다)라고 설명한다. 커밋을 새로 만들므로 원래 커밋의 서명은 남지 않는다. 반면 GitHub은 자기가 만든 커밋에 자기 키로 서명한다. "GitHub will automatically use GPG to sign commits you make using the web interface. Commits signed by GitHub will have a verified status."(번역: GitHub은 웹 인터페이스로 만든 커밋을 GPG로 자동 서명하며, GitHub이 서명한 커밋은 verified 상태가 된다.) 직접 실험: 이 저장소에서 `gh pr merge 8 --squash --admin`으로 병합한 `016ae6e`는 committer가 `GitHub`이고 `verified: true`, rebase로 병합한 `c3d3254`는 `verified: false (unsigned)`, PR 없이 직접 push한 `ac55da9`는 SSH 서명으로 `verified: true`였다. [About pull request merges](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges), [About commit signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification) (확인일: 2026-09-16)
- 브랜치 보호의 서명 필수 설정은 head 브랜치에 서명 없는 커밋이 있으면 squash 병합까지 막을 수 있다. "unsigned commits on the head branch can block a squash merge, even though GitHub would sign the final squash commit."(번역: head 브랜치에 서명되지 않은 커밋이 있으면, GitHub이 최종 squash 커밋에 서명할 것이더라도 squash 병합이 막힐 수 있다.) 또한 code owner 승인을 요구하면 "any pull request that affects code with a code owner must be approved by that code owner before the pull request can be merged into the protected branch."(번역: 코드 오너가 지정된 코드를 건드리는 모든 PR은 병합 전에 그 코드 오너의 승인을 받아야 한다.) [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) (확인일: 2026-09-16)
- Node.js의 내장 `node:test`는 지원되는 LTS 런타임에서 안정적인 테스트 러너로 제공된다. agctx는 Node.js 22 이상을 지원 기준으로 삼고, 저장소 평가는 별도 테스트 프레임워크 없이 이 러너로 실행한다. Node.js 릴리스 페이지는 v26을 Current, v24와 v22를 LTS, v20을 EOL로 표시한다. [Node.js test runner](https://nodejs.org/api/test.html), [Node.js 릴리스 일정](https://nodejs.org/en/about/previous-releases) (확인일: 2026-09-15)

## TypeScript 실행과 배포 근거

- Node.js는 v22.18.0·v23.6.0부터 TypeScript 파일의 타입 제거(type stripping)를 기본으로 켰고, v24.12.0·v25.2.0부터 이 기능을 안정(Stable)으로 표시한다. 인라인 타입을 공백으로 바꿔 실행하므로 JavaScript 코드 생성이 필요한 문법은 지원하지 않는다. `.ts` 파일의 모듈 방식은 `.js` 파일과 같은 규칙으로 정해지고, `import`에는 파일 확장자(`./file.ts`)를 붙여야 한다. 권장 `tsconfig`로 `erasableSyntaxOnly`, `verbatimModuleSyntax`, `rewriteRelativeImportExtensions`, `noEmit`을 제시한다. [Node.js TypeScript 문서](https://nodejs.org/api/typescript.html) (확인일: 2026-09-15)
- 같은 문서는 `node_modules` 아래의 TypeScript 파일을 처리하지 않는다고 밝힌다. 그래서 npm으로 배포하는 코드는 JavaScript로 컴파일해야 한다.

  > "To discourage package authors from publishing packages written in TypeScript, Node.js refuses to handle TypeScript files inside folders under a `node_modules` path."
  >
  > 번역: 패키지 작성자가 TypeScript로 작성된 패키지를 게시하지 않도록, Node.js는 `node_modules` 경로 아래 폴더에 있는 TypeScript 파일을 처리하지 않습니다.

- TypeScript 컴파일러 옵션 `rewriteRelativeImportExtensions`(5.7부터)는 출력 파일에서 상대 import 경로의 `.ts` 확장자를 JavaScript 확장자로 바꾼다. `allowImportingTsExtensions`(5.0부터)는 `.ts` 확장자로 서로 import하게 허용하며 `noEmit`이나 `emitDeclarationOnly`일 때만 쓸 수 있다. [TypeScript tsconfig 참조](https://www.typescriptlang.org/tsconfig/) (확인일: 2026-09-15)
- 직접 실험(2026-09-15): `package.json`에 `{"type":"module"}`만 둔 임시 폴더에 `main.ts`(`const n: number = 1; console.log("ran", n);`)를 만들고 실행했다.
  - `node main.ts`(Node.js v24.21.0)와 `npx -p node@22.18.0 node main.ts`는 `ran 1`을 출력했다.
  - `npx -p node@22.17.1 node main.ts`는 `ERR_UNKNOWN_FILE_EXTENSION`으로 실패했다.
  - `node_modules/dep/index.ts`를 `exports`로 가리키는 패키지를 import한 `use-dep.ts`는 Node.js v24.21.0에서 `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`으로 실패했다.
  - TypeScript 7.0.2의 `tsc -p tsconfig.build.json`으로 만든 `dist/agentic.js`(이름을 바꾸기 전 진입점)는 첫 줄 `#!/usr/bin/env node`를 유지했고, 소스의 `import { run } from './commands/cli.ts'`를 `./commands/cli.js`로 바꿨다.

## CLI 계약과 지침 공급망 근거

agctx 명령의 종료 코드·출력·확인 계약([ADR 0016](adr/0016-command-contract.md)), Git 프로필 공유의 숨은 문자 검사([ADR 0017](adr/0017-git-profile-sharing.md)), 여러 저장소의 PR 작업([ADR 0018](adr/0018-multi-repository-sync.md))이 기대는 외부 사실이다.

- **공식 문서:** BSD `sysexits`는 명령이 실패의 성격을 미리 정한 종료 코드로 알리는 관례다. `EX_USAGE`(64)는 인자 개수·플래그·매개변수 문법이 틀린 경우, `EX_UNAVAILABLE`(69)은 서비스를 쓸 수 없거나 보조 프로그램·파일이 없는 경우, `EX_SOFTWARE`(70)는 내부 소프트웨어 오류를 뜻한다. 같은 페이지는 이 인터페이스를 호환성 때문에만 유지하며 사용을 권하지 않는다고 적는다. 그래서 agctx는 헤더를 쓰지 않고 번호의 뜻만 빌린다. [FreeBSD sysexits(3)](https://man.freebsd.org/cgi/man.cgi?query=sysexits&sektion=3) (확인일: 2026-09-15)
- **비공식 자료:** Command Line Interface Guidelines는 성공하면 0, 실패하면 0이 아닌 종료 코드를 돌려주고, 주 출력은 stdout으로, 안내 메시지는 stderr로 보내며, `--json`을 받으면 JSON으로 출력하라고 권한다. 프롬프트는 stdin이 대화형 터미널일 때만 쓰라고 하고, 위험한 작업은 대화형이면 확인을 받고 아니면 `-f`·`--force` 같은 플래그를 요구하는 관례를 소개한다. 사용자가 잘못 입력했고 의도를 짐작할 수 있으면 제안하라고도 권한다. [Command Line Interface Guidelines](https://clig.dev/) (확인일: 2026-09-15)
- **공식 문서:** Git은 불리언 환경 변수 `GIT_TERMINAL_PROMPT`를 false로 두면 HTTP 인증 같은 경우에도 터미널에서 묻지 않는다. [git(1) 환경 변수](https://git-scm.com/docs/git) (확인일: 2026-09-15)
- **공식 문서:** 유니코드 양방향 알고리즘(UAX #9, Unicode 17.0.0 Revision 51)은 명시적 방향 서식 문자로 U+202A–U+202E(LRE·RLE·PDF·LRO·RLO)와 U+2066–U+2069(LRI·RLI·FSI·PDI)를 정의한다. [UAX #9](https://www.unicode.org/reports/tr9/) (확인일: 2026-09-15)
- **연구:** Trojan Source는 유니코드 제어 문자로 소스 코드 토큰을 인코딩 수준에서 재배열하면 사람이 보는 순서와 컴파일러가 따르는 논리 순서가 달라진다고 보고한다. 양방향 제어 문자 공격은 CVE-2021-42574, 비슷하게 생긴 문자(homoglyph)를 쓰는 변형은 CVE-2021-42694로 추적된다. [Trojan Source](https://trojansource.codes/) (확인일: 2026-09-15)
- **비공식 자료(벤더 블로그):** AWS 보안 블로그(2025-09-30)는 U+E0000–U+E007F 태그 문자가 사람에게는 보이지 않지만 언어 모델은 처리하므로, 사람이 보기에 무해한 입력에 숨은 지시를 넣는 프롬프트 주입 경로가 될 수 있다고 설명한다. [Defending LLM applications against Unicode character smuggling](https://aws.amazon.com/blogs/security/defending-llm-applications-against-unicode-character-smuggling/) (확인일: 2026-09-15)
- **공식 문서:** GitHub CLI의 `gh pr create`는 `--base`(병합될 브랜치), `--head`(PR의 커밋이 있는 브랜치, 기본은 현재 브랜치), `--title`, `--body-file`(본문을 파일에서 읽음), `--draft`를 받는다. `gh pr list`는 `--head`로 head 브랜치를 거르되 `<owner>:<branch>` 형식은 지원하지 않고, `--state`의 기본값은 `open`이며, `--json`으로 `url` 같은 필드를 출력한다. [gh pr create](https://cli.github.com/manual/gh_pr_create), [gh pr list](https://cli.github.com/manual/gh_pr_list) (확인일: 2026-09-15)
- **공식 문서:** `GH_PROMPT_DISABLED`에 아무 값이나 넣으면 gh가 터미널에서 대화형으로 묻지 않는다. `GH_TOKEN`·`GITHUB_TOKEN`은 github.com 등을 대상으로 할 때 쓰는 인증 토큰이며 저장된 인증보다 우선한다. [gh 환경 변수](https://cli.github.com/manual/gh_help_environment) (확인일: 2026-09-15)
- **공식 문서:** `gh auth setup-git`은 git이 GitHub CLI를 credential helper로 쓰도록 설정한다. 기본으로 인증된 모든 호스트에 대해 설정하며 인증된 호스트가 없으면 실패한다. [gh auth setup-git](https://cli.github.com/manual/gh_auth_setup-git) (확인일: 2026-09-15)
- **공식 문서:** `git worktree add <path> [<commit-ish>]`는 현재 저장소에 연결된 작업 트리를 만들며, `HEAD`·`index` 같은 작업 트리별 파일을 뺀 나머지를 공유한다. `--detach`는 새 작업 트리의 `HEAD`를 분리한다. `git worktree remove`는 깨끗한 작업 트리만 지우고 `--force`를 주면 수정이 남은 작업 트리도 지운다. `git worktree prune`은 작업 트리가 사라진 기록을 정리한다. [git-worktree](https://git-scm.com/docs/git-worktree) (확인일: 2026-09-15)
- **확인하지 못한 것:** agctx는 폭 없는 문자(U+200B–U+200D, U+2060, 파일 맨 앞이 아닌 U+FEFF)와 변형 선택자 보충(U+E0100–U+E01EF)도 검사한다. 보이지 않는 문자가 사람의 검토를 우회한다는 위 자료와 같은 이유로 넣은 판단이며, 이 두 범위를 직접 다룬 공식 자료는 찾지 못했다.

## 비교 대상

비교의 기준은 “에이전트가 무엇을 잘하게 하는가”와 “여러 프로젝트·에이전트에 공통 지침을 어떻게 배포하고 관리하는가”를 분리하는 것이다. agctx는 후자에 초점을 둔다. 따라서 아래 도구들은 일부 기능이 겹쳐도 목적과 책임 범위가 다르며, 함께 사용할 수 있다.

| 도구 | 목적 | 중심 역할 | 주 활용 영역 | agctx와의 차이 | agctx와 함께 쓰는 판단 |
| --- | --- | --- | --- | --- | --- |
| **agctx** | 여러 AI 에이전트가 동일한 프로젝트 개발 지침을 사용하도록 지원 | Personal·Company·Team·Workspace 단위의 프로필을 생성·설정하고, 공통 지침을 프로젝트와 여러 에이전트에 적용·동기화 | 여러 개발자·프로젝트·에이전트에 걸친 공통 개발 지침 관리 | 이 표의 비교 기준이다. 특정 에이전트의 스킬·런타임·팀 오케스트레이션을 제공하기보다, 지침의 정본·범위·선택·적용을 관리한다. | 단독으로 공통 지침의 생성·설정·적용을 맡는다. 필요한 경우 아래 도구를 역할별로 추가한다. |
| [Ruler](https://github.com/intellectronica/ruler) | 여러 코딩 에이전트에 규칙을 배포 | 중앙 규칙을 도구별 파일로 변환·동기화하고 적용 상태를 관리 | 단일 저장소의 다중 에이전트 규칙 배포 | agctx의 가장 가까운 비교 대상이다. agctx는 여기에 Personal·Company·Team·Workspace 단위의 프로필 생성·선택과 `profile setup` 기반 지침 구성을 제품의 중심으로 둔다. | 같은 대상 파일을 두 도구가 동시에 생성하면 충돌·drift가 생길 수 있다. 동일 프로젝트의 동기화 정본은 하나만 선택하고, 함께 쓸 때는 출력 경계를 분리한 뒤 검증해야 한다. (확인일: 2026-09-14) |
| [agents-sync](https://www.npmjs.com/package/%40googlarz/agents-sync) | `AGENTS.md` 중심의 규칙 동기화와 drift 확인 | 정본과 대상 파일을 동기화하고 불일치를 검사 | 여러 에이전트 파일의 일관성 유지 | agctx는 단순 파일 동기화 도구가 아니라 프로필의 수명주기, 선택적 지침 설정, 프로젝트 적용까지 포함하는 것을 목표로 한다. | Ruler와 마찬가지로 agctx의 동기화와 중복 적용하지 않는다. agctx를 프로필·적용 관리에 쓰고 agents-sync를 별도 drift CI로 쓰려면 어느 도구가 파일을 소유하는지 먼저 고정해야 한다. (확인일: 2026-09-14) |
| [agents-lint](https://github.com/giacomo/agents-lint) | 에이전트 지침 파일의 오래된 참조와 컨텍스트 부패 발견 | 지침 파일이 참조하는 경로·npm 스크립트·의존성이 저장소에 있는지, 프레임워크의 낡은 패턴을 언급하는지를 검사하고 권장 섹션 구조와 여러 지침 파일 간 충돌을 점검 | `AGENTS.md`·`CLAUDE.md`·Claude 메모리 파일의 최신성 관리 | agents-lint가 지침의 오래된 참조와 파일 간 충돌을 진단한다면, agctx는 사용자가 선택한 공통 지침을 만들고 여러 에이전트에 전달하는 관리 계층이다. | agctx가 생성·적용한 지침을 최신성 관점에서 별도로 lint하는 보완 조합이 적합하다. 공식적인 agctx 통합은 확인하지 않았으므로 CI 명령을 사용자가 직접 연결해야 한다. (확인일: 2026-09-14) |
| [Harness Doctor](https://www.npmjs.com/package/%40andypai/harness-doctor) | 에이전트 하네스의 구성 상태 점검 | 하네스 파일·문서·설정의 문제를 찾아 진단 | 하네스 유지보수와 문제 해결 | Harness Doctor는 진단 도구이고, agctx는 공통 지침을 생성·설정·적용하는 패키지다. agctx가 자체 진단을 제공하더라도 하네스 런타임을 소유하거나 감싸는 것을 목표로 하지 않는다. | 적용 후 대상 프로젝트의 하네스 상태를 독립적으로 점검하는 용도로 함께 사용할 수 있다. 다만 두 도구의 진단 결과를 하나의 성공 판정으로 간주하지 말고 각각의 검사 범위를 보고해야 한다. (확인일: 2026-09-14) |
| [Everything Claude Code (ECC)](https://github.com/affaan-m/ECC) | 에이전트의 개발 능력과 작업 방법을 확장 | 전문 에이전트, 스킬, 명령, 훅, 규칙, 메모리·보안 도구와 워크플로를 제공하며 여러 하네스에 어댑터를 제공 | Claude Code 중심의 에이전트 작업 자동화·전문화, Codex 등 인접 하네스 지원 | ECC는 에이전트가 계획·구현·리뷰·보안·도메인 작업을 수행하도록 기능과 방법론을 제공한다. agctx는 ECC 같은 도구를 실행·통제하지 않고, 조직·팀·프로젝트가 선택한 공통 개발 지침을 프로필에서 관리해 여러 에이전트와 프로젝트에 적용하는 데 집중한다. | ECC는 선택한 에이전트의 능력·워크플로를 제공하고 agctx는 조직·프로젝트 공통 지침을 관리하는 식으로 역할을 나눌 수 있다. ECC 지침을 프로필에 자동 수입하는 공식 계약은 확인하지 않았으므로, 채택할 내용은 검토 후 별도로 복사·정리해야 한다. (확인일: 2026-09-14) |
| [GitHub Spec Kit](https://github.com/github/spec-kit) | 명세 중심 개발을 돕기 | 요구사항·설계·구현으로 이어지는 spec-driven 개발 템플릿과 흐름 제공 | 신규 기능의 명세화와 계획 수립 | Spec Kit은 기능 개발 방법론과 산출물에 초점을 둔다. agctx는 특정 명세 방법론을 강제하지 않고, 프로젝트가 선택한 공통 지침을 에이전트별 파일로 적용하는 기반을 제공한다. | Spec Kit의 명세·계획 산출물을 프로젝트 도메인 작업에 사용하고, agctx로 그 프로젝트의 공통 지침을 여러 에이전트에 적용하는 조합이 자연스럽다. 이는 역할 분리에 따른 활용 방식이며 공식 agctx 플러그인 통합을 뜻하지 않는다. (확인일: 2026-09-14) |
| [obra/superpowers](https://github.com/obra/superpowers) | 에이전트의 개발 작업 품질과 습관 개선 | 스킬과 개발 방법론을 조합해 계획·구현·검토 흐름을 안내 | 에이전트 주도 개발 프로세스와 재사용 스킬 | superpowers는 에이전트가 작업하는 방법을 제공하고, agctx는 그런 방법론을 프로필에 선택적으로 포함·관리하고 여러 에이전트에 전달하는 역할을 맡는다. | Superpowers를 특정 에이전트의 작업 방법으로 사용하고, agctx에는 팀·프로젝트가 실제로 채택한 공통 규칙만 관리한다. 양쪽의 자동 동기화나 공식 연동은 확인하지 않았으므로 동일 규칙을 양쪽에 중복 관리하지 않는다. (확인일: 2026-09-14) |
| [revfactory/harness](https://github.com/revfactory/harness) | Claude Code에서 에이전트 팀 패턴을 쉽게 구성 | 도메인 설명과 코드베이스 탐색 결과로 팀 아키텍처를 고르고 `.claude/agents/` 에이전트 정의와 `.claude/skills/` 스킬을 생성한다. 코드베이스 탐색은 팀·스킬 설계의 재료로만 쓰며, `CLAUDE.md`에는 트리거 포인터와 변경 이력만 기록하고 디렉터리 구조 같은 프로젝트 설명은 넣지 않는다. | 복잡하거나 병렬화 가능한 작업의 역할 분담·오케스트레이션 | 두 도구의 "멀티 에이전트"는 뜻이 다르다. harness는 Claude Code 한 도구 안에서 협업하는 에이전트 팀을 설계한다. agctx는 Claude Code·Codex·Cursor 같은 여러 에이전트 도구에 같은 공통 지침을 배포한다. 위아래 계층이 아니라 서로 다른 축이며, harness는 프로젝트 지침을 작성하는 도구도 아니다. | agctx가 공통 작업·안전·문서 지침을 제공하고 복잡한 작업에서만 harness가 Claude Code 팀 구성을 담당하는 조합이 가능하다. harness는 Claude Code 전용 커뮤니티 플러그인이며 agctx가 이를 다른 에이전트에서 실행해 주지 않는다. 두 도구 모두 `CLAUDE.md`를 수정하므로 harness 포인터는 agctx 관리 블록 밖에 있어야 한다. (확인일: 2026-09-14) |

### 함께 사용하기 전 확인할 규칙

위의 “함께 쓰는 판단”은 공식 통합을 의미하지 않는다. 각 도구의 공식 설명에서 확인되는 책임 범위를 기준으로 한 조합 가이드이며, agctx와의 직접 연동·자동 변환·호환성을 주장하지 않는다. 실제로 함께 도입할 때는 다음을 먼저 확정한다.

1. **정본 소유자:** 같은 `AGENTS.md`, `CLAUDE.md` 또는 기타 에이전트 파일을 둘 이상의 생성기가 수정하지 않도록 정본과 생성기를 하나만 정한다.
2. **실행 책임:** ECC·Superpowers·revfactory/harness처럼 에이전트의 작업 방식이나 팀 실행을 바꾸는 도구와, agctx처럼 공통 지침을 배포하는 도구의 책임을 분리한다.
3. **검증 책임:** lint·doctor·프로젝트 테스트는 각각 검사 대상과 실패 의미가 다르므로 한 도구의 통과를 다른 도구의 품질 보증으로 해석하지 않는다.
4. **도입 순서:** 먼저 agctx로 공통 지침의 범위와 적용 파일을 확정하고, 그 다음 필요한 프로젝트에 방법론·스킬·팀 실행·진단 도구를 선택적으로 추가한다.

### agctx를 선택할 상황

다음 요구가 있으면 agctx의 책임 범위와 직접 맞는다.

1. Claude Code, Codex, Antigravity 등 여러 에이전트를 같은 프로젝트에서 사용하고, 도구가 바뀌어도 공통 개발 지침을 유지해야 한다.
2. 개인·회사·팀·workspace처럼 서로 다른 범위의 공통 지침을 여러 개 만들고, 프로젝트별로 적용할 프로필을 선택해야 한다.
3. 공통 지침과 프로젝트 도메인 지침을 분리하고, 공통 지침은 한 곳에서 관리하면서 프로젝트에는 필요한 형태로 적용해야 한다.
4. TDD, 변경 검토, 검증, 문서화, 보안 등 지침을 한 번에 고정하지 않고 프로필 생성 후 선택적으로 구성해야 한다.
5. 특정 에이전트의 CLI·런타임에 종속되는 실행기를 직접 유지하지 않고, 각 에이전트가 읽는 지침 파일과 프로젝트의 표준 명령을 활용하고 싶다.

다음 목적만 있다면 agctx를 추가하기보다 해당 도구가 더 직접적이다.

- Claude Code 안에서 전문 에이전트·스킬·훅·작업 자동화를 바로 확장하려면 ECC 또는 revfactory/harness
- 여러 에이전트용 규칙 파일을 이미 갖고 있고 배포·drift 검사만 필요하면 Ruler 또는 agents-sync
- 지침 파일의 오래된 참조나 파일 간 충돌을 찾는 것이 목적이면 agents-lint, 저장소의 에이전트 하네스 준비 상태(문서 계약·공급망 설정·dead code)를 점검하는 것이 목적이면 Harness Doctor
- 명세 작성부터 기능 구현까지의 특정 개발 방법론이 목적이면 GitHub Spec Kit 또는 obra/superpowers

즉, agctx는 위 도구들을 대체하는 통합 실행 환경이 아니라, 선택한 규칙과 방법론을 프로필에 담아 여러 에이전트·개발자·프로젝트에 일관되게 적용하는 공통 지침 관리 계층이다.

## 해석 규칙

외부 자료가 TDD, Solo, 멀티 에이전트, 검증을 언급하더라도 agctx의 규칙으로 자동 채택하지 않는다. 제품 목표와 사용자 선택권에 부합하는지 검토한 뒤, 채택한 규칙만 프로필의 `AGENTS.md`와 템플릿에 반영한다.
