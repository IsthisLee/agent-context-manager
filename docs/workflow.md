# 사용자 워크플로

이 문서는 배포된 `@isthis/agentic`을 사용해 공통 개발 지침을 만들고 프로젝트에 적용하는 최종 사용자 흐름을 설명한다.

## 1. Core 생성

```bash
npm install --global @isthis/agentic
agentic core create company --scope company
```

이름과 `--scope`를 생략하면 Agentic이 TUI로 차례대로 입력을 받는다. 자동화가 필요하면 위와 같이 옵션을 직접 전달할 수 있다.

Core는 공통 지침을 보관하는 사용자·조직 소유 저장소다. 생성만으로 대상 프로젝트는 변경되지 않는다.

## 2. Core 설정

```bash
agentic setup --core company
```

사용자는 TDD, 리뷰, 검증, 문서화, 보안, 하네스 동작 지침을 선택한다. `--core`를 생략하면 scope와 이름이 함께 표시된 선택 메뉴에서 대상을 고르고, 세부 옵션을 생략하면 각 항목의 설명·현재값을 보여 주는 TUI에서 선택한다. 모든 선택이 끝나면 적용될 설정 요약을 확인하고 저장을 승인한다. 에이전트는 설정 초안을 제안할 수 있지만 Core 정책의 최종 승인자는 사용자다.

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
agentic setup --core company
agentic sync --core company /path/to/project
```

Core 정책을 바꾼 뒤 사용자가 명시적으로 `sync`를 실행한다. 동기화 후 생성 파일의 diff와 프로젝트 도메인 지침의 보존 여부를 확인한다. Core 업데이트가 프로젝트를 자동으로 변경하지 않는 것이 기본 원칙이다.

## 명령의 소유권

| 주체 | 책임 |
| --- | --- |
| 사용자 | Core 선택·설정 승인, 적용 대상과 변경 diff 검토, 프로젝트 도메인 지침 관리 |
| Agentic | Core·지침 파일 생성, 선택된 Core의 동기화, 포인터 산출물 제공 |
| AI 에이전트 | 지침을 읽고 프로젝트 코드·테스트를 변경하며 결과를 보고 |
| 대상 프로젝트 | 비즈니스 코드·데이터·도메인 지침·검증 명령 보유 |

구체적인 CLI 옵션과 파일 형식은 [제품 방향](product-direction.md)과 [아키텍처 구현 계획](discussion/architecture/)의 현재 상태를 따른다.
