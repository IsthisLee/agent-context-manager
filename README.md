# Agent Context Manager (agctx)

<!-- agctx-doc-sources: README.en.md -->
<!-- agctx-doc-sources-sha256: 2a31bbb4b09eb1d7270ab763766b82106cf88cf655d3bd602017f1d5982d283e -->

[![CI](https://img.shields.io/github/actions/workflow/status/IsthisLee/agent-context-manager/ci.yml?branch=main&label=CI&logo=github)](https://github.com/IsthisLee/agent-context-manager/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/IsthisLee/agent-context-manager/codeql.yml?branch=main&label=CodeQL&logo=github)](https://github.com/IsthisLee/agent-context-manager/actions/workflows/codeql.yml)
[![npm](https://img.shields.io/npm/v/agent-context-manager?logo=npm&color=cb3837)](https://www.npmjs.com/package/agent-context-manager)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/en/about/previous-releases)
[![Supported agents](https://img.shields.io/badge/agents-Codex%20%C2%B7%20Claude%20Code%20%C2%B7%20Antigravity-6f42c1)](https://github.com/IsthisLee/agent-context-manager#지원-에이전트)

[핵심 목표](#핵심-목표) · [사용 사례](#사용-사례) · [목적별 가이드](#목적별-가이드) · [시작하기](#시작하기) · [핵심 기능](#핵심-기능) · [지원 에이전트](#지원-에이전트) · [지원하지 않는 기능](#지원하지-않는-기능) · [아키텍처 방향](#아키텍처-방향과-진행-상태) · [문서](#문서) · [공개 프로젝트 참여](#공개-프로젝트-참여)

읽는 언어: **한국어** · [English](README.en.md)

<p align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/IsthisLee/agent-context-manager/main/docs/assets/agctx-overview.ko.dark.png">
    <img src="https://raw.githubusercontent.com/IsthisLee/agent-context-manager/main/docs/assets/agctx-overview.ko.png" alt="agctx 구조: Personal·Company·Team 프로필을 여러 프로젝트에 apply·sync하고, 프로젝트마다 생성된 AGENTS.md·CLAUDE.md 등을 Codex·Claude Code·Antigravity가 읽는다. 팀·조직 프로필은 Git 원격으로 clone·pull·push한다." width="880">
  </picture>

</p>

## 에이전트 컨텍스트를 한곳에서 만들고 관리합니다

**TDD·보안·문서화·스킬·MCP 같은 기준을 이미 CLAUDE.md에 정해 두셨을 것입니다. 그런데 프로젝트와 AI 도구가 늘어날 때마다 같은 설정을 처음부터 다시 하고 계시지는 않나요?**

agctx는 그 기준을 프로필로 관리합니다. 프로필을 프로젝트에 적용하면 Codex·Claude Code·Antigravity가 읽는 지침 파일을 한 번에 만듭니다. 프로필에서 기준을 바꾼 뒤 동기화하면 프로젝트마다 파일을 다시 고치지 않아도 되고, 각 프로젝트만의 도메인 규칙은 그대로 남습니다. `profile create` → `profile setup` → `profile apply`·`profile sync`로 이어지는 한 흐름입니다.

- 👥 개인·팀·회사별로 프로필 나누기
- 🧩 규칙·스킬·MCP·subagents·hooks를 한 프로필에 모으기 (Antigravity의 MCP·subagents·hooks는 구현 예정)
- 📋 TDD·검증·보안 같은 권장 지침 고르기
- 🎯 저장소마다 적용할 프로필과 에이전트 고르기 (에이전트 선택은 구현 예정)
- 🔄 프로필이 바뀌면 한 번에 동기화하기
- 🛡️ 프로젝트마다 따로 쓴 지침은 그대로 두기
- 🌿 Git으로 공유하고, CI로 검사하고, 여러 저장소에 PR 열기

> ⚙️ 지금 프로필이 관리하는 컨텍스트는 규칙(`AGENTS.md`·`CLAUDE.md`·`.agents/rules`), MCP 서버 설정(Claude Code `.mcp.json`·Codex `.codex/config.toml`), 스킬(`.claude/skills`·`.agents/skills`), subagent 정의(`.claude/agents`·`.codex/agents`), hooks(`.claude/settings.json`·`.codex/hooks.json`)입니다. hooks는 다른 사람의 컴퓨터에서 실행될 명령이라 저장소가 직접 골라야 받습니다([팀 skills·subagents·hooks 나눠 쓰기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/skills-subagents-hooks.md)). Antigravity에는 아직 규칙과 스킬만 씁니다.

## 핵심 목표

> agctx는 개인·조직별 에이전트 컨텍스트를 프로필로 생성·설정하고, 로컬 또는 Git으로 관리하며, 프로젝트와 여러 AI 에이전트에 안전하게 적용·동기화합니다.

지침을 두는 자리가 둘로 나뉩니다. 여러 프로젝트가 함께 따르는 지침은 프로필에 두고 거기서만 고칩니다. 한 프로젝트에만 필요한 규칙은 그 프로젝트의 `AGENTS.md`에 직접 씁니다. 동기화할 때 agctx는 프로필에서 온 부분만 다시 만들고, 프로젝트에 직접 쓴 부분은 건드리지 않습니다.

> [!NOTE]
> agctx는 프로필의 공통 컨텍스트를 여러 프로젝트와 에이전트에 배포합니다. 코드베이스를 분석해 프로젝트 지침을 자동으로 작성하지는 않습니다. [이유 보기](#지원하지-않는-기능)

## 사용 사례

| 누가        | 이렇게 씁니다                                                                                                                                                       | 얻는 것                                                                                                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 개인 개발자 | 프로젝트 성격별로 `Personal` 프로필을 만들고 저장소마다 `profile apply`로 적용합니다.                                                                               | AI 도구를 바꾸거나 새 프로젝트를 시작해도 같은 개발 기준을 그대로 다시 씁니다.                                                                                                                                                                                        |
| 팀          | 팀 프로필을 Git 저장소로 공유하고, 적용을 맡은 사람이 `profile clone`·`pull`로 받아 담당 저장소에 적용해 커밋합니다. 검토한 버전에 머물려면 `--pin`으로 고정합니다. | 공통 컨텍스트가 바뀔 때마다 같은 이력으로 검토하고 배포하므로, 사람마다 설정이 달라지는 일이 줄어듭니다. 역할과 절차는 [팀과 Git으로 공유하기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/team-sharing.md#누가-무엇을-하나)에 있습니다. |
| 조직        | 조직 프로필의 공통 기준을 Git으로 관리하고, 팀과 프로젝트는 자기 도메인 규칙만 프로젝트 `AGENTS.md`에 적습니다.                                                     | 회사 공통 기준과 프로젝트별 요구사항을 섞지 않고 따로 관리합니다. CI에서 `agctx check --refresh`로 각 저장소가 최신 기준을 반영했는지 확인합니다.                                                                                                                     |

다른 팀원은 저장소만 받으면 되고 agctx를 설치하지 않아도 됩니다. 에이전트는 커밋된 지침 파일을 그대로 읽습니다.

## 목적별 가이드

내 상황에 맞는 가이드를 고릅니다. 같은 목록이 [문서 안내](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/README.md#목적별-가이드)에도 있습니다.

| 상황                                    | 가이드                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 명령 대신 메뉴로 쓰기                   | [TUI로 쓰기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/tui.md)                                                   |
| 에이전트에게 맡기기                     | [에이전트에게 agctx를 맡기기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/agent-skills.md)                         |
| 성격이 다른 저장소 여럿, 컴퓨터 여러 대 | [성격이 다른 저장소 여럿에 프로필 나눠 쓰기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/multi-repo-individual.md) |
| 고객사가 여럿                           | [고객사 여러 곳의 규칙 따로 쓰기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/multi-client.md)                     |
| 팀 프로필 공유                          | [팀과 Git으로 공유하기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/team-sharing.md)                               |
| 모노레포                                | [모노레포에서 쓰기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/monorepo.md)                                       |
| 고정 여부와 예약 봇                     | [갱신 방식 고르기: 고정과 예약 봇](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/update-policies.md)                 |
| CI와 스크립트                           | [CI와 자동화에서 쓰기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/ci.md)                                          |
| Microsoft APM과 함께                    | [APM과 함께 쓰기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/apm-coexistence.md)                                  |

## 시작하기

<!-- agctx-doc-sources: package.json -->
<!-- agctx-doc-sources-sha256: 5121b6818053c7fec722d0ded83cc15cb0977c6e2592438316d74ce7ab3b2c3b -->

> 실행 환경: Node.js 22 LTS 이상

```bash
npm install -g agent-context-manager
agctx install      # 설치된 에이전트에 agctx 스킬을 등록

agctx profile create company --scope company
agctx profile setup company --tdd on --security on
agctx profile apply company /path/to/project
```

적용하면 에이전트별 지침 파일이 만들어지고, 적용한 프로필 버전과 마지막 적용본을 남기는 기록 파일(`agctx.project.json`, `.agctx/base/`)도 함께 생깁니다. 아래는 마지막 명령의 실제 출력입니다.

```text
$ agctx profile apply company /path/to/project
Plan: 8 file(s) to change.
  create    AGENTS.md
  create    CLAUDE.md
  create    .agents/rules/agctx.md
  create    .agctx/base/AGENTS.md.base
  create    .agctx/base/CLAUDE.md.base
  create    .agctx/base/.agents/rules/agctx.md.base
  create    .agctx/.gitignore
  create    agctx.project.json
Applied profile company to /path/to/project
```

이미 사람이 쓴 `AGENTS.md`나 `CLAUDE.md`가 있는 저장소에서는 아무것도 바꾸지 않고 멈춥니다. 기존 내용을 남기고 agctx 영역을 더하려면 안내대로 `--adopt`를 붙여 다시 실행합니다([CLI Reference](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/reference/cli.md#profile-apply)).

> [!Tip]
> 터미널에서 `agctx`를 입력하면 명령을 외우지 않아도 TUI 메뉴에서 모든 기능을 실행할 수 있습니다. 프로필 만들기·지침 설정·적용·동기화·Git 공유부터 프로젝트 점검과 여러 저장소 처리까지 메뉴로 진행합니다.
>
> 옵션을 직접 전달하는 방식은 자동화나 반복 실행에 씁니다.

프로필은 이 컴퓨터의 `~/.agctx/profiles/<name>` 폴더에 저장됩니다. 적용한 뒤에는 프로젝트의 도메인 규칙을 프로젝트 `AGENTS.md`의 `프로젝트 규칙 확장` 섹션 아래에 씁니다. 그 위의 공통 지침 부분은 동기화할 때 agctx가 다시 만듭니다.

설치부터 첫 적용까지 단계별 설명은 [빠른 시작](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/getting-started/quick-start.md)에 있습니다.

### 에이전트에게 맡기기 (선택)

여기까지는 사람이 명령으로 실행했습니다. 위의 `agctx install`로 에이전트용 스킬을 등록해 두면 이후 작업은 "이 저장소 컨텍스트가 최신인지 확인해 줘"처럼 말로 맡길 수 있습니다. 에이전트가 `agctx check`를 실행하고 결과를 설명합니다. 스킬은 쓰기 명령 전에 `--dry-run` 결과를 보여 주고 승인을 받게 합니다. 프로필을 게시하고 PR을 여는 `agctx-author` 스킬은 이름으로 부를 때만 동작합니다.

스킬은 CLI 패키지에 들어 있고, `agctx install`이 이 컴퓨터에 설치된 Claude Code·Codex·Antigravity의 스킬 폴더에 복사합니다. 그래서 스킬에 적힌 명령이 설치한 CLI와 항상 같습니다. CLI를 업데이트한 뒤에는 `agctx install`을 다시 실행하고, 그 전까지는 모든 명령이 한 줄로 알려 줍니다.

자세한 내용은 [에이전트에게 agctx를 맡기기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/agent-skills.md)에 있습니다.

## 핵심 기능

<!-- agctx-doc-sources: src/commands/registry.ts, src/profile/setup.ts -->
<!-- agctx-doc-sources-sha256: 7ad7ed0d70ec5c110a5ecf145335f0490af4f962a60b3c4b13cf02aaf523edfd -->

- **프로필 만들기와 설정** — `profile create`·`list`·`setup`·`remove`. scope(프로필의 용도)는 `personal`·`company`·`team`·`workspace`이고, `setup`은 작업 흐름·맥락 관리·TDD·변경 검토·검증·지침 파일·문서화·보안·믿을 수 없는 입력·응답 언어 열 개 항목을 켜고 끕니다(`on`·`off`). 항목마다 실제로 들어가는 문장과 그 근거는 [지침 카탈로그](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/reference/guidance-catalog.md)에 있습니다.
- **적용과 동기화** — `profile apply`·`sync`·`resolve`. 적용하면 프로필 버전을 기록하고, `--pin`은 그 커밋에 고정합니다. `--agent`로 파일을 받을 에이전트를, `--include`로 받을 종류(규칙·MCP·skills·subagents·hooks)를 저장소마다 고릅니다. 관리 영역 안을 고쳐 충돌이 나면 `resolve`가 그 편집을 관리 영역 밖으로 옮깁니다. 사람이 쓴 파일은 `--adopt`로 허락해야 관리 영역을 더합니다.
- **Git으로 공유** — `profile clone`·`status`·`pull`·`push`·`connect`. 표준 Git 원격을 쓰고 프로젝트 파일은 건드리지 않으며, 받아 온 프로필 내용에 숨은 문자가 있으면 멈춥니다. 이미 쓰던 규칙 저장소는 그 폴더에서 `profile link`로 커밋 없이 바로 연결하고, 팀과는 그때 생긴 `profile.json`을 커밋해 나눕니다([기존 저장소를 프로필로 쓰기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/team-sharing.md#기존-저장소를-프로필로-쓰기)).
- **저장소 검사** — `check`는 파일을 바꾸지 않고, 관리 영역을 밖에서 고쳤는지·숨은 문자가 있는지·기록한 프로필 버전보다 뒤처졌는지를 종료 코드로 알립니다. `--refresh`는 원격의 최신 커밋과도 비교합니다.
- **여러 저장소** — `repos list`·`status`·`sync`·`pr`로 프로필을 적용한 저장소를 한 번에 다루고, 고정한 저장소는 PR로 갱신합니다. 예약 봇은 `repos pr --targets <file> --yes`로 실행합니다.
- **전달 확인** — `explain`은 그 폴더에서 시작한 에이전트가 읽는 지침 파일과 그 이유를 보여 줍니다. 확인한 에이전트 가운데 하나라도 받지 못하는 파일이 있으면 종료 코드 4로 끝납니다. `verify`는 세션 기록으로 실제로 들어갔는지 확인하고, `--probe`는 승인 뒤 임시 사본에서 에이전트를 한 번씩 실행합니다.
- **에이전트용 스킬** — `install`·`uninstall`. CLI 패키지에 든 스킬을 이 컴퓨터에 설치된 Claude Code·Codex·Antigravity의 스킬 폴더에 복사하고, 자기가 둔 폴더만 바꾸거나 지웁니다. 설치된 스킬이 CLI와 버전이 다르면 모든 명령이 한 줄로 알립니다.
- **모노레포와 APM 공존** — 하위 폴더 `AGENTS.md`마다 Claude Code가 읽는 `CLAUDE.md` 연결 파일을 만들고, Microsoft APM의 `managed_section` 블록과 함께 씁니다. APM 기본 모드가 만든 파일에는 쓰지 않고 멈춥니다.
- **모든 명령의 공통 계약** — `--json` 결과 문서, 뒤처짐·충돌·숨은 문자를 구분하는 종료 코드, `agctx <명령> --help`. 파일을 바꾸는 명령은 터미널이 아니면 확인을 물을 수 없으므로 `--yes`가 있어야 실행합니다. 표시·생성 언어는 `config lang <ko|en>`으로 정합니다.

명령마다의 옵션·종료 코드·사용법은 [CLI Reference](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/reference/cli.md)에 있습니다.

### 검증의 범위

저장소를 개발하는 사람은 `pnpm run check`로 agctx 자체의 형식 검사, 서식 검사, 린트, 문서 계약, CLI 평가를 실행합니다. 이 명령은 대상 프로젝트의 테스트를 대신 실행하지 않고, 에이전트가 쓴 코드의 품질도 보증하지 않습니다. 대상 프로젝트의 검증은 그 프로젝트가 제공하는 명령으로 에이전트가 실행합니다. 프로필에는 그 검증을 요구하는 지침만 골라 담을 수 있습니다.

## 지원 에이전트

<!-- agctx-doc-sources: src/project/plan.ts -->
<!-- agctx-doc-sources-sha256: 6104f0900efa5ab3617f87afcfbccdb07cb93ddb4e7250024861cc32fd3b30aa -->

프로필을 프로젝트에 적용하면 아래 에이전트별 지침 파일을 만들고 동기화합니다. `AGENTS.md`는 여러 에이전트가 함께 읽는 공통 표준입니다.

| 에이전트                  | 생성 파일                |
| ------------------------- | ------------------------ |
| Codex 등 (AGENTS.md 표준) | `AGENTS.md`              |
| Claude Code               | `CLAUDE.md`              |
| Antigravity               | `.agents/rules/agctx.md` |

프로필에 MCP 서버·skills·subagents·hooks가 있으면 에이전트마다 그 설정 파일(`.mcp.json`, `.claude/skills/`, `.codex/agents/` 등)도 씁니다. 에이전트별 위치는 [지원 에이전트](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/reference/supported-agents.md)에 있습니다.

적용할 때 agctx가 마지막으로 쓴 관리 영역 원문을 `.agctx/base/`에도 남깁니다. 이 원문은 관리 영역에서 충돌이 났을 때 기준이 되므로 git에 커밋하세요.

에이전트가 파일을 실제로 읽는지는 시작한 폴더에 따라 달라집니다. Codex는 하위 폴더의 `AGENTS.md`를 그 폴더에서 시작할 때만 읽습니다. Claude Code는 시작 폴더나 그 위에 `CLAUDE.md` 계열 파일이 하나도 없을 때만 `AGENTS.md`를 직접 읽고, 하나라도 있으면 그 파일이 가져오는 `AGENTS.md`만 읽습니다. 모노레포에서는 하위 폴더 `AGENTS.md`마다 `@AGENTS.md`를 가져오는 `CLAUDE.md` 연결 파일을 만들고, 사람이 둔 `CLAUDE.md`는 건드리지 않습니다. 폴더마다 `agctx explain <폴더>`로 확인하세요.

## 지원하지 않는 기능

**코드베이스를 분석해 프로젝트 지침을 자동으로 작성하는 기능은 지원하지 않습니다.** agctx는 프로필의 공통 컨텍스트를 프로젝트와 여러 에이전트에 배포합니다. 프로젝트 고유 지침은 프로젝트가 소유하며 agctx가 대신 작성하지 않습니다.

| 이유                                  | 근거                                                                                                                                                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 각 에이전트가 이미 제공합니다.        | Claude Code와 Codex의 `/init`이 코드베이스를 분석해 지침 초안을 만듭니다.                                                                                                                                                                 |
| 공식 가이드가 권하지 않는 내용입니다. | Anthropic은 에이전트가 코드를 읽어 알아낼 수 있는 내용과 파일별 설명을 지침에서 빼라고 안내합니다. 지침에 넣을 것은 에이전트가 추측할 수 없는 명령·관례·결정·주의할 점입니다. 지침이 길어지면 중요한 규칙이 묻혀 무시된다고도 경고합니다. |
| 효과가 확인되지 않았습니다.           | 연구에서 에이전트는 컨텍스트 파일의 지시를 따랐지만 과제 성공률은 일반적으로 오르지 않았고 추론 비용은 평균 20% 넘게 늘었습니다. 저장소 개요는 도움이 되지 않았습니다.                                                                    |
| agctx의 범위 밖입니다.                | 깊은 분석에는 모델 호출이 필요합니다. agctx는 모델 호출과 에이전트 런타임을 다루지 않습니다.                                                                                                                                              |

> [!Tip]
> 저장소에 맞는 지침 초안이 필요하면 각 에이전트의 `/init`이나 [microsoft/agentrc](https://github.com/microsoft/agentrc)를 쓸 수 있습니다. agentrc는 저장소의 AI 준비도를 재고 그 코드베이스에 맞는 지침 파일을 만들며, `--output AGENTS.md`로 `AGENTS.md`도 만듭니다. 비교와 함께 쓰는 방법은 [참고 자료](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/references.md#비교-대상)에 있습니다.

이렇게 만든 초안은 사람이 다듬은 뒤 `AGENTS.md`의 `프로젝트 규칙 확장` 영역에 두세요. 여러 에이전트가 공통으로 읽는 표준이 `AGENTS.md`이기 때문입니다. `CLAUDE.md`에 남긴다면 agctx 관리 블록 밖에 두세요. 관리 영역 안을 고치면 다음 `profile sync`가 충돌로 멈춥니다. 이때 `profile resolve`가 그 편집을 관리 영역 밖으로 옮겨 충돌을 풀어 줍니다. 결정 이유와 출처는 [ADR 0006](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/adr/0006-no-codebase-analysis-guidance.md)과 [참고 자료](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/references.md#프로젝트-지침-자동-생성에-관한-근거)에 있습니다.

## 아키텍처 방향과 진행 상태

agctx의 구현은 “공통 컨텍스트를 어디에 두고, 누가 무엇을 변경하는가”를 기준으로 단계적으로 관리합니다. 주제마다 목표와 중요도, 구현 전에 정해야 할 계약, 구현 기록을 논의 문서에 둡니다. 주제 목록과 상태는 [아키텍처 논의 인덱스](https://github.com/IsthisLee/agent-context-manager/tree/main/docs/discussion/architecture/)에 있습니다. 지금 쓸 수 있는 명령은 [핵심 기능](#핵심-기능)에 있습니다.

<!-- agctx:generated:discussion-status:start -->
- **구현됨:** 프로필 모델과 저장소, setup과 지침 옵션, 프로젝트 적용, 에이전트 산출물 동기화, 자연어 요청을 통한 agctx 사용, 지침 항목 켜고 끄기, 에이전트 규칙 위치 탐지, Git 기반 프로필 관리, 기본 지침의 근거 기준과 분량 예산, 적용할 에이전트와 대상 종류 고르기, 기존 Git 저장소를 프로필 원천으로 쓰기, 기존 저장소 폴더를 프로필로 연결하기, 에이전트 스킬을 agctx 명령으로 설치하기
- **구현 중:** agctx 관리 산출물의 안전한 동기화, 프로필 설정 표면 확장
- **제안 단계:** 스코프 확장과 지침 합성, 기존 저장소에서 프로필 만들기. 아직 현재 동작이 아니므로 보장하지 않습니다.
<!-- agctx:generated:discussion-status:end -->

## 문서

- [문서 안내](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/README.md): 사용 흐름과 전체 목차
- [빠른 시작](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/getting-started/quick-start.md)
- [목적별 가이드](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/README.md#목적별-가이드)
- [CLI Reference](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/reference/cli.md)
- [제품 방향](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/contributing/product-direction.md)
- [기여자 문서](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/README.md#기여자-문서)
- [아키텍처 구현 계획](https://github.com/IsthisLee/agent-context-manager/tree/main/docs/discussion/architecture/)
- [외부 참고 문헌](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/references.md)

## 공개 프로젝트 참여

개인 프로젝트라 기여 절차를 따로 두지 않습니다. 쓰면서 막히거나 고칠 것을 찾으면 이슈로 알려 주세요.

- [이슈 제보](https://github.com/IsthisLee/agent-context-manager/issues)
- [보안 정책](https://github.com/IsthisLee/agent-context-manager/blob/main/SECURITY.md) — 취약점은 이슈 대신 여기 적힌 경로로 알려 주세요
- [개발 규약](https://github.com/IsthisLee/agent-context-manager/blob/main/AGENTS.md) — 이 저장소에서 코드와 문서를 고칠 때 따르는 규칙

---

[MIT License](LICENSE) · Built with Codex, Claude Code, and Antigravity.
