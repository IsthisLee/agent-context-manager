# Agentic — AI 에이전트 지침 관리

[![CI](https://img.shields.io/github/actions/workflow/status/IsthisLee/agentic/ci.yml?branch=main&label=CI&logo=github)](https://github.com/IsthisLee/agentic/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/IsthisLee/agentic/codeql.yml?branch=main&label=CodeQL&logo=github)](https://github.com/IsthisLee/agentic/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/IsthisLee/agentic/badge)](https://securityscorecards.dev/viewer/?uri=github.com/IsthisLee/agentic)
[![npm](https://img.shields.io/npm/v/@isthis/agentic?logo=npm&color=cb3837)](https://www.npmjs.com/package/@isthis/agentic)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/en/about/previous-releases)
[![last commit](https://img.shields.io/github/last-commit/IsthisLee/agentic)](https://github.com/IsthisLee/agentic/commits/main)
[![Supported agents](https://img.shields.io/badge/agents-Claude%20Code%20%C2%B7%20Gemini%20%C2%B7%20Cursor%20%C2%B7%20Copilot-6f42c1)](https://github.com/IsthisLee/agentic#지원-에이전트)

**한국어** · [English](README.en.md)

## 개발자가 달라도, 팀이 달라도, AI 에이전트가 달라도 프로젝트의 개발 기준은 하나로.
>
> Agentic은 개인·조직별 에이전틱 개발 지침을 프로필로 생성·설정하고, 이를 로컬 또는 Git 기반으로 관리하며 프로젝트와 여러 AI 에이전트에 안전하게 적용·동기화하는 패키지입니다.

<p align="center">
  <img src="https://raw.githubusercontent.com/IsthisLee/agentic/main/docs/assets/agentic.gif" alt="Agentic 사용 흐름 — profile create → setup → apply·sync로 프로필을 만들어 프로젝트에 적용하고 여러 AI 에이전트가 같은 기준으로 작업" width="800">
</p>

`profile create` → `profile setup` → `profile apply`/`profile sync` 한 흐름으로, **프로필**(공통 지침 정본)를 만들어 **프로젝트 파일**로 적용하면 **여러 AI 에이전트**가 같은 기준으로 작업합니다.

## 핵심 목표

- 여러 에이전트가 동일한 공통 지침을 기준으로 작업합니다.
- 다양한 개발자가 동일한 에이전틱 개발 지침으로 협업합니다.
- Personal·Company·Team·Workspace 등 용도별 프로필(공통 지침 저장소)를 생성·관리하고 프로젝트마다 선택해 적용합니다.

개발자와 에이전트마다 달라지는 작업 방식·지침·검증 기준을 줄여 일관된 협업 기준을 유지합니다. 프로필의 공통 지침은 단일 정본으로 관리하고, 프로젝트는 자신의 `AGENTS.md`에 도메인 지침을 별도로 추가합니다.

개인 개발자도 프로젝트별 `Personal` 프로필을 나누어 재사용하고, 사용하는 AI 도구가 바뀌어도 같은 지침을 유지할 수 있습니다. 반복 설정과 프로젝트 사이의 규칙 드리프트를 줄여 관리와 개발을 더 편하게 만듭니다.

현재 프로필은 로컬에서 관리합니다. 조직이 Git으로 프로필을 공유·갱신하는 기능은 [후속 아키텍처 논의](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/profile-model.md)로 관리하며, 현재 제공 기능으로 표현하지 않습니다.

## 사용 사례

> 아래 Git 기반 흐름은 Profile 원격 관리 기능이 구현된 뒤의 사용 기준입니다. 현재 릴리스는 로컬 프로필 관리·적용·동기화만 제공합니다.

### 개인 개발

- **이렇게 사용합니다:** 프로젝트 성격별 Personal Profile을 만들고 `profile setup`으로 지침을 구성한 뒤, 각 프로젝트에 `profile apply`으로 적용합니다.
- **기대 효과:** AI 도구를 바꾸거나 새 프로젝트를 시작해도 같은 개발 기준을 재사용합니다.

### 팀 협업

- **이렇게 사용합니다:** 팀 Profile을 Git 저장소로 공유하고, 구성원이 clone·pull한 뒤 담당 프로젝트에 적용합니다.
- **기대 효과:** 팀의 공통 지침 갱신을 같은 이력으로 검토·배포하고 개인별 설정 차이를 줄입니다.

### 조직 표준

- **이렇게 사용합니다:** 조직 Profile의 공통 기준을 Git으로 관리하고, 팀·프로젝트는 각자의 도메인 지침을 프로젝트 `AGENTS.md`에 추가합니다.
- **기대 효과:** 회사 공통 기준과 프로젝트별 요구사항을 섞지 않고 독립적으로 관리합니다.

[빠른 시작](#빠른-시작)에서 설치·TUI 실행·프로젝트 적용 순서를 확인할 수 있습니다.

## 핵심 기능

- `agentic profile create [<name>] [--scope <scope>]` — `personal`, `company`, `team`, `workspace` 용도별 프로필 생성; 이름을 생략하면 TUI 입력
- `agentic profile list [--scope <scope>]` — scope별 프로필 목록·선택·관리; TUI에서는 scope를 먼저 선택
- `agentic profile setup [<name>]` — scope별 프로필 선택 후 하네스 동작·TDD·리뷰·검증·문서화·보안 지침 설정; 생략하면 전체 TUI
- `agentic profile remove [<name>]` — 확인 후 선택한 프로필 삭제; 적용된 프로젝트 파일은 유지
- `agentic profile apply <name> <project>` — 선택한 프로필을 프로젝트에 적용
- 에이전트별 지침 파일 생성·동기화
- `agentic config lang <ko|en>` — 표시·생성 언어 설정; 기본은 한국어이고 `--lang`·`AGENTIC_LANG`로도 지정, 첫 대화형 실행에서 한 번 선택해 저장

## 지원 에이전트

프로필을 프로젝트에 적용하면 아래 에이전트별 지침 파일을 생성·동기화합니다. `AGENTS.md`는 여러 에이전트가 함께 읽는 공통 표준입니다.

| 에이전트 | 생성 파일 |
| --- | --- |
| Claude Code | `CLAUDE.md` |
| Gemini | `.gemini/rules/agentic.md` |
| Cursor | `.cursor/rules/agentic.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Codex · Antigravity 등 (AGENTS.md 표준) | `AGENTS.md` |

## 🧭 아키텍처 방향과 진행 상태

Agentic의 구현은 “공통 지침을 어디에 두고, 누가 무엇을 변경하는가”를 기준으로 단계적으로 관리합니다. 아래 표는 각 논의 문서의 제안 요약을 사용자 관점에서 압축한 것입니다. `Proposed` 항목은 아직 현재 동작으로 보장하지 않는 후속 작업입니다.

| 주제                                                                                                                                         | 대상과 목표                                                      | 중요도·상태             | 다음 작업                   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------- | --------------------------- |
| [프로필 모델과 저장소](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/profile-model.md)                       | 사용자·조직의 Personal·Company·Team·Workspace별 공통 지침 저장소 | Critical · Implemented  | 조직 공유 계약 검토         |
| [setup과 지침 옵션](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/setup-and-guidance.md)                | 사용자·CLI가 프로필의 TDD·리뷰·검증·문서화·보안 지침을 선택 구성   | High · Implemented      | preset·설정 diff 고도화     |
| [프로젝트 적용](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/project-application.md)                   | 선택한 프로필을 프로젝트에 적용하고 도메인 지침을 분리 보존        | Critical · Implemented  | 충돌·복구 확정              |
| [에이전트 산출물 동기화](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/agent-sync.md)                   | 프로필에서 관리 블록만 에이전트별 지침 파일에 생성·동기화          | High · Implemented      | manifest·drift 고도화       |
| [자연어 요청을 통한 사용](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/agent-mediated-usage.md)        | 사용자·AI 에이전트·TUI·CLI의 책임과 안전한 자동화 경계           | High · Proposed         | 비대화형 CLI·JSON·종료 코드 |
| [관리 산출물의 안전한 동기화](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/managed-artifact-safety.md) | 관리 파일은 부분 갱신하고 사용자 수정·충돌·복구를 보장           | Critical · Implementing | 충돌 시각화·복구            |

### 제안 요약

각 문서는 코드 기능만이 아니라 대상 계층, 도입 이유, 중요도, 선행·후속·연관 작업, 구현 전에 결정할 계약을 함께 관리합니다. 아래는 그 정보를 영역별로 압축한 지도이며, 상세한 현재 상태와 구현 기록은 각 문서에서 확인할 수 있습니다.

#### 1. 프로필과 공통 지침 구성

| 주제                                                                                                                          | 목적·대상 계층                                                                        | 중요도·상태            | 결정할 것과 관계                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| [프로필 모델과 저장소](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/profile-model.md)        | Personal·Company·Team·Workspace별 공통 지침을 분리·재사용 · 사용자·조직 ↔ CLI ↔ 프로필  | Critical · Implemented | 경로·이름·scope·기본 선택; 모든 후속 기능의 선행                     |
| [setup과 지침 옵션](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/setup-and-guidance.md) | 필요한 하네스·TDD·리뷰·검증·문서화·보안 지침만 선택 · 사용자 ↔ CLI ↔ 프로필 `AGENTS.md` | High · Implemented     | preset·기본값·재실행·대화형/비대화형; 프로필 모델 후, 프로젝트 적용 전 |

#### 2. 프로젝트 적용과 에이전트 전달

| 주제                                                                                                                                         | 목적·대상 계층                                                                       | 중요도·상태             | 결정할 것과 관계                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------- |
| [프로젝트 적용](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/project-application.md)                   | 공통 지침과 프로젝트 도메인 지침을 분리해 함께 사용 · 사용자 ↔ CLI ↔ 프로필 ↔ 프로젝트 | Critical · Implemented  | 대상·병합·승인·적용 기록; setup 후, 동기화 전                         |
| [에이전트 산출물 동기화](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/agent-sync.md)                   | 에이전트별 파일 형식에 같은 공통 기준 전달 · 프로필 ↔ CLI ↔ 프로젝트 산출물            | High · Implemented      | 어댑터·포인터·파일 소유권·drift; 프로젝트 적용 후                     |
| [관리 산출물의 안전한 동기화](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/managed-artifact-safety.md) | 재적용·업데이트 때 사용자 내용과 수동 변경을 보호 · CLI/TUI ↔ 프로필 ↔ 프로젝트 파일   | Critical · Implementing | 관리 블록·hash·dry-run·충돌·백업·복구; 적용·동기화의 안전성 후속 작업 |

#### 3. 사용자·에이전트 자동화 경계

| 주제                                                                                                                                  | 목적·대상 계층                                                                                           | 중요도·상태     | 결정할 것과 관계                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------- |
| [자연어 요청을 통한 사용](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/agent-mediated-usage.md) | AI 에이전트가 모호한 요청으로 잘못된 대상을 변경하지 않게 함 · 사용자 ↔ AI 에이전트 ↔ CLI/TUI ↔ 프로젝트 | High · Proposed | 명시적 대상·기계 판독 결과·승인·종료 코드; 현재 CLI/TUI 위의 후속 작업 |

현재의 선행 구조는 프로필 생성 → 지침 설정 → 프로젝트 적용 → 에이전트 산출물 동기화입니다. 각 제안의 상태, 선행·후속·연관 제안, 후속 작업, 권장 다음 작업, 결정할 사항은 [아키텍처 논의 인덱스](https://github.com/IsthisLee/agentic/tree/main/docs/discussion/architecture/)에서 확인할 수 있습니다.

## 빠른 시작

Agentic은 터미널에서 TUI(Terminal User Interface)로 프로필과 지침을 설정할 수 있습니다. `agentic profile setup`만 실행하면 scope별 프로필 목록에서 대상을 고른 뒤 모든 지침 설정을 입력합니다.

### 전제 조건

- 실행 환경: Node.js 24 LTS 이상
- 일반 사용자: `npm install --global @isthis/agentic` (짧게는 `npm install -g`)
- 저장소 기여자: 저장소 루트에서 `pnpm install` 후 개발용 명령 실행

짧은 명령어가 필요하면 `agt`를 `agentic`의 별칭으로 사용할 수 있습니다.

```bash
pnpm install
node bin/agentic.mjs
```

옵션을 직접 전달하는 방식은 자동화나 반복 실행에 사용할 수 있습니다.

```bash
npm install -g @isthis/agentic
agentic profile create company --scope company
agentic profile setup company --tdd recommended --security strict
agentic profile apply company /path/to/project
```

개인 프로필은 `~/.agentic-profiles/<name>`에 저장됩니다. 프로젝트의 도메인 지침은 적용 후 프로젝트의 `AGENTS.md`에 별도로 추가합니다.

프로필 생성·setup·적용·동기화 명령을 제공합니다. 세부 계약과 구현 기록은 [현재 아키텍처](https://github.com/IsthisLee/agentic/tree/main/docs/architecture/)와 [구현 계획](https://github.com/IsthisLee/agentic/tree/main/docs/discussion/architecture/)에서 확인합니다.

### 검증의 범위

저장소 개발자는 `pnpm run check`로 Agentic 자체의 문법·문서 계약·CLI 평가를 확인합니다. 이 명령은 대상 프로젝트의 테스트를 대신 실행하거나 에이전트의 코드 품질을 보증하는 명령이 아닙니다. 대상 프로젝트의 실제 검증은 해당 프로젝트가 제공하는 명령을 에이전트가 실행하며, 프로필에는 그 검증을 요구하는 지침만 선택해 기록할 수 있습니다.

## 문서

- [제품 방향](https://github.com/IsthisLee/agentic/blob/main/docs/product-direction.md)
- [구현 원리](https://github.com/IsthisLee/agentic/blob/main/docs/implementation-principles.md)
- [사용자 워크플로](https://github.com/IsthisLee/agentic/blob/main/docs/workflow.md)
- [CLI Reference](https://github.com/IsthisLee/agentic/blob/main/docs/cli-reference.md)
- [공개 저장소 운영](https://github.com/IsthisLee/agentic/blob/main/docs/repository-operations.md)
- [아키텍처 구현 계획](https://github.com/IsthisLee/agentic/tree/main/docs/discussion/architecture/)
- [외부 참고 문헌](https://github.com/IsthisLee/agentic/blob/main/docs/references.md)

## 공개 프로젝트 참여

- [기여 가이드](https://github.com/IsthisLee/agentic/blob/main/CONTRIBUTING.md)
- [보안 정책](https://github.com/IsthisLee/agentic/blob/main/SECURITY.md)
- [행동 규범](https://github.com/IsthisLee/agentic/blob/main/CODE_OF_CONDUCT.md)
- [이슈 제보](https://github.com/IsthisLee/agentic/issues)

---

[Apache License 2.0](LICENSE) · Built with Codex, Claude Code, and Antigravity.
