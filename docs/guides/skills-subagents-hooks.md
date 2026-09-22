# 팀 skills·subagents·hooks 나눠 쓰기

팀이 함께 쓰는 skill, subagent, hook을 프로필에 한 번 두면, 프로필을 적용한 저장소마다 에이전트가 읽는 자리에 같은 파일이 들어간다. 사람이 저장소에 따로 둔 skill·subagent·hook과 설정은 그대로 남는다. 결정과 근거는 [ADR 0046](../adr/0046-skills-subagents-hooks-in-profiles.md)에 있다.

## 목차

- [준비 사항](#준비-사항)
- [프로필에 두기](#프로필에-두기)
- [저장소에 적용하기](#저장소에-적용하기)
- [에이전트마다 들어가는 곳](#에이전트마다-들어가는-곳)
- [hooks 받기](#hooks-받기)
- [바꾸거나 빼기](#바꾸거나-빼기)
- [멈췄을 때](#멈췄을-때)
- [알아 둘 점](#알아-둘-점)

## 준비 사항

- **agctx와 프로필:** 설치와 프로필 만들기는 [빠른 시작](../getting-started/quick-start.md)에 있다.
- **지원하는 에이전트:** skills는 Claude Code, Codex, Antigravity에 쓴다. subagents와 hooks는 Claude Code와 Codex에만 쓴다. Antigravity가 저장소의 subagents와 hooks를 읽는 것을 확인하지 못했기 때문이다([근거](../references.md#skillssubagentshooks-위치와-형식-근거)).

## 프로필에 두기

<!-- agctx-doc-sources: src/artifacts/definitions.ts, src/artifacts/profile-files.ts -->
<!-- agctx-doc-sources-sha256: 8d6c402e3f9ff814db244f4abe869fabecf1cf717f383c68a35725b526efd5a4 -->

프로필 폴더(`agctx profile view <프로필>`이 읽는 폴더, 연결한 프로필이면 그 저장소 루트)에 다음을 둔다.

```text
team-backend/
├── AGENTS.md
├── skills/
│   └── release-notes/
│       └── SKILL.md          # 같은 폴더의 scripts/ 등 다른 파일도 함께 복사된다
├── subagents/
│   └── reviewer.md
└── hooks.json
```

- **skill:** `skills/<이름>/SKILL.md`의 머리말에 폴더 이름과 같은 `name`과 한 줄 `description`을 적는다. 이름에는 소문자, 숫자, 하이픈만 쓴다. 같은 폴더의 다른 파일도 실행 권한까지 그대로 복사한다.

  ```markdown
  ---
  name: release-notes
  description: Use when writing release notes for a merged change.
  ---

  # Release notes

  Summarise the change for users, then list breaking changes.
  ```

- **subagent:** `subagents/<이름>.md`를 Claude Code 형식으로 적는다. 머리말의 `name`은 파일 이름과 같게, `description`은 한 줄로 쓴다. 머리말 뒤의 본문이 subagent의 지시다.

  ```markdown
  ---
  name: reviewer
  description: Reviews a diff for risky changes before merge.
  tools: Read, Grep
  ---

  Read the changed files and list risky spots with file and line.
  ```

- **hooks:** `hooks.json`에 hook마다 이름을 붙이고, 그 아래에 에이전트별로 이벤트와 matcher 묶음을 적는다. 에이전트마다 도구 이름(`Edit`와 `apply_patch`)과 이벤트가 달라서 따로 적는다. 받을 에이전트만 적으면 된다.

  ```json
  {
    "hooks": {
      "format-on-edit": {
        "claude": {
          "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "pnpm run format" }] }]
        },
        "codex": {
          "PostToolUse": [{ "matcher": "apply_patch", "hooks": [{ "type": "command", "command": "pnpm run format" }] }]
        }
      }
    }
  }
  ```

  처리기는 `command`가 있는 `"type": "command"`만 받는다. 이벤트는 에이전트 문서에 적힌 것만 받고, 다른 이벤트를 쓰면 적용할 때 쓸 수 있는 이벤트 목록을 보여 주며 멈춘다. 목록은 `src/artifacts/definitions.ts`의 `HOOK_EVENTS`<!--s:eb138d3b276e-->에 있다.

- 형식이 틀리면 어느 파일의 무엇이 틀렸는지 알려 주며 종료 코드 64로 멈춘다. 심볼릭 링크, 텍스트가 아닌 파일, 숨은 문자가 든 파일도 받지 않는다.
- Git 프로필이면 이 파일들도 커밋해 올린다. 고정한 저장소는 기록한 커밋의 파일을 쓴다.

넣은 것은 `agctx profile view`의 마지막 줄들에서 확인한다.

<!-- agctx-example: team-artifacts -->
```bash
$ agctx profile view team-backend
team-backend	team
…
Skills: release-notes

Subagents: reviewer

Hooks: format-on-edit
```

## 저장소에 적용하기

<!-- agctx-doc-sources: src/project/artifact-plan.ts, src/artifacts/targets.ts -->
<!-- agctx-doc-sources-sha256: 1c629d646418bfa46a37e914d4879a1613737363ffcb9a7d9df225c6e0a1fb27 -->

`profile apply`와 `profile sync`가 규칙과 함께 skills와 subagents를 쓴다. 따로 고르지 않은 저장소는 hooks를 받지 않는다. 먼저 `--dry-run`으로 무엇을 쓰는지 본다.

<!-- agctx-example: team-artifacts -->
```bash
$ agctx profile apply team-backend --dry-run
Dry-run: 16 file(s) to change.
…
  create    .claude/skills/release-notes/SKILL.md
  create    .agents/skills/release-notes/SKILL.md
  create    .claude/agents/reviewer.md
  create    .codex/agents/reviewer.toml
…
Skills from the profile: release-notes
Subagents from the profile: reviewer
Dry-run: no files were changed.
…
```

- 알아 둘 것은 표준 오류로 따로 나온다(위 예시의 마지막 `…`). 이 프로필에서는 세 줄이다.
  - `Warning: subagent reviewer: tools are not written for Codex; …`: Claude Code 머리말의 키(`tools`, `model` 등) 가운데 Codex로 옮기지 못한 것이다. Codex에는 이름, 설명, 지시만 쓴다.
  - `Note: the profile has hooks, but this repository does not take them. …`: 이 저장소가 hooks를 고르지 않았다는 뜻이다. 아래 [hooks 받기](#hooks-받기)를 본다.
  - `Note: Antigravity does not get the profile subagents and hooks yet, …`: Antigravity에는 skills만 쓴다는 뜻이다.
- 받고 싶지 않은 종류는 `--include`에서 뺀다. 예를 들어 `--include rules,mcp,subagents`는 skills를 받지 않는다. 고른 목록은 `agctx.project.json`의 `include`에 남아 다음 `sync`도 따른다. `--include all`은 기록을 지우고 hooks를 뺀 전부로 돌아간다.
- 에이전트는 `--agent`로 고른다. `--agent claude`면 `.claude/` 아래에만 쓴다.

## 에이전트마다 들어가는 곳

| 종류 | Claude Code | Codex | Antigravity |
| --- | --- | --- | --- |
| skills | `.claude/skills/<이름>/` | `.agents/skills/<이름>/` | `.agents/skills/<이름>/`(Codex와 같은 곳) |
| subagents | `.claude/agents/<이름>.md`(프로필 파일 그대로) | `.codex/agents/<이름>.toml` | 쓰지 않음 |
| hooks | `.claude/settings.json`의 `hooks` | `.codex/hooks.json` | 쓰지 않음 |

Codex의 subagent 파일은 다음처럼 바뀐다.

```toml
# Subagent from the agctx profile. Change it in the profile, not here.
name = "reviewer"
description = "Reviews a diff for risky changes before merge."
developer_instructions = """
Read the changed files and list risky spots with file and line.
"""
```

skills·subagents 파일은 agctx가 파일째 관리한다. 파일마다 해시가 `agctx.project.json`의 `managedHashes`에, 마지막으로 쓴 내용이 `.agctx/base/`에 남는다. 사람이 둔 다른 skill과 subagent는 건드리지 않는다.

## hooks 받기

hooks는 이 저장소에서 에이전트를 쓰는 모든 사람의 컴퓨터에서 실행될 명령이다. 그래서 저장소가 `--include`에 `hooks`를 적어야만 받고, 쓰기 전에 에이전트, 이벤트, matcher, 명령을 한 줄씩 보여 준다. 터미널이 아니면 `--yes` 없이 쓰지 않는다.

<!-- agctx-example: team-artifacts -->
```bash
$ agctx profile apply team-backend --include rules,mcp,skills,subagents,hooks --adopt --dry-run
…
  update    .claude/settings.json
  create    .codex/hooks.json
…
Hooks from the profile run these commands on the computer of everyone who uses this repository with the agent:
  format-on-edit: Claude Code PostToolUse Edit|Write: pnpm run format
  format-on-edit: Codex PostToolUse apply_patch: pnpm run format
Codex runs a new or changed project hook only after each person trusts the project and approves the hook in /hooks.
Dry-run: no files were changed.
…
```

- 이 저장소에는 사람이 권한 설정을 둔 `.claude/settings.json`이 이미 있어서 `--adopt`를 붙였다. 붙이지 않으면 표지 없는 파일로 멈춘다([ADR 0043](../adr/0043-stop-on-unmanaged-files.md)). 편입해도 `permissions`와 사람이 둔 hooks는 그대로 남고, agctx의 묶음은 이벤트 배열의 끝에 들어간다.
- 받은 hooks가 실제로 실행되는 조건은 에이전트가 정한다. Claude Code 대화형 세션은 폴더를 신뢰한 뒤에, Codex는 프로젝트를 신뢰하고 사람마다 `/hooks`에서 그 hook을 승인한 뒤에 실행한다. hook이 바뀌면 Codex는 다시 승인을 받는다([근거](../references.md#skillssubagentshooks-위치와-형식-근거)). agctx는 hooks를 실행하지 않는다.
- `repos sync`는 hooks가 바뀌는 저장소를 쓰지 않고 `review`로 표시한다. 그 저장소에서 `agctx profile sync`를 실행해 명령을 확인한 뒤 쓴다.

## 바꾸거나 빼기

- 프로필의 파일을 고치고 `agctx profile sync`(또는 `repos sync`)를 실행하면 바뀐 파일만 다시 쓴다.
- 프로필에서 skill이나 subagent를 지우면 agctx가 쓴 파일만 지우고, 그래서 빈 폴더도 지운다. 프로필에서 hook을 지우면 agctx가 넣은 묶음만 빼고, agctx 것만 있던 `.codex/hooks.json`은 지운다.
- 저장소에서만 빼려면 `--include`에서 그 종류를 빼고 다시 적용한다.

## 멈췄을 때

| 멈춘 이유 | 종료 코드 | 할 일 |
| --- | --- | --- |
| agctx가 쓴 skill·subagent 파일이나 hook 묶음을 사람이 고쳤다 | 2 | 고친 내용을 프로필에 옮긴 뒤 `agctx profile resolve <저장소> --discard`로 백업하고 다시 만든다. 백업은 `.agctx/backups/`에 남는다 |
| 같은 skill 폴더나 subagent 파일에 사람이 둔 다른 내용이 있다 | 2 | 사람이 둔 것의 이름을 바꾸거나 옮긴다. 프로필에서 이름을 바꿔도 된다. `--adopt`로도 덮어쓰지 않는다 |
| `.claude/settings.json`이나 `.codex/hooks.json`이 사람이 만든 파일이다 | 2 | 안내된 명령에 `--adopt`를 붙여 다시 실행한다 |
| 프로필 파일의 형식이 틀렸다 | 64 | 오류가 가리킨 파일과 항목을 고친다 |

## 알아 둘 점

- Claude Code는 같은 이름의 개인 skill(`~/.claude/skills/`)이 있으면 저장소의 skill보다 개인 것을 쓴다. subagent는 반대로 저장소 것이 앞선다([근거](../references.md#skillssubagentshooks-위치와-형식-근거)).
- hook 묶음을 사람이 고치면 agctx는 그 묶음을 사람의 것으로 본다. `resolve --discard` 뒤에도 고친 묶음은 남으므로, 필요 없으면 직접 지운다.
- 새 이벤트가 에이전트 문서에 생겨도 agctx의 이벤트 목록이 갱신되기 전까지는 쓸 수 없다.
- 바이너리 파일(이미지 등)이 든 skill은 아직 받지 않는다.
