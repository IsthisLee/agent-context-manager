# Agent Context Manager (agctx)

**AI 코딩 에이전트를 위한 프로필 기반 컨텍스트 관리 도구입니다.**

<!-- agctx-doc-sources: src, package.json, docs/discussion/architecture/README.md, docs/discussion/architecture/topics -->
<!-- agctx-doc-sources-sha256: b282d848ec97be0667ee542896cd0a799c38c85536661fd9ecbfa765993c3f31 -->

![CI](https://img.shields.io/github/actions/workflow/status/IsthisLee/agent-context-manager/ci.yml?branch=main&label=CI&logo=github)
![CodeQL](https://img.shields.io/github/actions/workflow/status/IsthisLee/agent-context-manager/codeql.yml?branch=main&label=CodeQL&logo=github)
![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/IsthisLee/agent-context-manager/badge)
![npm](https://img.shields.io/npm/v/agent-context-manager?logo=npm&color=cb3837)
![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)
![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)
![last commit](https://img.shields.io/github/last-commit/IsthisLee/agent-context-manager)
![Supported agents](https://img.shields.io/badge/agents-Codex%20%C2%B7%20Claude%20Code%20%C2%B7%20Antigravity-6f42c1)

**한국어** · [English](README.en.md)

[이런 문제를 해결해요](#-이런-문제를-해결해요) · [핵심 목표](#핵심-목표) · [사용 사례](#사용-사례) · [시작하기](#시작하기) · [핵심 기능](#핵심-기능) · [지원 에이전트](#지원-에이전트) · [지원하지 않는 기능](#지원하지-않는-기능) · [아키텍처 방향](#-아키텍처-방향과-진행-상태) · [문서](#문서) · [공개 프로젝트 참여](#공개-프로젝트-참여)

## 개발자가 달라도, 팀이 달라도, AI 에이전트가 달라도 개발 지침은 하나 ☝️

> agctx는 개인·조직별 에이전틱 개발 지침을 프로필로 생성·설정하고, 이를 로컬 또는 Git 기반으로 관리하며 프로젝트와 여러 AI 에이전트에 안전하게 적용·동기화합니다. 



> (⚙️ 지침 -&gt; 환경(Skills, Hooks 등)으로 적용 범위를 넓혀가는 중입니다.)

<p align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/IsthisLee/agent-context-manager/main/docs/assets/agctx-overview.ko.dark.png">
    <img src="https://raw.githubusercontent.com/IsthisLee/agent-context-manager/main/docs/assets/agctx-overview.ko.png" alt="agctx 구조: Personal·Company·Team 프로필을 여러 프로젝트에 apply·sync하고, 프로젝트마다 생성된 AGENTS.md·CLAUDE.md 등을 Codex·Claude Code·Antigravity가 읽는다. 팀·조직 프로필은 Git 원격으로 clone·pull·push한다." width="880">
  </picture>

</p>

`profile create` → `profile setup` → `profile apply`/`profile sync` 한 흐름으로, **프로필**(공통 지침 정본)를 만들어 **프로젝트 파일**로 적용하면 **여러 AI 에이전트**가 같은 기준으로 작업합니다.

## ❓ 이런 문제를 해결해요

**TDD·검증·보안·문서화 같은 작업 원칙을 이미 CLAUDE.md에 정해 뒀는데, 프로젝트와 AI 도구가 늘어날 때마다 같은 걸 다시 세팅하고 있진 않나요?**

agctx는 그 기준을 프로필로 관리하고 프로젝트에 적용하면 호환 에이전트들이 읽는 파일을 한 번에 적용합니다. 프로필에서 기준을 바꾸면 동기화로 프로젝트마다 다시 손대지 않아도 되고 각 프로젝트만의 도메인 규칙·세팅은 그대로 남습니다.

> 팀·조직 프로필은 Git 원격으로 공유합니다. 구성원은 `profile clone`·`pull`로 받고, CI는 `agctx check`로 저장소가 최신 지침을 반영했는지 확인합니다. 절차는 [팀과 Git으로 공유하기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/team-sharing.md)에 있습니다.

## 핵심 목표

> 여러 에이전트와 개발자가 동일한 공통 지침을 기준으로 작업·협업합니다.
>
> 용도별 프로필(공통 지침 저장소, Personal·Company·Team·Workspace 등)을 생성·관리하고 프로젝트마다 선택해 적용합니다.

개발자와 에이전트마다 달라지는 작업 방식·지침·검증 기준을 줄여 일관된 협업 기준을 유지합니다.

프로필의 공통 지침은 단일 정본으로 관리하고, 프로젝트는 자신의 `AGENTS.md`에 도메인 지침을 별도로 추가합니다.

개인 개발자도 프로젝트별 `Personal` 프로필을 나누어 재사용하고, 사용하는 AI 도구가 바뀌어도 같은 지침을 유지할 수 있습니다. 반복 설정과 프로젝트 사이의 규칙 드리프트를 줄여 관리와 개발을 더 편하게 만듭니다.

> [!NOTE]
> agctx는 프로필의 공통 지침을 프로젝트와 여러 에이전트에 배포합니다. 코드베이스를 분석해 프로젝트 지침을 자동으로 작성하지는 않습니다. [이유 보기](#지원하지-않는-기능)

## 사용 사례

### 개인 개발

- **이렇게 사용합니다:** 프로젝트 성격별 Personal Profile을 만들고 `profile setup`으로 지침을 구성한 뒤, 각 프로젝트에 `profile apply`으로 적용합니다.
- **기대 효과:** AI 도구를 바꾸거나 새 프로젝트를 시작해도 같은 개발 기준을 재사용합니다.

### 팀 협업

- **이렇게 사용합니다:** 팀 Profile을 Git 저장소로 공유하고, 구성원이 `profile clone`·`pull`한 뒤 담당 프로젝트에 적용합니다. 검토한 버전에만 머물려면 `--pin`으로 커밋에 고정합니다.
- **기대 효과:** 팀의 공통 지침 갱신을 같은 이력으로 검토·배포하고 개인별 설정 차이를 줄입니다.

### 조직 표준

- **이렇게 사용합니다:** 조직 Profile의 공통 기준을 Git으로 관리하고, 팀·프로젝트는 각자의 도메인 지침을 프로젝트 `AGENTS.md`에 추가합니다.
- **기대 효과:** 회사 공통 기준과 프로젝트별 요구사항을 섞지 않고 독립적으로 관리합니다. CI에서 `agctx check --refresh`로 각 저장소가 최신 기준을 반영했는지 확인합니다.

## 시작하기

> 설치부터 첫 적용까지는 [빠른 시작](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/getting-started/quick-start.md), 상황별 사용법은 [목적별 가이드](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/README.md#목적별-가이드)에서 확인할 수 있습니다.

> 실행 환경: Node.js 22 LTS 이상

```bash
npm install -g agent-context-manager

agctx profile create company --scope company
agctx profile setup company --tdd recommended --security strict
agctx profile apply company /path/to/project
```

적용하면 에이전트별 지침 파일과 관리 기록이 한 번에 만들어집니다. 아래는 마지막 명령의 실제 출력입니다.

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

> [!Tip]
> 터미널에서 `agctx`를 입력하면 TUI로 모든 기능을 간편하게 사용할 수 있습니다.
>
> 옵션을 직접 전달하는 방식은 자동화나 반복 실행에 사용할 수 있습니다.

개인 프로필은 `~/.agctx/profiles/<name>`에 저장됩니다. 프로젝트의 도메인 지침은 적용 후 프로젝트의 `AGENTS.md`에 별도로 추가합니다.

프로필 생성·setup·적용·동기화, Git 공유, 저장소 검사, 에이전트 전달 확인, 여러 저장소 동기화·PR 명령을 제공합니다. 세부 계약과 구현 기록은 [현재 아키텍처](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/contributing/architecture.md)와 [구현 계획](https://github.com/IsthisLee/agent-context-manager/tree/main/docs/discussion/architecture/)에서 확인합니다.

### 에이전트에게 맡기기

에이전트용 스킬을 설치하면 "이 저장소 지침이 최신인지 확인해 줘"처럼 말로 agctx를 맡길 수 있습니다. 스킬은 쓰기 명령 전에 `--dry-run` 결과를 보여 주고 승인을 받게 합니다. 프로필 게시·PR용 `agctx-author` 스킬은 이름으로 부를 때만 쓰입니다.

```bash
DISABLE_TELEMETRY=1 npx skills add IsthisLee/agent-context-manager --skill '*' -a claude-code -a codex -a antigravity
```

skills CLI는 익명 사용 통계를 보내며, 위처럼 `DISABLE_TELEMETRY=1`을 붙이면 보내지 않습니다. 자세한 내용은 [에이전트에게 agctx를 맡기기](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/agent-skills.md)에 있습니다.

### 검증의 범위

저장소 개발자는 `pnpm run check`로 agctx 자체의 형식 검사·문서 계약·CLI 평가를 확인합니다. 이 명령은 대상 프로젝트의 테스트를 대신 실행하거나 에이전트의 코드 품질을 보증하는 명령이 아닙니다. 대상 프로젝트의 실제 검증은 해당 프로젝트가 제공하는 명령을 에이전트가 실행하며, 프로필에는 그 검증을 요구하는 지침만 선택해 기록할 수 있습니다.

## 핵심 기능

- `agctx profile create [<name>] [--scope <scope>]` — `personal`, `company`, `team`, `workspace` 용도별 프로필 생성; 이름을 생략하면 TUI 입력
- `agctx profile list [--scope <scope>]` — scope별 프로필 목록·선택·관리; TUI에서는 scope를 먼저 선택
- `agctx profile setup [<name>]` — scope별 프로필 선택 후 하네스 동작·TDD·변경 검토·검증·문서화·보안 지침 설정; 생략하면 전체 TUI
- `agctx profile remove [<name>]` — 확인 후 선택한 프로필 삭제; 적용된 프로젝트 파일은 유지
- `agctx profile apply <name> <project> [--pin]` — 선택한 프로필을 프로젝트에 적용하고 적용한 프로필 버전을 기록; `--pin`이면 그 커밋에 고정
- `agctx profile sync <project>` — 프로젝트에 기록된 프로필로 관리 영역만 다시 적용
- `agctx profile resolve <project>` — 관리 영역 안에서 고친 내용을 밖으로 옮기고 관리 영역을 다시 생성; 마지막 적용본을 모르면 `--discard`로 백업 후 재생성, `--edit`로 VS Code 3-way merge
- 에이전트별 지침 파일 생성·동기화
- `agctx profile clone|status|pull|push|connect` — 표준 Git 원격으로 프로필 공유; 프로젝트 파일은 건드리지 않고, 받을 지침에 숨은 문자가 있으면 멈춤
- `agctx check [--refresh] <project>` — 관리 영역 충돌·숨은 문자·뒤처짐을 파일을 바꾸지 않고 종료 코드로 확인(CI용)
- `agctx repos list|status|sync|pr` — 프로필을 적용한 저장소들을 한 번에 확인·동기화하고, 고정한 저장소는 저장소마다 PR로 갱신; 예약 봇은 `repos pr --targets <file> --yes`
- `agctx explain [<path>]` — 그 폴더에서 시작한 Codex·Claude Code·Antigravity가 읽는 지침 파일과 이유를 보여 주고, 어느 에이전트에도 닿지 않는 파일이 있으면 종료 코드 4
- `agctx verify [--probe] [<path>]` — 에이전트 세션 기록으로 지침 파일이 실제로 들어갔는지 확인; `--probe`는 승인 뒤 임시 사본에서 에이전트를 한 번씩 실행
- 에이전트용 스킬 `agctx`·`agctx-author` — 에이전트에게 말로 agctx를 맡길 때 명령과 승인 규칙을 알려 줌
- 모노레포와 APM — 하위 폴더 `AGENTS.md`마다 Claude Code가 읽는 `CLAUDE.md` 연결 파일을 만들고, Microsoft APM의 `managed_section` 블록과 함께 쓰며, APM 기본 모드가 만든 파일에는 쓰지 않고 멈춤
- 모든 명령 — `--json` 결과 문서, 뒤처짐·충돌·숨은 문자를 구분하는 종료 코드, 터미널이 아니면 `--yes` 확인, `agctx <명령> --help`
- `agctx config lang <ko|en>` — 표시·생성 언어 설정; 기본은 영어이고 `--lang`·`AGCTX_LANG`로도 지정, 첫 대화형 실행에서 한 번 선택해 저장

## 지원 에이전트

프로필을 프로젝트에 적용하면 아래 에이전트별 지침 파일을 생성·동기화합니다. `AGENTS.md`는 여러 에이전트가 함께 읽는 공통 표준입니다.


| 에이전트                   | 생성 파일                             |
| ---------------------- | --------------------------------- |
| Codex 등 (AGENTS.md 표준) | `AGENTS.md`                       |
| Claude Code            | `CLAUDE.md`                       |
| Antigravity            | `.agents/rules/agctx.md`        |

적용하면 마지막으로 쓴 관리 영역 원문도 `.agctx/base/`에 함께 기록합니다. 관리 영역 충돌을 풀 때 기준이 되므로 git에 커밋하세요.

에이전트가 파일을 실제로 읽는지는 시작한 폴더에 따라 달라집니다. Codex는 하위 폴더의 `AGENTS.md`를 그 폴더에서 시작할 때만 읽고, Claude Code는 `CLAUDE.md`가 가져오지 않는 `AGENTS.md`를 읽지 않습니다. 모노레포에서는 하위 폴더 `AGENTS.md`마다 `@AGENTS.md`를 가져오는 `CLAUDE.md` 연결 파일을 만들고, 사람이 둔 `CLAUDE.md`는 건드리지 않습니다. 폴더마다 `agctx explain <폴더>`로 확인하세요.


## 지원하지 않는 기능

**코드베이스를 분석해 프로젝트 지침을 자동으로 작성하는 기능은 지원하지 않습니다.** agctx는 프로필의 공통 지침을 프로젝트와 여러 에이전트에 배포합니다. 프로젝트 고유 지침은 프로젝트가 소유하며 agctx가 대신 작성하지 않습니다.


| 이유                    | 근거                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| 각 에이전트가 이미 제공합니다.     | Claude Code와 Codex의 `/init`이 코드베이스를 분석해 지침 초안을 만듭니다.                                            |
| 공식 가이드가 권하지 않는 내용입니다. | Anthropic은 에이전트가 코드를 읽어 알아낼 수 있는 내용과 파일별 설명을 지침에서 빼라고 안내합니다. 지침에 넣을 것은 추측할 수 없는 명령·관례·결정·함정입니다. 지침이 길어지면 중요한 규칙이 묻혀 무시된다고도 경고합니다. |
| 효과가 확인되지 않았습니다.       | 연구에서 에이전트는 컨텍스트 파일의 지시를 따랐지만 과제 성공률은 일반적으로 오르지 않았고 추론 비용은 평균 20% 넘게 늘었습니다. 저장소 개요는 도움이 되지 않았습니다. |
| agctx의 범위 밖입니다.     | 깊은 분석에는 모델 호출이 필요합니다. agctx는 모델 호출과 에이전트 런타임을 다루지 않습니다.                                       |


`/init`으로 만든 초안은 사람이 다듬은 뒤 `AGENTS.md`의 `프로젝트 규칙 확장` 영역에 두세요. 여러 에이전트가 공통으로 읽는 표준이 `AGENTS.md`이기 때문입니다. `CLAUDE.md`에 남긴다면 agctx 관리 블록 밖에 두세요. 관리 영역 안을 고치면 다음 `profile sync`가 충돌로 멈춥니다. 이때 `profile resolve`가 그 편집을 관리 영역 밖으로 옮겨 풀어 줍니다. 결정 이유와 출처는 [ADR 0006](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/adr/0006-no-codebase-analysis-guidance.md)과 [참고 자료](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/references.md#프로젝트-지침-자동-생성에-관한-근거)에 있습니다.

## 🧭 아키텍처 방향과 진행 상태

agctx의 구현은 “공통 지침을 어디에 두고, 누가 무엇을 변경하는가”를 기준으로 단계적으로 관리합니다. 아래 표는 각 논의 문서의 제안 요약을 사용자 관점에서 압축한 것입니다. `Proposed` 항목은 아직 현재 동작으로 보장하지 않는 후속 작업입니다.


| 주제                                                                                                                               | 대상과 목표                                             | 중요도·상태                  | 다음 작업               |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------- | ------------------- |
| [프로필 모델과 저장소](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/profile-model.md)               | 사용자·조직의 Personal·Company·Team·Workspace별 공통 지침 저장소 | Critical · Implemented  | 조직 공유 계약 검토         |
| [setup과 지침 옵션](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/setup-and-guidance.md)         | 사용자·CLI가 프로필의 TDD·변경 검토·검증·문서화·보안 지침을 선택 구성           | High · Implemented      | preset·설정 diff 고도화  |
| [프로젝트 적용](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/project-application.md)             | 선택한 프로필을 프로젝트에 적용하고 도메인 지침을 분리 보존                  | Critical · Implemented  | 충돌·복구 확정            |
| [에이전트 산출물 동기화](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/agent-sync.md)                 | 프로필에서 관리 블록만 에이전트별 지침 파일에 생성·동기화                   | High · Implemented      | manifest·drift 고도화  |
| [자연어 요청을 통한 사용](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/agent-mediated-usage.md)      | 사용자·AI 에이전트·TUI·CLI의 책임과 안전한 자동화 경계                | High · Implementing     | 배포 패키지 기준 에이전트 시나리오 평가 |
| [관리 산출물의 안전한 동기화](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/managed-artifact-safety.md) | 관리 파일은 부분 갱신하고 사용자 수정·충돌·복구를 보장                    | Critical · Implementing | 마커 없는 루트 파일 정책·여러 파일 롤백 |
| [Git 기반 프로필 관리](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/git-profile-management.md) | 팀·조직이 표준 Git 원격으로 프로필을 공유하고 적용한 버전을 기록·확인 | Critical · Implemented | 없음 |
| [스코프 확장과 지침 합성](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/scope-composition.md)         | 사용자 정의·공유 가능한 지침 계층과 프로젝트의 다계층 상속·병합               | Medium · Proposed       | 검증 후 합성 최소 프로토타입    |


### 제안 요약

각 문서는 코드 기능만이 아니라 대상 계층, 도입 이유, 중요도, 선행·후속·연관 작업, 구현 전에 결정할 계약을 함께 관리합니다. 아래는 그 정보를 영역별로 압축한 지도이며, 상세한 현재 상태와 구현 기록은 각 문서에서 확인할 수 있습니다.

#### 1. 프로필과 공통 지침 구성


| 주제                                                                                                                       | 목적·대상 계층                                                                 | 중요도·상태                 | 결정할 것과 관계                                    |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------- | -------------------------------------------- |
| [프로필 모델과 저장소](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/profile-model.md)       | Personal·Company·Team·Workspace별 공통 지침을 분리·재사용 · 사용자·조직 ↔ CLI ↔ 프로필      | Critical · Implemented | 경로·이름·scope·기본 선택; 모든 후속 기능의 선행              |
| [setup과 지침 옵션](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/setup-and-guidance.md) | 필요한 하네스·TDD·변경 검토·검증·문서화·보안 지침만 선택 · 사용자 ↔ CLI ↔ 프로필 `AGENTS.md`            | High · Implemented     | preset·기본값·재실행·대화형/비대화형; 프로필 모델 후, 프로젝트 적용 전 |
| [스코프 확장과 지침 합성](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/scope-composition.md) | scope를 공유·재사용하는 지침 계층으로 확장하고 다계층 상속·병합 · 사용자·조직 ↔ CLI ↔ 프로필·scope ↔ 프로젝트 | Medium · Proposed      | 병합·충돌 규칙과 scope 공유 형식; 검증 게이트 후 착수           |
| [Git 기반 프로필 관리](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/git-profile-management.md) | 공통 지침 프로필을 Git 원격으로 공유·갱신 · 관리자·구성원 ↔ CLI ↔ Git 원격 ↔ 프로필 | Critical · Implemented | 원격 연결·적용 버전 기록·고정·check; 프로필 모델 후 |


#### 2. 프로젝트 적용과 에이전트 전달


| 주제                                                                                                                               | 목적·대상 계층                                               | 중요도·상태                  | 결정할 것과 관계                                      |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------- | ---------------------------------------------- |
| [프로젝트 적용](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/project-application.md)             | 공통 지침과 프로젝트 도메인 지침을 분리해 함께 사용 · 사용자 ↔ CLI ↔ 프로필 ↔ 프로젝트 | Critical · Implemented  | 대상·병합·승인·적용 기록; setup 후, 동기화 전                 |
| [에이전트 산출물 동기화](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/agent-sync.md)                 | 에이전트별 파일 형식에 같은 공통 기준 전달 · 프로필 ↔ CLI ↔ 프로젝트 산출물        | High · Implemented      | 어댑터·포인터·파일 소유권·drift; 프로젝트 적용 후                |
| [관리 산출물의 안전한 동기화](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/managed-artifact-safety.md) | 재적용·업데이트 때 사용자 내용과 수동 변경을 보호 · CLI/TUI ↔ 프로필 ↔ 프로젝트 파일 | Critical · Implementing | 관리 블록·hash·dry-run·충돌·백업·복구; 적용·동기화의 안전성 후속 작업 |


#### 3. 사용자·에이전트 자동화 경계


| 주제                                                                                                                          | 목적·대상 계층                                                             | 중요도·상태          | 결정할 것과 관계                                     |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------- | --------------------------------------------- |
| [자연어 요청을 통한 사용](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/discussion/architecture/topics/agent-mediated-usage.md) | AI 에이전트가 모호한 요청으로 잘못된 대상을 변경하지 않게 함 · 사용자 ↔ AI 에이전트 ↔ CLI/TUI ↔ 프로젝트 | High · Implementing | 명시적 대상·기계 판독 결과·승인·종료 코드, 에이전트용 스킬과 전달 확인 구현; 배포 패키지 기준 에이전트 시나리오 평가가 다음 작업 |


현재의 선행 구조는 프로필 생성 → 지침 설정 → 프로젝트 적용 → 에이전트 산출물 동기화입니다. 각 제안의 상태, 선행·후속·연관 제안, 후속 작업, 권장 다음 작업, 결정할 사항은 [아키텍처 논의 인덱스](https://github.com/IsthisLee/agent-context-manager/tree/main/docs/discussion/architecture/)에서 확인할 수 있습니다.

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

- [기여 가이드](https://github.com/IsthisLee/agent-context-manager/blob/main/CONTRIBUTING.md)
- [보안 정책](https://github.com/IsthisLee/agent-context-manager/blob/main/SECURITY.md)
- [행동 규범](https://github.com/IsthisLee/agent-context-manager/blob/main/CODE_OF_CONDUCT.md)
- [이슈 제보](https://github.com/IsthisLee/agent-context-manager/issues)

---

[Apache License 2.0](LICENSE) · Built with Codex, Claude Code, and Antigravity.