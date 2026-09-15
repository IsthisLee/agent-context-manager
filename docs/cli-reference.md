# CLI Reference

`agent-context-manager` 패키지는 `agctx` 명령으로 실행한다. 아래 문서는 현재 구현된 명령어와 옵션을 기준으로 한다.

<!-- agctx-doc-sources: src -->
<!-- agctx-doc-sources-sha256: 10508799fb799fd0a36a239db73ba55c1bf03ca70ed429fd76f323c511064596 -->

## 설치와 실행

```bash
npm install --global agent-context-manager
agctx help
```

저장소를 직접 개발할 때는 `pnpm install` 후 `node src/agctx.ts help`로 설치 없이 같은 CLI를 실행할 수 있다.

저장소 개발 환경에서는 고정된 pnpm 버전을 사용한다.

## 공통 규칙

- `<값>`은 사용자가 입력하는 필수 위치 인자다.
- `[값]`은 생략할 수 있는 선택 인자다.
- 모든 프로필 관리·적용 명령은 `profile` 하위 명령으로 제공한다.
- TUI가 표시되는 명령은 터미널에서 옵션을 생략하면 선택·입력·확인 화면을 제공한다.
- CI·스크립트에서는 플래그를 직접 전달하거나 stdin 입력을 사용한다.
- `off`, `recommended`, `strict`는 지침 수준이며 대소문자를 구분한다.

## 메인 TUI

```bash
agctx
```

인자 없이 실행하면 메인 TUI가 열리고, 프로필 관리 메뉴를 통해 프로필 선택 후 설정·프로젝트 적용·동기화·충돌 해결·상세 보기·삭제를 실행할 수 있다. 새 프로필 생성, 프로필 지침 설정, 언어 변경, 도움말도 첫 화면에서 바로 선택할 수 있다.

```bash
agctx --tui
```

`--tui`는 메인 TUI를 명시적으로 여는 선택적 플래그다. 자동화 환경에서는 TUI 대신 아래 CLI 명령과 옵션을 사용한다.

## 명령어

### `profile create`

새 프로필과 초기 `AGENTS.md`를 만든다. 프로필은 기본적으로 `~/.agctx/profiles/<name>`에 저장된다.

```bash
agctx profile create [<name>] [--scope <scope>]
```

| 인자·옵션 | 설명 | 기본값·허용값 |
| --- | --- | --- |
| `<name>` | 프로필 이름 | TUI에서 입력; 소문자·숫자·하이픈 1-64자 |
| `--scope <scope>` | 프로필의 용도 분류 | 기본 `personal`; `personal`, `company`, `team`, `workspace` |

이름을 생략하면 TUI에서 이름과 scope를 선택하고 생성 여부를 확인한다. 표준 입력이 터미널이 아닌 환경에서 이름을 생략하면 표준 입력의 첫 줄을 이름으로, 둘째 줄을 scope로 읽는다.

### `profile list`

등록된 프로필을 scope별로 표시한다. 터미널에서는 프로필을 선택한 뒤 관리 작업까지 이어서 실행할 수 있다.

```bash
agctx profile list [--scope <scope>]
```

터미널에서는 먼저 전체 또는 `personal`, `company`, `team`, `workspace` scope를 선택한다. 선택한 범위의 프로필 목록과 전체 개수를 표시한 뒤 다음 작업을 선택한다. `--scope`를 전달하면 해당 범위 선택을 건너뛴다.

- 새 프로필 생성
- 지침 설정
- 프로젝트에 적용
- 프로젝트 동기화
- 프로젝트 충돌 해결
- 상세 보기
- 프로필 삭제

파이프·스크립트 환경에서는 읽기 쉬운 scope별 텍스트 목록만 출력한다.

자동화 환경에서는 scope를 직접 필터링할 수 있다.

```bash
agctx profile list --scope company
```

scope는 프로필의 용도 분류이며 허용값은 `personal`, `company`, `team`, `workspace`다. scope가 없는 프로필을 임의로 선택하지 않으며, 해당 scope에 프로필이 없으면 생성 예시를 안내한다.

프로젝트 적용·동기화·충돌 해결 메뉴에서는 현재 작업 폴더를 기준으로 디렉터리 탐색형 경로 선택기를 사용한다. 파일은 선택할 수 없으며, 존재하는 프로젝트 폴더만 제출할 수 있다.

### `profile view`

프로필의 scope와 현재 `AGENTS.md` 내용을 출력한다.

```bash
agctx profile view <name>
```

`profile list`의 관리 메뉴에서는 `상세 보기`를 선택해 같은 내용을 TUI에서 확인할 수 있다.

### `profile remove`

선택한 프로필의 원본과 설정을 삭제한다. 이미 프로젝트에 적용된 파일은 변경하지 않는다.

```bash
agctx profile remove [<name>] [--yes]
```

| 인자·옵션 | 설명 |
| --- | --- |
| `<name>` | 삭제할 프로필 이름; TUI에서 선택 가능 |
| `--yes` | 자동화 환경에서 삭제 확인을 명시적으로 승인 |

터미널에서 이름과 `--yes`를 생략하면 TUI에서 프로필을 선택하고 삭제 대상·영향을 보여 준 뒤 최종 확인한다. 비대화형 환경에서는 `<name>`과 `--yes`가 모두 필요하다.

### `profile setup`

프로필의 공통 에이전틱 개발 지침을 설정한다. 프로젝트 파일은 변경하지 않는다.

```bash
agctx profile setup [<name>] [지침 옵션]
```

| 인자·옵션 | 설정 대상 |
| --- | --- |
| `<name>` | 설정할 프로필; 생략하면 TUI에서 `scope · 이름` 목록으로 선택 |
| `--harness <level>` | 하네스 동작 지침 |
| `--tdd <level>` | TDD 지침 |
| `--review <level>` | 변경 검토 지침 |
| `--verification <level>` | 검증 지침 |
| `--documentation <level>` | 문서화 지침 |
| `--security <level>` | 보안 지침 |

모든 지침 옵션의 `<level>`은 `off`, `recommended`, `strict` 중 하나다. 기본값은 각 항목의 기존 설정이며, 최초 설정에서는 `recommended`다.

지침 옵션을 하나라도 전달하면 `<name>`이 필요하다. 옵션을 생략하면 TUI에서 프로필을 고르고 각 지침의 설명과 현재값을 확인해 선택한다. 마지막에 전체 설정 요약을 보여 주며, 사용자가 승인한 경우에만 프로필에 저장한다.

표준 입력이 터미널이 아닌 환경에서 지침 옵션 없이 실행하면 표준 입력을 줄 단위로 읽는다. 이름을 생략했다면 첫 줄을 프로필 번호 또는 이름으로 읽는다. 이어지는 줄은 하네스 동작·TDD·변경 검토·검증·문서화·보안 순서의 수준이다. 빈 줄은 기존 설정을 유지한다.

예:

```bash
agctx profile setup
agctx profile setup company --tdd strict --security strict
```

### `profile apply`

선택한 프로필을 대상 프로젝트에 적용한다. 프로필 이름을 반드시 지정하므로, 프로젝트에 적용된 프로필을 처음 정하거나 다른 프로필로 전환하는 명령이다.

```bash
agctx profile apply <name> [--dry-run] <project>
```

| 옵션·인자 | 설명 |
| --- | --- |
| `<name>` | 적용할 프로필 이름; 필수 |
| `--dry-run` | 변경 계획만 출력하고 파일은 변경하지 않음 |
| `<project>` | 적용할 프로젝트 경로; 생략하면 현재 디렉터리 |

프로젝트에 `AGENTS.md`, 에이전트별 포인터 파일, `agctx.project.json`을 만든다. 마지막으로 쓴 관리 영역 원문은 `.agctx/base/<경로>.base`에 기록하고, `.agctx/.gitignore`로 `backups/`를 커밋에서 뺀다. 기존 `AGENTS.md`의 프로젝트 도메인 규칙 확장과 에이전트별 산출물의 사용자 영역은 보존한다. 이미 적용된 프로젝트에 다시 실행하면 관리 영역만 갱신하며, 다른 이름을 주면 그 프로필로 전환한다. 적용은 멱등이므로 같은 프로필을 다시 적용해도 결과가 같다.

- 확장 섹션 제목은 `## 4. 프로젝트 규칙 확장 (SSOT)`(ko) 또는 `## 4. Project rule extensions (SSOT)`(en)이며 두 로케일을 모두 인식한다.
- 확장 섹션이 없는 기존 `AGENTS.md`는 내용을 `## Existing project guidance` 아래로 옮겨 보존한다.
- 기록된 관리 영역을 밖에서 고친 프로젝트에서는 `apply`도 `sync`와 같이 파일을 쓰지 않고 `Managed file changed outside agctx: <파일 목록>`으로 멈춘다. 오류 메시지는 차이를 볼 명령(`profile sync --dry-run`)과 푸는 명령(`profile resolve`)을 함께 알려 준다. 푸는 절차는 [사용 가이드](usage-guide.md#관리-영역을-고쳐서-멈췄을-때)에 있다.

### `profile sync`

프로젝트가 이미 적용받은 프로필을 최신 지침으로 다시 적용한다. `sync`는 프로필을 **전환하지 않는다**. 프로필 이름이나 `--profile`을 주면 거부하며, 전환하려면 `profile apply <name> <project>`를 쓴다.

```bash
agctx profile sync [--dry-run] <project>
```

| 옵션·인자 | 설명 |
| --- | --- |
| `--dry-run` | 변경 계획만 출력하고 파일은 변경하지 않음 |
| `<project>` | 동기화할 프로젝트 경로; 생략하면 현재 디렉터리 |

대상 프로필은 프로젝트의 `agctx.project.json`에 기록된 값을 사용한다. 아직 적용되지 않은 프로젝트에서 실행하면 `profile apply <name> <project>`로 먼저 적용하라는 오류로 끝난다. 프로젝트 `AGENTS.md`의 도메인 규칙 확장과 에이전트별 산출물의 사용자 영역은 보존하고, agctx가 관리하는 블록만 갱신한다.

`--dry-run`을 사용하면 파일마다 `create`·`update`·`unchanged`·`conflict` 상태로 계획을 출력하고 실제 파일을 변경하지 않는다. `conflict` 파일은 diff를 함께 출력한다. 마지막 적용본(`.agctx/base/`)을 알면 그 이후 관리 영역 안의 편집과 agctx가 쓸 프로필·템플릿 변경을 나눠 보여 주고, 모르면 현재 관리 영역과 agctx가 쓸 내용을 비교한다. 충돌이 하나라도 있으면 계획을 끝까지 출력한 뒤 종료 코드 1로 끝나며 `apply --dry-run`도 같다. TUI에서 프로젝트 적용·동기화를 선택하면 먼저 계획만 확인할지 선택할 수 있고, 충돌로 멈추면 충돌 해결로 이어갈지 묻는다.

### `profile resolve`

관리 영역 충돌을 푼다. 대상 프로필은 `sync`처럼 프로젝트의 `agctx.project.json`에 기록된 값을 사용한다.

```bash
agctx profile resolve [--dry-run] [--discard] [--edit] <project>
```

| 옵션·인자 | 설명 |
| --- | --- |
| `--dry-run` | 파일별로 옮길 줄·되살릴 줄·백업 경로만 출력하고 파일은 변경하지 않음 |
| `--discard` | 마지막 적용본을 알 수 없는 충돌에서 현재 파일을 `.agctx/backups/<시각>/`에 복사한 뒤 관리 영역을 새로 만듦 |
| `--edit` | 마지막 적용본을 아는 충돌마다 VS Code 3-way merge 편집기(`code --wait --merge`)를 엶 |
| `<project>` | 충돌을 풀 프로젝트 경로; 생략하면 현재 디렉터리 |

- 충돌이 없으면 `Nothing to resolve`를 출력하고 파일을 바꾸지 않는다.
- **마지막 적용본을 아는 경우:** `.agctx/base/`의 원문 hash가 기록과 같거나 지금 다시 만든 관리 영역의 hash가 기록과 같은 경우다. 관리 영역 안에서 추가·수정한 줄을 관리 영역 밖으로 옮긴다. 포인터 파일은 관리 블록 바로 아래, `AGENTS.md`는 확장 섹션 끝이다. 관리 영역은 현재 프로필로 새로 만들며 그 사이 프로필이 바뀌었어도 같다. 관리 영역 안에서 지운 줄은 되살아나고 파일별 개수를 알린다. 줄을 고친 경우에는 고친 줄이 밖으로 옮겨지고 원래 줄이 되살아나므로 비슷한 문장이 두 번 남을 수 있다.
- **파일이 없는 경우:** 다시 만든다.
- **마지막 적용본을 모르는 경우:** base가 없는 상태에서 프로필까지 바뀐 경우다. 사용자 편집과 프로필 변경을 가려낼 수 없으므로 diff를 보여 주고 종료 코드 1로 멈춘다. `--discard`를 주면 백업한 뒤 새로 만든다.
- **`--edit`:** 아래쪽 Result 창은 자동 해결과 같은 내용, 곧 관리 영역 안에서 추가·수정한 줄을 밖으로 옮긴 파일로 열린다. 위쪽 창에서 변경을 받아들이지 않아도 되며, Result 창을 확인하고 고친 뒤 저장한다. 편집기를 열기 전에 터미널이 확인 순서를 안내한다. 위쪽 `current-<파일>` 창의 강조 영역은 원래 고친 위치이므로 수락하지 않는다. 탭을 닫을 때 VS Code가 처리되지 않은 충돌 경고를 띄우면 Result 창을 다시 확인하고 `충돌과 함께 닫기`(Close with Conflicts)를 누른다. 편집기를 닫으면 결과 파일에서 관리 영역 **밖**의 내용만 가져오고 관리 영역은 agctx가 새로 만든다. 저장할 때 포매터가 관리 영역을 바꿔도 적용된다. 결과의 관리 영역 안에 남은 변경은 적용하지 않고 diff와 보존한 결과 파일 경로로 알린다. 결과 파일에서 관리 마커(`AGENTS.md`는 확장 섹션 제목)가 사라졌으면 결과 파일 경로를 알려 주고 종료 코드 1로 멈춘다. `code` 명령이 PATH에 없어도 안내 후 멈춘다. 근거는 [ADR 0010](adr/0010-edit-merge-regenerates-managed-area.md)이다.
- 풀 수 없는 충돌이 하나라도 남으면 어떤 파일도 쓰지 않는다. 쓸 때는 관리 hash와 `.agctx/base/`를 함께 갱신한다.

`profile list`의 관리 메뉴에서는 `프로젝트 충돌 해결`을 고른다. 경로를 고르면 계획을 먼저 보여 주고 자동 해결·VS Code에서 병합·백업 후 다시 생성 중 하나를 선택한다. 결정 근거는 [ADR 0008](adr/0008-managed-conflict-recovery.md)에 있다.

### `config lang`

CLI와 생성 지침의 언어를 저장한다.

```bash
agctx config lang <ko|en>
```

허용값은 `ko`, `en`이며 기본은 `ko`다. 로케일은 `--lang` → `AGCTX_LANG` → 저장된 선택 → (대화형이면 첫 실행에 한 번 물어 저장하고 비대화형이면 `ko`) 순서로 정한다. `--lang`과 `AGCTX_LANG`에 허용되지 않는 값을 주면 오류로 끝나고 저장된 값이 잘못됐으면 무시한다.

## 저장 위치

프로필은 `~/.agctx/profiles/<name>` 아래에 메타데이터 `profile.json`과 지침 `AGENTS.md`로 저장된다. 언어 설정은 `~/.agctx/config.json`에 저장된다. `AGCTX_HOME` 환경변수를 설정하면 `~/.agctx` 대신 그 폴더를 쓴다. 이때 프로필은 `$AGCTX_HOME/profiles/<name>`, 언어 설정은 `$AGCTX_HOME/config.json`에 있다.

## TUI와 자동화 선택

일반 사용자는 다음처럼 TUI를 사용한다.

```bash
agctx profile create
agctx profile setup
agctx profile remove
```

반복 실행·CI·스크립트에서는 필요한 값을 플래그로 전달한다.

```bash
agctx profile create company --scope company
agctx profile setup company --tdd recommended --security strict
agctx profile apply company /path/to/project
agctx profile remove company --yes
```

## 관련 문서

- [사용 가이드](usage-guide.md)
- [사용자 워크플로](workflow.md)
- [현재 아키텍처](architecture/)
- [제품 방향](product-direction.md)
