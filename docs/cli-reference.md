# CLI Reference

`@isthis/agentic`은 `agentic`과 짧은 별칭 `agt`로 실행할 수 있다. 아래 문서는 현재 구현된 명령어와 옵션을 기준으로 한다.

<!-- agentic-doc-sources: bin/agentic.mjs, bin/agt.mjs, bin/analyzer.mjs, bin/contracts.mjs, bin/fs-utils.mjs, bin/i18n.mjs -->
<!-- agentic-doc-sources-sha256: 5fc1978c8724c9213bd2de9b01e45735cb15a2a3a38af59d71a4fe71408a6311 -->

## 설치와 실행

```bash
npm install --global @isthis/agentic
agt help
```

현재 공개 배포 전인 저장소에서는 `pnpm install` 후 `node bin/agentic.mjs help`로 동일한 CLI를 로컬 실행할 수 있다.

저장소 개발 환경에서는 고정된 pnpm 버전을 사용한다. npm 설치 사용자는 별도 설정 없이 `agentic`과 `agt`를 모두 사용할 수 있다.

## 공통 규칙

- `<값>`은 사용자가 입력하는 필수 위치 인자다.
- `[값]`은 생략할 수 있는 선택 인자다.
- 모든 프로필 관리·적용 명령은 `profile` 하위 명령으로 제공한다.
- TUI가 표시되는 명령은 터미널에서 옵션을 생략하면 선택·입력·확인 화면을 제공한다.
- CI·스크립트에서는 플래그를 직접 전달하거나 stdin 입력을 사용한다.
- `off`, `recommended`, `strict`는 지침 수준이며 대소문자를 구분한다.

## 메인 TUI

```bash
agt
```

인자 없이 실행하면 메인 TUI가 열리고, 프로필 관리 메뉴를 통해 프로필 선택 후 설정·프로젝트 적용·동기화·상세 보기·삭제를 실행할 수 있다. 새 프로필 생성, 프로필 지침 설정, 도움말도 첫 화면에서 바로 선택할 수 있다. `agentic`도 동일하게 동작한다.

```bash
agt --tui
```

`--tui`는 메인 TUI를 명시적으로 여는 선택적 플래그다. 자동화 환경에서는 TUI 대신 아래 CLI 명령과 옵션을 사용한다.

## 명령어

### `profile create`

새 프로필과 초기 `AGENTS.md`를 만든다. 프로필은 기본적으로 `~/.agentic-profiles/<name>`에 저장된다.

```bash
agt profile create [<name>] [--scope <scope>]
```

| 인자·옵션 | 설명 | 기본값·허용값 |
| --- | --- | --- |
| `<name>` | 프로필 이름 | TUI에서 입력; 소문자·숫자·하이픈 1-64자 |
| `--scope <scope>` | 프로필의 용도 분류 | `personal` |
| `scope` | 분류값 | `personal`, `company`, `team`, `workspace` |

이름을 생략하면 TUI에서 이름과 scope를 선택하고 생성 여부를 확인한다.

### `profile list`

등록된 프로필을 scope별로 표시한다. 터미널에서는 프로필을 선택한 뒤 관리 작업까지 이어서 실행할 수 있다.

```bash
agt profile list [--scope <scope>]
```

터미널에서는 먼저 전체 또는 `personal`, `company`, `team`, `workspace` scope를 선택한다. 선택한 범위의 프로필 목록과 전체 개수를 표시한 뒤 다음 작업을 선택한다. `--scope`를 전달하면 해당 범위 선택을 건너뛴다.

- 새 프로필 생성
- 지침 설정
- 프로젝트에 적용
- 프로젝트 동기화
- 상세 보기
- 프로필 삭제

파이프·스크립트 환경에서는 읽기 쉬운 scope별 텍스트 목록만 출력한다.

자동화 환경에서는 scope를 직접 필터링할 수 있다.

```bash
agt profile list --scope company
```

scope는 프로필의 용도 분류이며 허용값은 `personal`, `company`, `team`, `workspace`다. scope가 없는 프로필을 임의로 선택하지 않으며, 해당 scope에 프로필이 없으면 생성 예시를 안내한다.

프로젝트 적용·동기화 메뉴에서는 현재 작업 폴더를 기준으로 디렉터리 탐색형 경로 선택기를 사용한다. 파일은 선택할 수 없으며, 존재하는 프로젝트 폴더만 제출할 수 있다.

### `profile view`

프로필의 scope와 현재 `AGENTS.md` 내용을 출력한다.

```bash
agt profile view <name>
```

`profile list`의 관리 메뉴에서는 `상세 보기`를 선택해 같은 내용을 TUI에서 확인할 수 있다.

### `profile remove`

선택한 프로필의 원본과 설정을 삭제한다. 이미 프로젝트에 적용된 파일은 변경하지 않는다.

```bash
agt profile remove [<name>] [--yes]
```

| 인자·옵션 | 설명 |
| --- | --- |
| `<name>` | 삭제할 프로필 이름; TUI에서 선택 가능 |
| `--yes` | 자동화 환경에서 삭제 확인을 명시적으로 승인 |

터미널에서 이름과 `--yes`를 생략하면 TUI에서 프로필을 선택하고 삭제 대상·영향을 보여 준 뒤 최종 확인한다. 비대화형 환경에서는 `<name>`과 `--yes`가 모두 필요하다.

### `profile setup`

프로필의 공통 에이전틱 개발 지침을 설정한다. 프로젝트 파일은 변경하지 않는다.

```bash
agt profile setup [<name>] [지침 옵션]
```

| 인자·옵션 | 설정 대상 |
| --- | --- |
| `<name>` | 설정할 프로필; 생략하면 TUI에서 scope와 이름으로 선택 |
| `--harness <level>` | 하네스 동작 지침 |
| `--tdd <level>` | TDD 지침 |
| `--review <level>` | 리뷰 지침 |
| `--verification <level>` | 검증 지침 |
| `--documentation <level>` | 문서화 지침 |
| `--security <level>` | 보안 지침 |

모든 지침 옵션의 `<level>`은 `off`, `recommended`, `strict` 중 하나다. 기본값은 각 항목의 기존 설정이며, 최초 설정에서는 `recommended`다.

지침 옵션을 하나라도 전달하면 `<name>`이 필요하다. 옵션을 생략하면 TUI에서 프로필을 고르고 각 지침의 설명과 현재값을 확인해 선택한다. 마지막에 전체 설정 요약을 보여 주며, 사용자가 승인한 경우에만 프로필에 저장한다.

예:

```bash
agt profile setup
agt profile setup company --tdd strict --security strict
```

### `profile apply`

선택한 프로필을 대상 프로젝트에 적용한다. 프로필 이름을 반드시 지정하므로, 프로젝트에 적용된 프로필을 처음 정하거나 다른 프로필로 전환하는 명령이다.

```bash
agt profile apply <name> [--dry-run] <project>
```

| 옵션·인자 | 설명 |
| --- | --- |
| `<name>` | 적용할 프로필 이름; 필수 |
| `--dry-run` | 변경 계획만 출력하고 파일은 변경하지 않음 |
| `<project>` | 적용할 프로젝트 경로; 생략하면 현재 디렉터리 |

프로젝트에 `AGENTS.md`, 에이전트별 포인터 파일, `agentic.project.json`을 만든다. 기존 `AGENTS.md`의 프로젝트 도메인 규칙 확장과 에이전트별 산출물의 사용자 영역은 보존한다. 이미 적용된 프로젝트에 다시 실행하면 관리 영역만 갱신하며, 다른 이름을 주면 그 프로필로 전환한다. 적용은 멱등이므로 같은 프로필을 다시 적용해도 결과가 같다.

### `profile sync`

프로젝트가 이미 적용받은 프로필을 최신 지침으로 다시 적용한다. `sync`는 프로필을 **전환하지 않는다**. 프로필 이름이나 `--profile`/`--core`를 주면 거부하며, 전환하려면 `profile apply <name> <project>`를 쓴다.

```bash
agt profile sync [--dry-run] <project>
```

| 옵션·인자 | 설명 |
| --- | --- |
| `--dry-run` | 변경 계획만 출력하고 파일은 변경하지 않음 |
| `<project>` | 동기화할 프로젝트 경로; 생략하면 현재 디렉터리 |

대상 프로필은 프로젝트의 `agentic.project.json`에 기록된 값을 사용한다. 아직 적용되지 않은 프로젝트에서 실행하면 `profile apply <name> <project>`로 먼저 적용하라는 오류로 끝난다. 프로젝트 `AGENTS.md`의 도메인 규칙 확장과 에이전트별 산출물의 사용자 영역은 보존하고, Agentic이 관리하는 블록만 갱신한다.

`--dry-run`을 사용하면 생성·갱신·보존·변경 없음 파일의 계획을 출력하고 실제 파일을 변경하지 않는다. TUI에서 프로젝트 적용·동기화를 선택하면 먼저 계획만 확인할지 선택할 수 있다.

### `config lang`

CLI와 생성 지침의 언어를 저장한다.

```bash
agt config lang <ko|en>
```

허용값은 `ko`, `en`이며 기본은 `ko`다. 로케일은 `--lang` → `AGENTIC_LANG` → 저장된 선택 → (대화형 첫 실행에 한 번 물어 저장) 순서로 정한다.

## 저장 위치와 마이그레이션

프로필은 `~/.agentic-profiles/<name>` 아래에 메타데이터 `agentic-profile.json`과 지침 `AGENTS.md`로 저장된다. `AGENTIC_HOME` 환경변수를 설정하면 그 경로 아래에 저장한다. 이전 버전의 `~/.agentic-cores`가 있으면 최초 실행 때 `~/.agentic-profiles`로 한 번 이관하고, 각 `agentic-core.json`을 `agentic-profile.json`으로 바꾼다.

## TUI와 자동화 선택

일반 사용자는 다음처럼 TUI를 사용한다.

```bash
agt profile create
agt profile setup
agt profile remove
```

반복 실행·CI·스크립트에서는 필요한 값을 플래그로 전달한다.

```bash
agt profile create company --scope company
agt profile setup company --tdd recommended --security strict
agt profile apply company /path/to/project
agt profile remove company --yes
```

## 관련 문서

- [사용자 워크플로](workflow.md)
- [현재 아키텍처](architecture/)
- [제품 방향](product-direction.md)
