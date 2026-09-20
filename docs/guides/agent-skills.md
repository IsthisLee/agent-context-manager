# 에이전트에게 agctx를 맡기기


"이 폴더에서 규칙이 안 먹는 이유를 찾아 줘"나 "새 팀 규칙을 이 저장소에 반영해 줘"처럼 에이전트에게 말로 맡기려면 에이전트용 스킬을 설치한다. 스킬은 상황별로 쓸 명령, 쓰기 전에 승인을 받는 규칙, 종료 코드의 뜻을 에이전트에게 알려 준다.

## 목차

- [준비 사항](#준비-사항)
- [스킬이 맡는 일](#스킬이-맡는-일)
- [설치하기](#설치하기)
- [설치 확인하기](#설치-확인하기)
- [알아 둘 점](#알아-둘-점)
- [다음 단계](#다음-단계)

## 준비 사항

- **agctx:** 스킬은 에이전트가 agctx 명령을 실행하게 하므로, 에이전트를 쓰는 컴퓨터에 agctx가 설치되어 있어야 한다. 설치는 [빠른 시작](../getting-started/quick-start.md#설치)에 있다.
- **Node.js:** 스킬 설치 명령을 `npx`로 실행하므로 Node.js가 필요하다.

## 스킬이 맡는 일

<!-- agctx-doc-sources: tools/generate-skills.ts -->
<!-- agctx-doc-sources-sha256: 3313465bb1b05d8ada2fd6997b3189cc3542a2dfa7a98f193ccf320439a731bf -->

| 스킬 | 맡는 일 | 에이전트가 스스로 쓰는가 |
| --- | --- | --- |
| `agctx` | **읽기만 한다.** 규칙이 적용되지 않는 원인 찾기(`explain`·`verify`), 최신 여부 확인(`check`·`repos status`), 프로필 내용과 원격 상태 보기(`profile list`·`view`·`status`) | 쓴다 |
| `agctx-author` | **바꾸는 일 전부.** 프로필 만들기와 지침 고르기(`profile create`·`setup`), 프로젝트에 적용(`apply`·`sync`·`resolve`), Git 연결과 게시(`clone`·`connect`·`pull`·`push`), 저장소마다 반영(`repos sync`·`pr`) | 사용자가 이름으로 부를 때만 |

두 스킬은 한국어로 쓰여 있다. `description`에는 영어 한 줄을 함께 두어 한국어를 쓰지 않는 에이전트도 용도를 알 수 있게 했다([ADR 0030](../adr/0030-korean-skills.md)). CLI 출력의 기본 언어는 영어 그대로다([ADR 0014](../adr/0014-default-locale-english.md)).

어느 명령이 어느 스킬에 들어가는지는 명령 등록부의 에이전트 정책이 정한다. 아무것도 바꾸지 않는 명령은 `auto`라서 `agctx` 스킬에 들어가고, 파일이나 원격을 바꾸는 명령은 `ask`라서 `agctx-author` 스킬에만 들어간다. `profile remove`·`config lang`·`help`는 `never`라서 어느 스킬에도 없다([ADR 0029](../adr/0029-agent-surface-contract.md)).

표에 나온 명령이 각각 무엇을 하는지는 [CLI Reference](../reference/cli.md#명령어)의 명령 목록에 한 줄씩 있다.

## 설치하기

<!-- agctx-doc-sources: skills -->
<!-- agctx-doc-sources-sha256: 33ce9e59363046f460417725ab2f263112d3eade5ec869e2e5d88d91580511cb -->

1. 아래 명령을 실행한다. 이 컴퓨터의 모든 프로젝트에서 쓰도록 설치하므로 실행 위치는 상관없다.

   ```bash
   npx skills add IsthisLee/agent-context-manager -g -a claude-code -a codex -a antigravity
   ```

   `-g`는 전역 설치다. 두 스킬은 특정 저장소의 성질이 아니라 이 컴퓨터에서 agctx를 쓰는 방법이므로, 프로젝트에 커밋하지 않고 전역에 둔다. `-a`로 세 에이전트를 적는 이유는 이것을 빼면 skills CLI가 아는 에이전트 70개가 넘는 폴더에 모두 설치하기 때문이다(실측은 [외부 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)).

2. 설치가 끝나면 아래처럼 결과가 나온다. 격리한 `HOME`으로 실제 실행한 출력이다.

   ```text
   ◇  Installed 2 skills ──────────────╮
   │                                   │
   │  ✓ ~/.agents/skills/agctx         │
   │    universal: Codex, Antigravity  │
   │    symlinked: Claude Code         │
   │  ✓ ~/.agents/skills/agctx-author  │
   │    universal: Codex, Antigravity  │
   │    symlinked: Claude Code         │
   │                                   │
   ├───────────────────────────────────╯
   └  Done!  Review skills before use; they run with full agent permissions.
   ```

   스킬 파일은 `~/.agents/skills/`에 한 벌만 두고 `~/.claude/skills/`에는 그 폴더를 가리키는 링크를 만든다(**Symlink**). `--copy`를 주면 두 폴더에 같은 파일을 각각 둔다.

   터미널에서 실행하면 설치 방법과 진행 여부를 묻는다. `-g`와 `-a`가 설치 범위와 에이전트를 미리 정하므로 그 두 질문은 나오지 않는다. 질문 없이 끝내려면 `-y`를 붙인다. Claude Code 같은 에이전트 안에서 실행하면 skills CLI가 에이전트를 감지해 질문 없이 설치한다.

## 설치 확인하기

아래 파일이 생겼는지 본다. 격리한 `HOME`으로 실제 설치한 뒤 옮긴 목록이다.

```text
~/.agents/skills/agctx/SKILL.md
~/.agents/skills/agctx-author/SKILL.md
~/.agents/skills/agctx-author/agents/openai.yaml
~/.claude/skills/agctx -> ../../.agents/skills/agctx
~/.claude/skills/agctx-author -> ../../.agents/skills/agctx-author
```

- Codex와 Antigravity는 `.agents/skills/`를, Claude Code는 `.claude/skills/`를 읽는다. Claude Code는 링크로 둔 스킬 폴더도 링크 대상의 `SKILL.md`를 읽는다([외부 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)).
- 전역 설치는 `skills-lock.json`을 만들지 않는다. 프로젝트 설치(`-g` 없이 **Project**를 고른 경우)에만 프로젝트 폴더에 생기고, 그때는 두 스킬 폴더와 함께 커밋해야 팀이 같은 스킬을 쓴다.

그다음 에이전트에게 "이 폴더에서 규칙이 에이전트에 닿는지 확인해 줘"처럼 요청해 본다. 에이전트가 `agctx explain`을 실행해 결과를 설명하면 스킬이 동작하는 것이다.

## 알아 둘 점

- skills CLI(위 명령의 `npx skills`)는 설치 사실을 익명 통계로 보낸다. 저장소 이름, 스킬 이름, 에이전트 이름, 설치된 파일 목록이며 개인 정보는 없다. 보내지 않으려면 `DISABLE_TELEMETRY=1`이나 `DO_NOT_TRACK=1`을 붙인다. 보내는 내용과 끄는 방식을 코드에서 확인한 기록은 [외부 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)에 있다.
- 두 스킬은 쓰기 명령 앞에 `--dry-run` 결과(파일을 쓰지 않고 출력한 계획)를 보여 주고, 사용자가 승인한 뒤에만 `--yes`(확인 질문 없이 실행)를 붙이라고 지시한다. 에이전트를 임시 사본에서 한 번 실행해 확인하는 `verify --probe`도 실행 전에 묻게 한다.
- 스킬은 에이전트에게 주는 지시이므로 에이전트가 반드시 지킨다는 보장은 없다. 터미널이 아닌 곳에서는 `--yes` 없이 파일을 쓰지 않는다는 CLI 규칙이 마지막 안전장치다.
- 스킬에 적힌 명령 목록은 스킬을 설치한 시점의 저장소를 기준으로 한다.

## 다음 단계

- 스킬이 실행하는 명령의 뜻과 옵션은 [CLI Reference](../reference/cli.md)에 있다.
- 에이전트가 실행한 명령이 멈추거나 오류가 나면 [문제 해결](../reference/troubleshooting.md)을 본다.
