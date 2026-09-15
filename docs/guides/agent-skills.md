# 에이전트에게 agctx를 맡기기

<!-- agctx-doc-sources: skills, tools/generate-skills.ts -->
<!-- agctx-doc-sources-sha256: fc63e0b3a6856f2165b88e3412aafb6fecfa75138eb6889c49a374a18cfd6c73 -->

"이 폴더에서 규칙이 안 먹는 이유를 찾아 줘"나 "새 팀 규칙을 이 저장소에 반영해 줘"처럼 에이전트에게 말로 맡기려면 에이전트용 스킬을 설치한다. 스킬은 상황별로 쓸 명령, 쓰기 전에 승인을 받는 규칙, 종료 코드의 뜻을 에이전트에게 알려 준다.

| 스킬 | 맡는 일 | 에이전트가 스스로 쓰는가 |
| --- | --- | --- |
| `agctx` | 규칙이 적용되지 않는 원인 찾기(`explain`·`verify`), 최신 여부 확인(`check`·`repos status`), 새 프로필 버전 반영(`profile pull`·`profile sync`) | 쓴다 |
| `agctx-author` | 프로필 지침 수정과 커밋 확인, `profile push`, 저장소마다 `repos pr`·`repos sync` | 사용자가 이름으로 부를 때만 |

프로젝트 폴더에서 아래 명령을 실행하면 Claude Code용 스킬은 `.claude/skills/`에, Codex·Antigravity용 스킬은 `.agents/skills/`에 설치된다. 모든 프로젝트에서 쓰려면 `-g`를 붙인다.

```bash
DISABLE_TELEMETRY=1 npx skills add IsthisLee/agent-context-manager --skill '*' -a claude-code -a codex -a antigravity
```

- skills CLI는 익명 사용 통계를 보낸다. `DISABLE_TELEMETRY=1`이나 `DO_NOT_TRACK=1`을 두면 보내지 않는다([외부 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)).
- 두 스킬은 쓰기 명령 앞에 `--dry-run` 결과를 보여 주고, 사용자가 승인한 뒤에만 `--yes`를 붙이라고 지시한다. `verify --probe`도 실행 전에 묻게 한다.
- 스킬은 에이전트에게 주는 지시이므로 에이전트가 반드시 지킨다는 보장은 없다. 터미널이 아닌 곳에서는 `--yes` 없이 파일을 쓰지 않는 CLI 규칙이 마지막 방어선이다.
- 스킬 안의 명령 목록은 스킬을 설치한 시점의 저장소 기준이다.
