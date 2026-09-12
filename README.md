# Agentic

> 여러 AI 에이전트가 동일한 프로젝트 개발 지침을 사용하도록, 지침을 생성·설정·동기화·적용하는 패키지입니다.

## 핵심 목표

- 다양한 개발자가 동일한 에이전틱 개발 지침으로 협업합니다.
- Personal·Company·Team·Workspace 등 용도별 Core(공통 지침 저장소)를 생성·관리하고 프로젝트마다 선택해 적용합니다.
- 여러 에이전트가 동일한 공통 지침을 기준으로 작업합니다.

개발자와 에이전트마다 달라지는 작업 방식·지침·검증 기준을 줄여 일관된 협업 기준을 유지합니다. Core의 공통 지침은 단일 정본으로 관리하고, 프로젝트는 자신의 `AGENTS.md`에 도메인 지침을 별도로 추가합니다.

## 핵심 기능

- `agentic core create [<name>]` — 용도별 Core 생성; 이름을 생략하면 TUI 입력
- `agentic setup [--core <name>]` — scope별 Core 선택 후 하네스 동작·TDD·리뷰·검증·문서화·보안 지침 설정; 생략하면 전체 TUI
- `agentic core remove [<name>]` — 확인 후 선택한 Core 삭제; 적용된 프로젝트 파일은 유지
- `agentic init --core <name> <project>` — 선택한 Core를 프로젝트에 적용
- 에이전트별 지침 파일 생성·동기화

## 빠른 시작

Agentic은 터미널에서 TUI(Terminal User Interface)로 Core와 지침을 설정할 수 있습니다. `agentic setup`만 실행하면 scope별 Core 목록에서 대상을 고른 뒤 모든 지침 설정을 입력합니다.

짧은 명령어가 필요하면 `agt`를 `agentic`의 별칭으로 사용할 수 있습니다.

```bash
agentic core create
agentic setup
```

옵션을 직접 전달하는 방식은 자동화나 반복 실행에 사용할 수 있습니다.

```bash
npm install -g @isthis/agentic
agentic core create company --scope company
agentic setup --core company --tdd recommended --security strict
agentic init --core company /path/to/project
```

개인 Core는 `~/.agentic-cores/<name>`에 저장됩니다. 프로젝트의 도메인 지침은 적용 후 프로젝트의 `AGENTS.md`에 별도로 추가합니다.

Core 생성·setup·적용·동기화 명령을 제공합니다. 세부 계약과 구현 기록은 [현재 아키텍처](docs/architecture/)와 [구현 계획](docs/discussion/architecture/)에서 확인합니다.

## 문서

- [제품 방향](docs/product-direction.md)
- [사용자 워크플로](docs/workflow.md)
- [CLI Reference](docs/cli-reference.md)
- [아키텍처 구현 계획](docs/discussion/architecture/)
- [외부 참고 문헌](docs/references.md)

## 라이선스

[Apache License 2.0](LICENSE)
