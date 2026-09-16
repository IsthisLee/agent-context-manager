# 에이전트에게 agctx를 맡기기

<!-- agctx-doc-sources: skills, tools/generate-skills.ts -->
<!-- agctx-doc-sources-sha256: 5899649db5e02b46dc77416ec4c0a4f1e7db1e1e3831f400871dc9f1b14daad6 -->

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

| 스킬 | 맡는 일 | 에이전트가 스스로 쓰는가 |
| --- | --- | --- |
| `agctx` | 규칙이 적용되지 않는 원인 찾기(`explain`·`verify`), 최신 여부 확인(`check`·`repos status`), 새 프로필 버전 반영(`profile pull`·`profile sync`) | 쓴다 |
| `agctx-author` | 프로필 지침 수정과 커밋 확인, `profile push`, 저장소마다 `repos pr`·`repos sync` | 사용자가 이름으로 부를 때만 |

표에 나온 명령이 각각 무엇을 하는지는 [CLI Reference](../reference/cli.md#명령어)의 명령 목록에 한 줄씩 있다.

## 설치하기

1. 스킬을 둘 프로젝트 폴더에서 아래 명령을 실행한다.

   ```bash
   DISABLE_TELEMETRY=1 npx skills add IsthisLee/agent-context-manager --skill '*' -a claude-code -a codex -a antigravity
   ```

2. 터미널에서 실행하면 skills CLI가 몇 가지를 묻는다. 아래 화면은 skills 1.5.26으로 실제로 실행한 화면에서 로고를 뺀 것이다.

   ```text
   ◇  Found 2 skills
   │
   ●  Installing all 2 skills
   │
   ◆  Installation scope
   │  ● Project (Install in current directory (committed with your project))
   │  ○ Global
   │  ↑/↓ to navigate • Enter: confirm
   └
   ```

   | 질문 | 고를 것 |
   | --- | --- |
   | **Installation scope** | **Project**는 이 프로젝트 폴더에 설치해 저장소와 함께 커밋한다. **Global**은 이 컴퓨터의 모든 프로젝트에서 쓰도록 설치한다(`-g`와 같다). |
   | **Installation method** | **Symlink (Recommended)**는 스킬 파일을 `.agents/skills/`에 한 벌만 두고, `.claude/skills/`에는 그 폴더를 가리키는 링크를 만든다. **Copy to all agents**는 두 폴더에 같은 파일을 각각 둔다. |
   | **Proceed with installation?** | 설치할 경로 요약을 확인하고 **Yes**(기본)에서 `Enter`를 누른다. |
   | **Install the find-skills skill?** | 처음 한 번만 묻는다. agctx와 관계없는 다른 스킬이며 **Yes가 기본**이다. 필요 없으면 `→`로 **No**를 고른 뒤 `Enter`를 누른다. |

3. `Installed 2 skills`와 `Done!`이 나오면 끝난 것이다.

질문 없이 설치하려면 명령 끝에 `-y`를 붙인다. 실제로 실행했을 때 **Project**와 **Symlink**로 설치했고 find-skills는 묻지 않았다. Claude Code 같은 에이전트 안에서 실행해도 skills CLI가 에이전트를 감지해 질문 없이 같은 방식으로 설치한다.

## 설치 확인하기

프로젝트에 설치했다면 아래 파일이 생겼는지 본다. 아래는 **Symlink**로 설치한 결과다.

```text
.agents/skills/agctx/SKILL.md
.agents/skills/agctx-author/SKILL.md
.agents/skills/agctx-author/agents/openai.yaml
.claude/skills/agctx -> ../../.agents/skills/agctx
.claude/skills/agctx-author -> ../../.agents/skills/agctx-author
skills-lock.json
```

- Codex와 Antigravity는 `.agents/skills/`를, Claude Code는 `.claude/skills/`를 읽는다. Claude Code는 링크로 둔 스킬 폴더도 링크 대상의 `SKILL.md`를 읽는다([외부 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)). **Copy to all agents**로 설치했다면 `.claude/skills/` 아래도 링크가 아니라 실제 폴더다.
- `skills-lock.json`에는 스킬을 받은 저장소와 파일 해시가 기록된다. 팀이 같은 스킬을 쓰려면 두 스킬 폴더와 함께 커밋한다.

그다음 에이전트에게 "이 폴더에서 규칙이 에이전트에 닿는지 확인해 줘"처럼 요청해 본다. 에이전트가 `agctx explain`을 실행해 결과를 설명하면 스킬이 동작하는 것이다.

## 알아 둘 점

- skills CLI(위 명령의 `npx skills`)는 익명 사용 통계를 보낸다. `DISABLE_TELEMETRY=1`이나 `DO_NOT_TRACK=1`을 두면 보내지 않는다. 질문 화면과 설치 결과를 확인한 실험도 같은 곳에 있다([외부 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)).
- 두 스킬은 쓰기 명령 앞에 `--dry-run` 결과(파일을 쓰지 않고 출력한 계획)를 보여 주고, 사용자가 승인한 뒤에만 `--yes`(확인 질문 없이 실행)를 붙이라고 지시한다. 에이전트를 임시 사본에서 한 번 실행해 확인하는 `verify --probe`도 실행 전에 묻게 한다.
- 스킬은 에이전트에게 주는 지시이므로 에이전트가 반드시 지킨다는 보장은 없다. 터미널이 아닌 곳에서는 `--yes` 없이 파일을 쓰지 않는 CLI 규칙이 마지막 방어선이다.
- 스킬 안의 명령 목록은 스킬을 설치한 시점의 저장소 기준이다.

## 다음 단계

- 스킬이 실행하는 명령의 뜻과 옵션은 [CLI Reference](../reference/cli.md)에 있다.
- 에이전트가 실행한 명령이 멈추거나 오류가 나면 [문제 해결](../reference/troubleshooting.md)을 본다.
