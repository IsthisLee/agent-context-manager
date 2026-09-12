# CLI Reference

`@isthis/agentic`은 `agentic`과 짧은 별칭 `agt`로 실행할 수 있다. 아래 문서는 현재 구현된 명령어와 옵션을 기준으로 한다.

## 설치와 실행

```bash
npm install --global @isthis/agentic
agt help
```

저장소 개발 환경에서는 고정된 pnpm 버전을 사용한다. npm 설치 사용자는 별도 설정 없이 `agentic`과 `agt`를 모두 사용할 수 있다.

## 공통 규칙

- `<값>`은 사용자가 입력하는 필수 위치 인자다.
- `[값]`은 생략할 수 있는 선택 인자다.
- TUI가 표시되는 명령은 터미널에서 옵션을 생략하면 선택·입력·확인 화면을 제공한다.
- CI·스크립트에서는 플래그를 직접 전달하거나 stdin 입력을 사용한다.
- `off`, `recommended`, `strict`는 지침 수준이며 대소문자를 구분한다.

## 명령어

### `core create`

새 Core와 초기 `AGENTS.md`를 만든다. Core는 기본적으로 `~/.agentic-cores/<name>`에 저장된다.

```bash
agt core create [<name>] [--scope <scope>]
```

| 인자·옵션 | 설명 | 기본값·허용값 |
| --- | --- | --- |
| `<name>` | Core 이름 | TUI에서 입력; 소문자·숫자·하이픈 1-64자 |
| `--scope <scope>` | Core의 용도 분류 | `personal` |
| `scope` | 분류값 | `personal`, `company`, `team`, `workspace` |

이름을 생략하면 TUI에서 이름과 scope를 선택하고 생성 여부를 확인한다.

### `core list`

등록된 Core를 scope별로 표시한다.

```bash
agt core list
```

터미널에서는 scope별 패널과 전체 개수를 표시하고, 파이프·스크립트 환경에서는 읽기 쉬운 텍스트 목록을 출력한다.

### `core remove`

선택한 Core의 원본과 설정을 삭제한다. 이미 프로젝트에 적용된 파일은 변경하지 않는다.

```bash
agt core remove [<name>] [--yes]
```

| 인자·옵션 | 설명 |
| --- | --- |
| `<name>` | 삭제할 Core 이름; TUI에서 선택 가능 |
| `--yes` | 자동화 환경에서 삭제 확인을 명시적으로 승인 |

터미널에서 이름과 `--yes`를 생략하면 TUI에서 Core를 선택하고 삭제 대상·영향을 보여 준 뒤 최종 확인한다. 비대화형 환경에서는 `<name>`과 `--yes`가 모두 필요하다.

### `setup`

Core의 공통 에이전틱 개발 지침을 설정한다. 프로젝트 파일은 변경하지 않는다.

```bash
agt setup [--core <name>] [지침 옵션]
```

| 옵션 | 설정 대상 |
| --- | --- |
| `--core <name>` | 설정할 Core; 생략하면 TUI에서 scope와 이름으로 선택 |
| `--harness <level>` | 하네스 동작 지침 |
| `--tdd <level>` | TDD 지침 |
| `--review <level>` | 리뷰 지침 |
| `--verification <level>` | 검증 지침 |
| `--documentation <level>` | 문서화 지침 |
| `--security <level>` | 보안 지침 |

모든 지침 옵션의 `<level>`은 `off`, `recommended`, `strict` 중 하나다. 기본값은 각 항목의 기존 설정이며, 최초 설정에서는 `recommended`다.

옵션을 생략하면 TUI에서 각 지침의 설명과 현재값을 확인하고 선택한다. 마지막에 전체 설정 요약을 보여 주며, 사용자가 승인한 경우에만 Core에 저장한다.

예:

```bash
agt setup
agt setup --core company --tdd strict --security strict
```

### `init`

선택한 Core를 대상 프로젝트에 처음 적용한다.

```bash
agt init --core <name> <project>
```

| 옵션·인자 | 설명 |
| --- | --- |
| `--core <name>` | 적용할 Core 이름; 필수 |
| `<project>` | 적용할 프로젝트 경로; 필수 |

프로젝트에 `AGENTS.md`, 에이전트별 포인터 파일, `agentic.project.json`을 만든다. 기존 `AGENTS.md`의 프로젝트 도메인 규칙 확장은 보존한다.

### `sync`

Core의 최신 공통 지침을 프로젝트에 다시 적용한다.

```bash
agt sync [--core <name>] <project>
```

| 옵션·인자 | 설명 |
| --- | --- |
| `--core <name>` | 동기화할 Core; 생략하면 프로젝트 `agentic.project.json`에서 선택 |
| `<project>` | 동기화할 프로젝트 경로; 필수 |

프로젝트 `AGENTS.md`의 도메인 규칙 확장은 보존한다. Agentic이 관리하는 에이전트별 포인터 파일은 재생성한다.

## TUI와 자동화 선택

일반 사용자는 다음처럼 TUI를 사용한다.

```bash
agt core create
agt setup
agt core remove
```

반복 실행·CI·스크립트에서는 필요한 값을 플래그로 전달한다.

```bash
agt core create company --scope company
agt setup --core company --tdd recommended --security strict
agt core remove company --yes
```

## 관련 문서

- [사용자 워크플로](workflow.md)
- [현재 아키텍처](architecture/)
- [제품 방향](product-direction.md)
