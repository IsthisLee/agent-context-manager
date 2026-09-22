# 0038. 에이전트 스킬을 CLI 패키지에 넣고 agctx install로 설치한다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-22
* **결정자:** 제품 소유자
* **근거:** [에이전트 지침 로드와 전달 확인 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)
* **관련:** [에이전트 스킬을 agctx 명령으로 설치하기](../discussion/architecture/topics/skill-install.md)의 결정을 옮긴다. [ADR 0019](0019-explain-verify-and-agent-skills.md)의 결정 3 가운데 「사용자는 skills CLI로 설치하며, npm 패키지에는 넣지 않는다」를 대체하고, 스킬 두 개의 구성과 안전 규칙은 그대로 둔다. 새 명령은 [ADR 0025](0025-every-command-in-cli-and-tui.md)의 인터페이스 동등성과 [ADR 0029](0029-agent-surface-contract.md)의 에이전트 정책을 따른다.

## 배경 (Context)

- CLI는 npm에 게시한 버전으로, 스킬은 skills CLI로 GitHub `main`에서 받는다. 스킬의 명령 목록은 명령 등록부에서 생성되므로, 두 버전이 어긋나면 에이전트가 설치된 CLI에 없는 명령을 스킬에서 보고 실행한다.
- 사용자는 `-g`와 에이전트별 `-a`를 외워야 하고, skills CLI는 환경 변수로 끄지 않으면 사용 통계를 보낸다.
- 2026-09-22 실측에서 지금 안내하는 명령은 Antigravity의 공식 전역 위치(`~/.gemini/config/skills/`, `~/.gemini/antigravity-cli/skills/`)에 설치하지 않았다.

## 검토한 대안 (Options)

| 항목 | 대안 | 판단 |
| --- | --- | --- |
| 설치 도구 | skills CLI를 계속 쓴다 | 버전 어긋남과 옵션 부담이 남는다 |
| | CLI 패키지에 스킬을 넣고 `agctx install`이 복사한다 | **채택** |
| 업데이트 | 복사하고 버전이 다르면 알린다 | **채택.** Node 버전을 바꾸거나 패키지를 지워도 스킬이 깨지지 않는다 |
| | npm 설치 폴더를 가리키는 심볼릭 링크 | 링크가 끊기면 에이전트가 경고 없이 스킬을 잃고, Windows에서는 동작이 달라진다 |
| | npm `postinstall`로 자동 등록 | 설치 스크립트를 끄는 환경에서 조용히 빠지고, 설치 중에 사용자 홈에 쓴다 |
| 대상 에이전트 | 설정 폴더가 있는 에이전트만 | **채택** |
| | 항상 세 에이전트, 또는 매번 묻기 | 쓰지 않는 폴더가 생기거나, 명령 하나로 끝나지 않는다 |

자세한 비교는 논의 문서의 [검토한 대안](../discussion/architecture/topics/skill-install.md#검토한-대안)에 있다.

## 결정 (Decision)

1. **패키지:** npm 패키지의 `files`에 `skills/`를 넣는다. 게시한 CLI와 같은 버전의 스킬이 함께 설치된다.
2. **`agctx install [--agent <claude|codex|antigravity>]... [--force] [--dry-run]`:** 패키지 안의 스킬을 각 에이전트의 사용자 전역 위치에 복사한다. 위치는 Claude Code `~/.claude/skills/`, Codex `~/.agents/skills/`, Antigravity 앱·IDE `~/.gemini/config/skills/`, Antigravity CLI `~/.gemini/antigravity-cli/skills/`다. 설정 폴더(`~/.claude`, `CODEX_HOME` 또는 `~/.codex`, `~/.gemini/config`, `~/.gemini/antigravity-cli`)가 있는 곳에만 두고, `--agent`로 고르면 폴더가 없어도 둔다. 자기 스킬 폴더만 쓰므로 확인 질문을 하지 않는다.
3. **설치 기록과 교체:** 스킬 폴더마다 CLI 버전과 파일별 해시를 적은 `.agctx-install.json`을 둔다. 기록과 같은 폴더만 교체하고, 기록이 없거나 파일이 바뀐 폴더와 심볼릭 링크는 `--force` 없이는 바꾸지 않는다.
4. **버전 알림:** 모든 명령이 설치 기록의 버전을 CLI 버전과 비교하고, 다르면 `agctx install`을 다시 실행하라고 stderr에 한 줄로 알린다. `--json`이면 `warnings`에 담고, TUI는 첫 화면에 보여 준다. 스킬을 설치하지 않았으면 알리지 않는다.
5. **`agctx uninstall [--agent ...]`:** 설치 기록이 있는 스킬 폴더만 지운다.
6. **표면:** 두 명령은 전역 명령이고 TUI 첫 화면에서도 실행한다. 에이전트가 자기 스킬 폴더를 바꾸지 않도록 에이전트 정책은 `never`다.
7. **문서:** 기본 설치 안내는 `npm install -g agent-context-manager`와 `agctx install` 두 줄이다. `npx skills add`는 안내하지 않는다.

## 결과 및 영향 (Consequences)

- 설치가 CLI 패키지 하나에서 끝나고, 스킬과 CLI의 버전이 같다. CLI를 업데이트한 뒤에는 `agctx install`을 다시 실행해야 하며, 그 전까지 모든 명령이 알린다.
- 전에 skills CLI로 설치한 사람은 설치 기록이 없으므로 처음 한 번 `agctx install --force`가 필요하다.
- 한계:
  - `CLAUDE_CONFIG_DIR`로 Claude Code의 스킬 위치가 바뀌는지는 확인하지 못해, 문서대로 `~/.claude/skills/`에 둔다.
  - 에이전트를 나중에 설치하면 `agctx install`을 다시 실행해야 한다.
  - 프로젝트 안에 스킬을 두는 설치는 다루지 않는다.
