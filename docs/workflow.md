# 사용자 워크플로

이 문서는 배포된 `@isthis/agentic`을 사용해 공통 개발 지침을 만들고 프로젝트에 적용하는 최종 사용자 흐름을 설명한다.

가장 간단한 시작점은 `agt` 또는 `agentic`만 입력해 메인 TUI를 여는 것이다. 메인 메뉴에서 Core 관리·생성·설정과 도움말에 접근할 수 있다.

## 1. Core 생성

```bash
npm install -g @isthis/agentic
agt core create
```

TUI에서 Core 이름과 용도를 선택한다. 자동화나 반복 실행이 필요할 때만 `agt core create <name> --scope <scope>`처럼 옵션을 직접 전달한다.

scope는 `personal`, `company`, `team`, `workspace` 중 Core의 사용 범위를 나타낸다. 기존 Core를 찾을 때는 `agt core list`에서 scope를 먼저 선택하거나 `agt core list --scope company`처럼 직접 필터링한다.

Core는 공통 지침을 보관하는 사용자·조직 소유 저장소다. 생성만으로 대상 프로젝트는 변경되지 않는다.

## 2. Core 설정

```bash
agt setup
```

TUI에서 scope와 이름이 함께 표시된 Core 선택 메뉴를 먼저 사용하고, 이어서 TDD·리뷰·검증·문서화·보안·하네스 동작 지침을 선택한다. 각 항목의 설명·현재값을 확인하고, 마지막 설정 요약을 검토한 뒤 저장을 승인한다. 자동화가 필요하면 `agt setup --core <name> --tdd <level>`처럼 옵션을 직접 전달한다. 에이전트는 설정 초안을 제안할 수 있지만 Core 정책의 최종 승인자는 사용자다.

## 3. 프로젝트에 적용

```bash
agentic init --core company /path/to/project
```

Agentic은 선택한 Core의 공통 지침을 프로젝트에 적용하고 에이전트별 지침 파일을 생성한다. 프로젝트의 도메인 지침은 프로젝트의 `AGENTS.md`에 별도로 추가한다. 적용·재동기화 때 `AGENTS.md`의 도메인 확장은 보존하지만, Agentic이 관리하는 에이전트별 포인터 파일은 재생성되므로 사용자는 변경 diff를 확인해야 한다.

## 4. 개발

사용자는 평소 사용하는 Codex·Claude Code·Cursor·Copilot 등 에이전트에 작업을 의뢰한다. 에이전트는 프로젝트의 `AGENTS.md`와 관련 문서를 읽고, 공통 지침과 프로젝트 도메인 지침에 따라 작업한다. Agentic은 에이전트 런타임을 실행하거나 통제하지 않는다.

모든 `agentic` 명령은 짧은 별칭인 `agt`로도 실행할 수 있다.

## 5. Core 변경과 프로젝트 동기화

```bash
agt setup
agt sync --core <name> /path/to/project
```

TUI에서 Core를 다시 선택·설정한 뒤, 동기화 대상 프로젝트와 적용할 Core를 명시해 `sync`를 실행한다. 동기화 후 생성 파일의 diff와 프로젝트 도메인 지침의 보존 여부를 확인한다. Core 업데이트가 프로젝트를 자동으로 변경하지 않는 것이 기본 원칙이다.

## 6. Core 삭제

```bash
agt core remove
```

TUI에서 삭제할 Core를 선택하고 삭제 대상과 영향을 확인한 뒤 최종 승인한다. 자동화 환경에서는 `agt core remove <name> --yes`를 사용한다. 삭제되는 것은 사용자 Core의 원본과 설정뿐이며, 이미 프로젝트에 적용된 `AGENTS.md`, 포인터 파일, `agentic.project.json`은 변경하지 않는다.

## 7. Core 관리 메뉴

```bash
agt core list
```

TUI에서 scope별 Core 목록을 확인한 뒤 하나를 선택하면 지침 설정, 프로젝트 적용, 프로젝트 동기화, 상세 보기, 삭제 중 원하는 작업을 이어서 실행할 수 있다. 프로젝트 적용·동기화 시에는 현재 작업 폴더를 기준으로 디렉터리를 탐색해 선택하며, 파일은 선택할 수 없다. 자동화 환경에서는 각 명령어를 직접 사용한다.

## 명령의 소유권

| 주체 | 책임 |
| --- | --- |
| 사용자 | Core 선택·설정 승인, 적용 대상과 변경 diff 검토, 프로젝트 도메인 지침 관리 |
| Agentic | Core·지침 파일 생성, 선택된 Core의 동기화, 포인터 산출물 제공 |
| AI 에이전트 | 지침을 읽고 프로젝트 코드·테스트를 변경하며 결과를 보고 |
| 대상 프로젝트 | 비즈니스 코드·데이터·도메인 지침·검증 명령 보유 |

구체적인 CLI 옵션과 파일 형식은 [제품 방향](product-direction.md)과 [아키텍처 구현 계획](discussion/architecture/)의 현재 상태를 따른다.
