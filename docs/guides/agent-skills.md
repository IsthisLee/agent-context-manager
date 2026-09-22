# 에이전트에게 agctx를 맡기기


"이 폴더에서 규칙이 안 먹는 이유를 찾아 줘"나 "새 팀 규칙을 이 저장소에 반영해 줘"처럼 에이전트에게 말로 맡기려면 에이전트용 스킬을 설치한다. 스킬은 상황별로 쓸 명령, 쓰기 전에 승인을 받는 규칙, 종료 코드의 뜻을 에이전트에게 알려 준다.

## 목차

- [준비 사항](#준비-사항)
- [스킬이 맡는 일](#스킬이-맡는-일)
- [설치하기](#설치하기)
- [설치 확인하기](#설치-확인하기)
- [업데이트와 제거](#업데이트와-제거)
- [알아 둘 점](#알아-둘-점)
- [다음 단계](#다음-단계)

## 준비 사항

- **agctx:** 스킬은 agctx 패키지에 들어 있고, 에이전트가 agctx 명령을 실행하게 한다. 먼저 [빠른 시작](../getting-started/quick-start.md#설치)대로 agctx를 설치한다.
- **에이전트:** Claude Code, Codex, Antigravity 가운데 쓰는 에이전트가 이 컴퓨터에 설치되어 있어야 한다. `agctx install`은 설치된 에이전트를 찾아 그 에이전트의 스킬 폴더에만 둔다.

## 스킬이 맡는 일

<!-- agctx-doc-sources: tools/generate-skills.ts -->
<!-- agctx-doc-sources-sha256: f7e6cdc2e02ea4db87174f5e83f7942392910073a5c49f9dee41988e3506cbe8 -->

| 스킬 | 맡는 일 | 쓰이는 때 |
| --- | --- | --- |
| `agctx` | **읽기만 한다.** 규칙이 적용되지 않는 원인 찾기(`explain`·`verify`), 최신 여부 확인(`check`·`repos status`), 프로필 내용과 원격 상태 보기(`profile list`·`view`·`status`) | 사용자가 `/agctx`로 부를 때만 |
| `agctx-author` | **바꾸는 일 전부.** 프로필 만들기와 지침 고르기(`profile create`·`setup`), 프로젝트에 적용(`apply`·`sync`·`resolve`), Git 연결과 게시(`clone`·`connect`·`pull`·`push`), 저장소마다 반영(`repos sync`·`pr`) | 사용자가 `/agctx-author`로 부를 때만 |

두 스킬 모두 에이전트가 대화 내용을 보고 스스로 불러 쓰지 않는다. Claude Code와 Codex는 설정으로 막고, 자동 호출을 끄는 설정이 없는 Antigravity는 스킬 본문의 규칙으로 막는다. 스킬 없이 에이전트가 셸에서 `agctx`를 바로 실행하는 것까지 막지는 않는다([ADR 0047](../adr/0047-agent-skills-explicit-invocation-only.md)).

두 스킬은 한국어로 쓰여 있다. `description`에는 영어 한 줄을 함께 두어 한국어를 쓰지 않는 에이전트도 용도를 알 수 있게 했다([ADR 0030](../adr/0030-korean-skills.md)). CLI 출력의 기본 언어는 영어 그대로다([ADR 0014](../adr/0014-default-locale-english.md)).

어느 명령이 어느 스킬에 들어가는지는 명령 등록부의 에이전트 정책이 정한다. 아무것도 바꾸지 않는 명령은 `auto`라서 `agctx` 스킬에 들어가고, 파일이나 원격을 바꾸는 명령은 `ask`라서 `agctx-author` 스킬에만 들어간다. `profile remove`·`install`·`uninstall`·`config lang`·`help`는 `never`라서 어느 스킬에도 없다([ADR 0029](../adr/0029-agent-surface-contract.md)).

표에 나온 명령이 각각 무엇을 하는지는 [CLI Reference](../reference/cli.md#명령어)의 명령 목록에 한 줄씩 있다.

## 설치하기

<!-- agctx-doc-sources: skills, src/skills/install.ts -->
<!-- agctx-doc-sources-sha256: b21529b614c3955f09a1d46419fae73a2d70f7d41e69c74f5b14ff42f789eb0a -->

1. 아래 명령을 실행한다. 이 컴퓨터의 모든 프로젝트에서 쓰도록 사용자 전역 위치에 두므로 실행 위치는 상관없다.

   ```bash
   agctx install
   ```

   에이전트마다 스킬을 두는 곳과, 그 에이전트가 설치되어 있다고 보는 기준은 아래와 같다. 설치할 곳은 각 에이전트의 공식 문서가 드는 사용자 전역 위치다([외부 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)).

   | 에이전트 | 스킬을 두는 곳 | 설치되어 있다고 보는 기준 |
   | --- | --- | --- |
   | Claude Code | `~/.claude/skills/` | `~/.claude`가 있다 |
   | Codex | `~/.agents/skills/` | `CODEX_HOME`(없으면 `~/.codex`)이 있다 |
   | Antigravity 앱·IDE | `~/.gemini/config/skills/` | `~/.gemini/config`가 있다 |
   | Antigravity CLI | `~/.gemini/antigravity-cli/skills/` | `~/.gemini/antigravity-cli`가 있다 |

2. 설치가 끝나면 스킬 폴더마다 한 줄씩 나온다. Claude Code와 Codex만 있는 격리한 `HOME`에서 실제로 실행한 출력이다.

   ```text
   $ agctx install
   create     ~/.claude/skills/agctx
   create     ~/.claude/skills/agctx-author
   create     ~/.agents/skills/agctx
   create     ~/.agents/skills/agctx-author
   skipped    ~/.gemini/config/skills  not found: ~/.gemini/config
   skipped    ~/.gemini/antigravity-cli/skills  not found: ~/.gemini/antigravity-cli
   Installed the agctx skills. Start a new agent session to load them.
   ```

   스킬은 에이전트 세션을 시작할 때 읽히므로, 설치한 뒤에는 세션을 새로 연다. 찾지 못한 에이전트에도 두려면 `--agent claude`·`codex`·`antigravity`·`all`로 고른다. 파일을 쓰지 않고 계획만 보려면 `--dry-run`을 붙인다. 옵션과 종료 코드는 [CLI Reference](../reference/cli.md#install)에 있다.

## 설치 확인하기

아래 파일이 생겼는지 본다. 위와 같은 `HOME`에 실제로 설치한 뒤 옮긴 목록이다.

```text
~/.claude/skills/agctx/SKILL.md
~/.claude/skills/agctx/agents/openai.yaml
~/.claude/skills/agctx/.agctx-install.json
~/.claude/skills/agctx-author/SKILL.md
~/.claude/skills/agctx-author/agents/openai.yaml
~/.claude/skills/agctx-author/.agctx-install.json
~/.agents/skills/agctx/SKILL.md
~/.agents/skills/agctx/agents/openai.yaml
~/.agents/skills/agctx/.agctx-install.json
~/.agents/skills/agctx-author/SKILL.md
~/.agents/skills/agctx-author/agents/openai.yaml
~/.agents/skills/agctx-author/.agctx-install.json
```

- 에이전트마다 같은 파일을 한 벌씩 복사한다. 링크를 쓰지 않으므로 Node 버전을 바꾸거나 운영체제가 달라도 스킬이 깨지지 않는다.
- `.agctx-install.json`은 agctx가 둔 스킬 폴더라는 표시다. 설치한 CLI 버전과 파일별 해시가 적혀 있고, 형식은 [파일 형식](../reference/file-formats.md#agctx-installjson)에 있다.

그다음 에이전트에게 "/agctx 이 폴더에서 규칙이 에이전트에 닿는지 확인해 줘"처럼 스킬을 불러 요청해 본다. 에이전트가 `agctx explain`을 실행해 결과를 설명하면 스킬이 동작하는 것이다. 스킬을 부르지 않고 같은 말만 하면 에이전트는 이 스킬을 쓰지 않는다. Codex에서는 `/skills`나 `$agctx`로 부른다([근거](../references.md#에이전트-지침-로드와-전달-확인-근거)).

## 업데이트와 제거

- **CLI를 업데이트한 뒤:** `npm install -g agent-context-manager`로 새 버전을 받으면 `agctx install`을 다시 실행한다. 그 전까지는 모든 agctx 명령이 스킬이 CLI와 버전이 다르다고 한 줄로 알린다. 다시 실행하면 agctx가 둔 폴더만 새 버전으로 바꾸고, 바꿀 것이 없으면 `already up to date`라고 알린다.
- **스킬 파일을 고쳤다면:** 고친 폴더는 바꾸지 않고 아무것도 쓰지 않은 채 멈춘다. 고친 내용을 버려도 되면 `--force`로 바꾼다.

  ```text
  $ agctx install
  blocked    ~/.claude/skills/agctx  changed since agctx install wrote it: SKILL.md
  unchanged  ~/.claude/skills/agctx-author
  ...
  Error: Some skill folders were not written by agctx install or were changed since, so nothing was written.
  Next: Check the folders listed above, then replace them with agctx install --force.
  ```

- **전에 `npx skills add`로 설치했다면:** 그 폴더에는 설치 기록이 없어 `not written by agctx install`로 멈춘다. 처음 한 번 `agctx install --force`를 실행하면, `~/.claude/skills/`의 링크도 실제 폴더로 바뀐다.
- **지우려면:** `agctx uninstall`은 agctx가 둔 스킬 폴더만 지우고, 기록이 없거나 고친 폴더는 `kept`로 알리고 남긴다.

## 알아 둘 점

- 두 스킬은 쓰기 명령 앞에 `--dry-run` 결과(파일을 쓰지 않고 출력한 계획)를 보여 주고, 사용자가 승인한 뒤에만 `--yes`(확인 질문 없이 실행)를 붙이라고 지시한다. 에이전트를 임시 사본에서 한 번 실행해 확인하는 `verify --probe`도 실행 전에 묻게 한다.
- 스킬은 에이전트에게 주는 지시이므로 에이전트가 반드시 지킨다는 보장은 없다. 터미널이 아닌 곳에서는 `--yes` 없이 파일을 쓰지 않는다는 CLI 규칙이 마지막 안전장치다.
- 스킬에 적힌 명령 목록은 설치한 CLI와 같은 버전의 명령 등록부에서 만든 것이다.
- `CLAUDE_CONFIG_DIR`로 Claude Code의 설정 폴더를 옮긴 경우, 스킬 위치도 바뀌는지는 확인하지 못했다. agctx는 문서대로 `~/.claude/skills/`에 둔다. `~/.claude`가 없으면 `--agent claude`로 설치한다.

## 다음 단계

- 스킬이 실행하는 명령의 뜻과 옵션은 [CLI Reference](../reference/cli.md)에 있다.
- 에이전트가 실행한 명령이 멈추거나 오류가 나면 [문제 해결](../reference/troubleshooting.md)을 본다.
