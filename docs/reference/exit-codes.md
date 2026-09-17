# 종료 코드

<!-- agctx-doc-sources: src/shared/errors.ts, src/commands/registry.ts -->
<!-- agctx-doc-sources-sha256: 855bdf61c13401f59e6709b12fdc43af3245317d9d14b074dcd99a9c73463d15 -->

모든 명령은 결과를 종료 코드로 알린다. 스크립트·CI·에이전트는 출력 문구 대신 종료 코드와 `--json` 결과 문서의 `exitCode`를 읽는다.

| 코드 | 뜻 | 대표 상황 |
| --- | --- | --- |
| 0 | 성공 | 계획만 출력했거나 이미 최신인 경우도 포함 |
| 1 | 뒤처짐 | `check`·`repos status`: 이 컴퓨터의 프로필이나 원천 저장소에 기록보다 새 버전이 있음, 커밋하지 않은 프로필 수정으로 적용함. `repos sync`가 관리 파일의 커밋하지 않은 변경 때문에 건너뛴 저장소 |
| 2 | 관리 영역 충돌 | `apply`·`sync`·`resolve`가 밖에서 고친 관리 영역을 만남, APM 기본 모드가 만든 `AGENTS.md`·`CLAUDE.md`에 쓰려 함, `check`의 관리 영역 불일치, `pull`·`push`에서 커밋하지 않은 변경·갈라짐·원격보다 뒤처짐 |
| 3 | 숨은 문자 | 받을 프로필, 적용할 프로필, 관리 파일에 사람에게 보이지 않는 문자가 있음 |
| 4 | 전달 누락 | `explain`: 어느 에이전트에도 닿지 않는 프로젝트 지침 파일이 있음. `verify`: 받아야 할 파일이 세션 기록이나 probe에서 확인되지 않음 |
| 64 | 사용법 오류 | 알 수 없는 명령·옵션, 인자 누락, 없는 프로필, 적용하지 않은 프로젝트, 확인할 수 없는 환경에서 `--yes` 없음 |
| 69 | 외부 도구·네트워크·인증 불가 | `git`이 없음, 원격 접근·인증 실패, VS Code CLI `code`가 없음, 고정한 커밋이 로컬에 없음, `verify --probe`의 에이전트 CLI가 없거나 실패함 |
| 70 | 그 밖의 오류 | 심볼릭 링크 대상 거부 같은 파일 시스템 오류 |

결과가 여러 개 겹치면 3 > 2 > 1 순서로 가장 심각한 코드를 돌려준다. 명령마다 돌려줄 수 있는 코드는 `--help`의 마지막 줄에 있다. 결정 근거는 [ADR 0016](../adr/0016-command-contract.md)이다.

## 명령별 종료 코드

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
| `agctx config lang` | `0` · `64` · `70` |
<!-- agctx:generated:exit-codes:end -->
