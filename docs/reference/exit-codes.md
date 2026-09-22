# 종료 코드


모든 명령은 결과를 종료 코드로 알린다. 스크립트·CI·에이전트는 출력 문구 대신 종료 코드와 `--json` 결과 문서의 `exitCode`를 읽는다.

| 코드 | 뜻 | 대표 상황 |
| --- | --- | --- |
| 0 | 성공 | 계획만 출력했거나 이미 최신인 경우도 포함 |
| 1 | 뒤처짐 | `check`·`repos status`: 저장소가 기록한 프로필 버전보다 새 버전이 이 컴퓨터의 프로필 보관함이나 프로필 원격 저장소(`--refresh`일 때)에 있음, 또는 프로필 폴더에 커밋하지 않은 수정이 있는 상태로 적용했음. `repos sync`: 관리 파일에 커밋하지 않은 변경이 있어 건너뛴 저장소가 있음 |
| 2 | 관리 영역 충돌 | `apply`·`sync`·`resolve`: 관리 영역(agctx가 다시 만드는 부분)을 agctx 밖에서 고친 파일을 만남. APM 기본 모드가 만든 `AGENTS.md`·`CLAUDE.md`에 쓰려 함. `check`: 관리 영역이 기록한 해시와 다름. `pull`·`push`: 프로필 폴더에 커밋하지 않은 변경이 있음, 로컬과 원격이 서로 다른 커밋으로 갈라짐, `push`할 때 원격에 로컬에 없는 커밋이 있음 |
| 3 | 숨은 문자 | 받을 프로필, 적용할 프로필, 관리 파일에 사람에게 보이지 않는 문자가 있음 |
| 4 | 전달 누락 | `explain`: 확인한 에이전트(기본은 세 에이전트 모두) 가운데 하나라도 받지 못하는 프로젝트 지침 파일이 있음(출력에 `missing` 표시). `verify`: 받아야 할 파일이 세션 기록이나 probe에서 확인되지 않음 |
| 64 | 사용법 오류 | 알 수 없는 명령·옵션, 인자 누락, 없는 프로필, 적용하지 않은 프로젝트, 터미널이 아니어서 확인을 물을 수 없는데 `--yes`가 없음 |
| 69 | 외부 도구·네트워크·인증 불가 | `git`이 없음, 원격 접근·인증 실패, VS Code CLI `code`가 없음, 고정한 커밋이 이 컴퓨터의 프로필 폴더에 아직 없음, `verify --probe`의 에이전트 CLI가 없거나 실패함 |
| 70 | 그 밖의 오류 | 심볼릭 링크 대상 거부 같은 파일 시스템 오류 |

결과가 여러 개 겹치면 3 > 2 > 1 순서로 가장 심각한 코드를 돌려준다. 명령마다 돌려줄 수 있는 코드는 `--help`의 마지막 줄에 있다. 결정 근거는 [ADR 0016](../adr/0016-command-contract.md)이다.

## 명령별 종료 코드

<!-- agctx-doc-sources: src/shared/errors.ts, src/commands/registry.ts, src/explain.ts -->
<!-- agctx-doc-sources-sha256: 174d234639242d1d10b93cfbecb2a76a8112deaeff7704904e7157f85c32d791 -->

아래 표는 명령 등록부에서 만든다. 명령 하나의 코드는 `agctx <명령> --help`의 마지막 줄에도 나온다.

<!-- agctx:generated:exit-codes:start -->
| 명령 | 돌려줄 수 있는 종료 코드 |
| --- | --- |
| `agctx profile create` | `0` · `64` · `70` |
| `agctx profile list` | `0` · `64` · `70` |
| `agctx profile view` | `0` · `64` · `70` |
| `agctx profile setup` | `0` · `64` · `70` |
| `agctx profile apply` | `0` · `2` · `3` · `64` · `69` · `70` |
| `agctx profile sync` | `0` · `2` · `3` · `64` · `69` · `70` |
| `agctx profile resolve` | `0` · `2` · `64` · `69` · `70` |
| `agctx profile remove` | `0` · `64` · `70` |
| `agctx profile clone` | `0` · `3` · `64` · `69` · `70` |
| `agctx profile link` | `0` · `64` · `70` |
| `agctx profile status` | `0` · `64` · `69` · `70` |
| `agctx profile pull` | `0` · `2` · `3` · `64` · `69` · `70` |
| `agctx profile push` | `0` · `2` · `64` · `69` · `70` |
| `agctx profile connect` | `0` · `64` · `69` · `70` |
| `agctx check` | `0` · `1` · `2` · `3` · `64` · `69` · `70` |
| `agctx explain` | `0` · `4` · `64` · `70` |
| `agctx verify` | `0` · `4` · `64` · `69` · `70` |
| `agctx repos list` | `0` · `64` · `70` |
| `agctx repos status` | `0` · `1` · `2` · `3` · `64` · `69` · `70` |
| `agctx repos sync` | `0` · `1` · `2` · `3` · `64` · `69` · `70` |
| `agctx repos pr` | `0` · `2` · `3` · `64` · `69` · `70` |
| `agctx install` | `0` · `64` · `70` |
| `agctx uninstall` | `0` · `64` · `70` |
| `agctx config lang` | `0` · `64` · `70` |
<!-- agctx:generated:exit-codes:end -->
