# `--json` 결과의 `data` 형식

<!-- agctx-doc-sources: src/commands/handlers.ts, src/commands/output.ts -->
<!-- agctx-doc-sources-sha256: f3ab9b08eefb172c698bbbacd7e31b27b9160d3ee43ac0ae2b9c4a7e089d0cf2 -->

`--json`을 주면 stdout에 결과 문서 하나가 나온다. 문서의 공통 필드(`schemaVersion`·`command`·`exitCode`·`ok`·`data`·`warnings`·`errors`)는 [CLI Reference](cli.md#--json-출력)에 있고, 이 문서는 명령마다 다른 `data`의 필드를 적는다. `errors`가 비어 있지 않으면 `data`는 `null`이다. 종료 코드가 0이 아니어도 결과를 보고한 것이면 `data`가 있다(예: 충돌을 찾은 `check`는 2와 함께 `findings`를 준다). 결과를 읽는 스크립트와 에이전트는 이 표에 있는 필드만 기대한다.

- 필드 이름의 `[]`는 목록의 각 항목, `.`은 객체 안의 필드다. 예를 들어 `changes[].file`은 `changes` 목록 각 항목의 `file`이다.
- 경로는 표에 적은 대로다. "프로젝트 기준"과 "루트 기준"은 그 폴더 기준 상대 경로이고 `/`로 나눈다. 따로 적지 않은 폴더 경로는 절대 경로다.
- 형식의 `null`은 값이 없을 수 있다는 뜻이다.
- 필드를 더할 때는 `schemaVersion`을 올리지 않는다. 필드를 빼거나 뜻을 바꿀 때만 올린다([ADR 0016](../adr/0016-command-contract.md)).
- `evals/json-data.test.ts`가 명령마다 실행해 최상위 필드가 표와 같은지, 목록 항목과 객체의 필드가 표와 같은지(양쪽 모두) 비교한다. 뜻에 "~일 때만 있다"라고 적은 필드는 없어도 된다. 상태 값의 목록(예: `changes[].status`의 값들)은 평가가 확인하지 않고 코드의 타입에서 옮겨 적었다.

## 목차

- [프로필](#프로필)
- [프로필 Git](#프로필-git)
- [프로젝트 적용](#프로젝트-적용)
- [점검](#점검)
- [여러 저장소](#여러-저장소)
- [스킬과 설정](#스킬과-설정)

## 프로필

### `profile create`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `profile` | 문자열 | 만든 프로필 이름. `--json`으로 이름 없이 실행하면 `argument.missing` 오류다 |

### `profile list`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `profiles` | 목록 | 읽을 수 있는 프로필. `--scope`를 주면 그 용도만 |
| `profiles[].name` | 문자열 | 프로필 이름 |
| `profiles[].scope` | 문자열 | `personal`·`company`·`team`·`workspace` |
| `profiles[].schemaVersion` | 수 | `profile.json`의 형식 버전 |
| `profiles[].instructions` | 문자열 | 규칙 파일 경로. `profile.json`에 있을 때만 있다 |
| `profiles[].createdAt` | 문자열 | 만든 시각. `profile.json`에 있을 때만 있다 |
| `profiles[].settings` | 객체 | `profile setup`으로 고른 항목. `profile.json`에 있을 때만 있다 |
| `profiles[].updatedAt` | 문자열 | 고친 시각. `profile.json`에 있을 때만 있다 |
| `profiles[].link` | 문자열 | 연결한 폴더. `profile link`로 연결한 프로필일 때만 있다 |
| `brokenLinks` | 목록 | 쓸 수 없는 링크. `--scope`를 주면 빈 목록 |
| `brokenLinks[].name` | 문자열 | 링크의 프로필 이름 |
| `brokenLinks[].path` | 문자열 | 링크가 가리키는 폴더. 포인터를 읽을 수 없으면 포인터 파일 |
| `brokenLinks[].reason` | 문자열 | `missing-folder`·`missing-metadata`·`invalid-metadata`·`missing-rules`·`invalid-link` |

`profiles[]`에는 `profile.json`의 필드가 그대로 들어가므로, 사람이 더한 다른 필드도 그대로 나온다.

### `profile view`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `name` | 문자열 | 프로필 이름 |
| `scope` | 문자열 | 용도 |
| `instructions` | 문자열 | 규칙 파일의 내용 |
| `mcpServers` | 목록 또는 `null` | 프로필 `mcp.json`의 서버 이름. `mcp.json`이 없으면 `null` |
| `skills` | 목록 | 프로필 `skills/`의 skill 이름. 없거나 프로필의 정의가 틀렸으면 빈 목록 |
| `subagents` | 목록 | 프로필 `subagents/`의 subagent 이름. 없거나 프로필의 정의가 틀렸으면 빈 목록 |
| `hooks` | 목록 또는 `null` | 프로필 `hooks.json`의 hook 이름. `hooks.json`이 없거나 정의가 틀렸으면 `null` |

### `profile setup`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `profile` | 문자열 | 프로필 이름. `--json`으로 항목 옵션 없이 실행하면 `argument.missing` 오류다 |
| `settings` | 객체 | 지침 항목(`workflow`·`context`·`tdd`·`review`·`verification`·`instructions`·`docs`·`security`·`untrusted`·`language`)마다 `on` 또는 `off` |

### `profile remove`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `profile` | 문자열 | 지운 프로필 이름. `--json`으로 `--yes` 없이 실행하면 `confirm.required` 오류다 |
| `removed` | 참거짓 | 늘 `true` |

### `profile link`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `profile` | 문자열 | 연결할 프로필 이름 |
| `path` | 문자열 | 연결할 폴더 |
| `scope` | 문자열 | 용도 |
| `instructions` | 문자열 | 규칙 파일. 폴더 기준 상대 경로 |
| `metadata` | 문자열 | 폴더의 `profile.json`을 만들면 `create`, 이미 있으면 `keep` |
| `link` | 문자열 | 보관함 링크를 만들면 `create`, 이미 같은 링크면 `unchanged` |
| `written` | 참거짓 | 이번 실행에서 파일을 썼는지. `--dry-run`이거나 바뀔 것이 없으면 `false` |

## 프로필 Git

### `profile clone`, `profile connect`

받거나 연결한 프로필의 Git 상태다. `profile status`의 `profiles[]` 항목과 같은 모양이다.

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `name` | 문자열 | 프로필 이름 |
| `dir` | 문자열 | 프로필 폴더 |
| `connected` | 참거짓 | 프로필 폴더가 Git 저장소인지 |
| `remote` | 문자열 또는 `null` | 원격 URL. 사용자 이름·비밀번호·토큰은 지운다 |
| `branch` | 문자열 또는 `null` | 현재 브랜치 |
| `remoteBranch` | 문자열 또는 `null` | 현재 브랜치가 추적하고 push하는 원격 브랜치 |
| `commit` | 문자열 또는 `null` | 현재 커밋 |
| `upstream` | 문자열 또는 `null` | fetch한 원격 추적 ref |
| `dirty` | 목록 | 커밋하지 않은 변경. `git status --porcelain`의 줄 그대로(예: `?? AGENTS.md`, ` M profile.json`) |
| `ahead` | 수 또는 `null` | 원격보다 앞선 커밋 수. 추적 브랜치가 없으면 `null` |
| `behind` | 수 또는 `null` | 원격보다 뒤진 커밋 수. 추적 브랜치가 없으면 `null` |
| `refreshed` | 참거짓 | 이번 실행에서 원격을 fetch했는지 |
| `link` | 문자열 또는 `null` | 연결한 프로필이 가리키는 폴더 |

### `profile status`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `profiles` | 목록 | 프로필마다 [`profile clone`](#profile-clone-profile-connect)과 같은 Git 상태 |

### `profile pull`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `state` | 객체 | 받은 뒤의 Git 상태. [`profile clone`](#profile-clone-profile-connect)과 같은 모양 |
| `commits` | 목록 | 받을(받은) 커밋의 한 줄 요약 |
| `changedFiles` | 목록 | 받을(받은) 커밋이 바꾼 파일. 프로필 폴더 기준 |
| `applied` | 참거짓 | 이번 실행에서 fast-forward했는지 |

### `profile push`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `state` | 객체 | 보낸 뒤의 Git 상태. [`profile clone`](#profile-clone-profile-connect)과 같은 모양 |
| `commits` | 목록 | 보낼(보낸) 커밋의 한 줄 요약 |
| `pushed` | 참거짓 | 이번 실행에서 원격으로 보냈는지 |

## 프로젝트 적용

### `profile apply`, `profile sync`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `profile` | 문자열 | 적용한 프로필 |
| `project` | 문자열 | 프로젝트 폴더 |
| `agents` | 목록 | 연결 파일을 쓴 에이전트(`codex`·`claude`·`antigravity`) |
| `include` | 목록 | 받은 대상 종류(`rules`·`mcp`·`skills`·`subagents`·`hooks`) |
| `mcpServers` | 목록 | 이번 계획에서 `.mcp.json`이나 `.codex/config.toml`에 쓰는 MCP 서버 이름. MCP를 받지 않거나, 받을 에이전트가 없거나, 프로필에 없으면 빈 목록 |
| `skills` | 목록 | 이번 계획에서 쓰는 skill 이름. skills를 받지 않거나, 받을 에이전트가 없거나, 프로필에 없으면 빈 목록 |
| `subagents` | 목록 | 이번 계획에서 쓰는 subagent 이름. 같은 조건에서 빈 목록 |
| `hooks` | 목록 | 이번 계획에서 명령을 쓰는 hook 이름. `include`에 `hooks`가 없거나, 받을 에이전트가 없거나, 프로필에 없으면 빈 목록 |
| `source` | 객체 또는 `null` | Git 프로필이면 `{ git, branch, commit }`. 로컬 프로필이면 `null` |
| `pin` | 참거짓 | 프로필 커밋에 고정했는지 |
| `uncommitted` | 참거짓 | 커밋하지 않은 프로필 수정이 들어갔는지 |
| `changes` | 목록 | 계획한 파일 |
| `changes[].file` | 문자열 | 프로젝트 기준 경로 |
| `changes[].status` | 문자열 | `create`·`update`·`remove`·`unchanged` |
| `conflicts` | 목록 | 충돌한 파일. 충돌이 있으면 명령이 `project.conflict` 오류로 끝나 멈춘 파일이 `errors[].details`(`{ file, kind }`)에 담기므로, 성공한 결과에서는 늘 빈 목록이다 |
| `written` | 참거짓 | 이번 실행에서 파일을 썼는지. `--dry-run`이거나 바뀔 것이 없으면 `false` |

### `profile resolve`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `conflicts` | 수 | 푼(풀) 충돌 파일 수 |
| `written` | 참거짓 | 이번 실행에서 파일을 썼는지 |
| `files` | 목록 | 파일마다 한 처리 |
| `files[].file` | 문자열 | 프로젝트 기준 경로 |
| `files[].action` | 문자열 | `move`(고친 줄을 관리 영역 밖으로 옮김)·`recreate`(없어진 파일을 다시 만듦)·`discard`(백업 후 다시 만듦)·`edit`(병합 편집기) |
| `files[].moved` | 수 | 옮긴 줄 수. `move`일 때만 있다 |
| `files[].restored` | 수 | 되살린 줄 수. `move`일 때만 있다 |
| `files[].backup` | 문자열 | 백업 경로. 프로젝트 기준. `discard`일 때만 있다 |

## 점검

### `check`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `project` | 문자열 | 프로젝트 폴더 |
| `profile` | 문자열 또는 `null` | 기록한 프로필 |
| `pinned` | 참거짓 | 고정했는지 |
| `commit` | 문자열 또는 `null` | 기록한 프로필 커밋 |
| `latestCommit` | 문자열 또는 `null` | 고정한 저장소면 보관함의 더 새 커밋, `--refresh`면 원격 브랜치의 최신 커밋(기록한 커밋과 같아도 넣는다). 둘 다 아니면 `null` |
| `findings` | 목록 | 발견한 것 |
| `findings[].kind` | 문자열 | `behind`(1)·`conflict`(2)·`hidden-characters`(3) |
| `findings[].file` | 문자열 또는 `null` | 프로젝트 기준 경로. 파일에 매이지 않으면 `null` |
| `findings[].detail` | 문자열 | 사람이 읽을 설명 |
| `warnings` | 목록 | 종료 코드를 바꾸지 않는 경고 |
| `exitCode` | 수 | 이 결과의 종료 코드 |

### `explain`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `path` | 문자열 | 에이전트를 시작할 폴더 |
| `root` | 문자열 | 프로젝트 루트(위쪽의 Git 루트) |
| `agents` | 목록 | 확인한 에이전트마다 한 항목 |
| `agents[].agent` | 문자열 | `codex`·`claude`·`antigravity` |
| `agents[].selected` | 참거짓 | 저장소가 `agctx.project.json`에서 고른 에이전트인지 |
| `agents[].startDir` | 문자열 | 루트 기준 시작 폴더. 루트면 `.` |
| `agents[].files` | 목록 | 판정한 지침 파일(`path`·`absolutePath`·`status`·`scope`·`reason`·`origin`). `path`는 루트 기준이고, 루트 밖의 사용자 수준 파일이면 절대 경로다 |
| `agents[].findings` | 목록 | 판정(`kind`·`file`·`message`). `kind`는 `missing`·`warning`·`not-selected` |
| `unsupported` | 목록 | 세 에이전트가 읽지 않는 다른 도구의 규칙 파일(`path`·`reason`) |
| `exitCode` | 수 | 고른 에이전트에 `missing`이 있으면 4, 아니면 0 |

### `verify`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `path` | 문자열 | 에이전트를 시작한 폴더 |
| `root` | 문자열 | 프로젝트 루트 |
| `agents` | 목록 | 에이전트마다 한 항목 |
| `agents[].agent` | 문자열 | `codex`·`claude`·`antigravity` |
| `agents[].status` | 문자열 | `pass`·`fail`·`no-evidence`·`error`·`not-selected` |
| `agents[].evidence` | 문자열 | `session-log`·`probe`·`none` |
| `agents[].source` | 문자열 또는 `null` | 읽은 세션 기록 파일이나 실행한 probe 명령 |
| `agents[].exitCode` | 수 | 이 에이전트의 종료 코드 |
| `agents[].expected` | 목록 | 받아야 할 파일(루트 기준) |
| `agents[].delivered` | 목록 | 받은 것으로 확인한 파일(루트 기준) |
| `agents[].missing` | 목록 | 받지 못한 파일(루트 기준) |
| `agents[].stale` | 목록 | 세션이 시작한 뒤 바뀌어 기록으로 알 수 없는 파일(루트 기준) |
| `agents[].error` | 객체 또는 `null` | probe를 실행하지 못했을 때 `{ code, message, hint }` |
| `exitCode` | 수 | 가장 나쁜 에이전트의 종료 코드 |

## 여러 저장소

### `repos list`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `repos` | 목록 | 이 컴퓨터가 기억하는 저장소 |
| `repos[].path` | 문자열 | 저장소 폴더 |
| `repos[].profile` | 문자열 | 적용한 프로필 |
| `repos[].pinned` | 참거짓 | 고정했는지 |
| `repos[].updatedAt` | 문자열 | 마지막으로 기록한 시각(ISO 8601) |
| `repos[].missing` | 참거짓 | 폴더가 없어졌는지 |

### `repos status`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `repos` | 목록 | 저장소마다 한 항목 |
| `repos[].path` | 문자열 | 저장소 폴더 |
| `repos[].profile` | 문자열 | 적용한 프로필 |
| `repos[].pinned` | 참거짓 | 고정했는지 |
| `repos[].state` | 문자열 | `ok`·`behind`·`conflict`·`hidden-characters`·`missing`·`error` |
| `repos[].exitCode` | 수 | 이 저장소에 `check`를 실행한 종료 코드 |
| `repos[].commit` | 문자열 또는 `null` | 기록한 프로필 커밋 |
| `repos[].latestCommit` | 문자열 또는 `null` | 더 새 커밋 |
| `repos[].findings` | 목록 | [`check`](#check)의 `findings`와 같다 |
| `repos[].warnings` | 목록 | `check`가 낸 경고 |
| `repos[].error` | 객체 또는 `null` | 확인하지 못했을 때 `{ code, message, hint }` |

### `repos sync`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `repos` | 목록 | 저장소마다 한 항목 |
| `repos[].path` | 문자열 | 저장소 폴더 |
| `repos[].profile` | 문자열 | 적용한 프로필 |
| `repos[].state` | 문자열 | `update`(바꿀 것)·`updated`(바꿈)·`up-to-date`·`pinned`·`dirty`·`conflict`·`review`(hooks가 바뀌어 `profile sync`로 확인해야 함)·`missing`·`error` |
| `repos[].exitCode` | 수 | 이 저장소의 종료 코드 |
| `repos[].files` | 목록 | 바꿀(바꾼) 파일이나 멈추게 한 파일. 프로젝트 기준 |
| `repos[].detail` | 문자열 | 사람이 읽을 설명 |

### `repos pr`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `repos` | 목록 | 대상마다 한 항목 |
| `repos[].target` | 문자열 | 저장소 폴더나 clone URL |
| `repos[].profile` | 문자열 또는 `null` | 적용한 프로필. 읽지 못했으면 `null` |
| `repos[].state` | 문자열 | `would-open`(`--dry-run`에서 열 것)·`opened`·`pushed`(push했지만 PR을 열지 못함)·`up-to-date`·`pr-exists`·`branch-exists`·`skipped`·`conflict`·`missing`·`error` |
| `repos[].exitCode` | 수 | 이 대상의 종료 코드 |
| `repos[].base` | 문자열 또는 `null` | PR의 base 브랜치 |
| `repos[].branch` | 문자열 또는 `null` | 만든(만들) 브랜치 |
| `repos[].url` | 문자열 또는 `null` | 연(이미 열린) PR 주소 |
| `repos[].files` | 목록 | 바꾼 파일 |
| `repos[].detail` | 문자열 | 사람이 읽을 설명 |

## 스킬과 설정

### `install`, `uninstall`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `items` | 목록 | 스킬 폴더마다 한 항목 |
| `items[].target` | 문자열 | 설치 위치 id(`claude`·`codex`·`antigravity`·`antigravity-cli`) |
| `items[].skill` | 문자열 | 스킬 이름(`agctx`·`agctx-author`) |
| `items[].dir` | 문자열 | 스킬 폴더 |
| `items[].state` | 문자열 | `install`은 `create`·`update`·`unchanged`, `uninstall`은 `remove`·`kept`(agctx가 둔 폴더가 아니라 남김). 기록이 없거나 고친 폴더가 있으면 `install`은 `--force` 없이 `install.blocked` 오류로 끝나고 `data`는 `null`이다 |
| `items[].reason` | 문자열 또는 `null` | `kept`인 까닭. 그 밖에는 `null` |
| `skipped` | 목록 | 에이전트를 찾지 못해 건너뛴 위치. `uninstall`은 늘 빈 목록 |
| `skipped[].target` | 문자열 | 설치 위치 id |
| `skipped[].dir` | 문자열 | 스킬 폴더 |
| `skipped[].marker` | 문자열 | 에이전트가 설치됐는지 본 폴더 |
| `written` | 참거짓 | `--dry-run`이 아니면 `true`. 바뀐 폴더가 없어도 `true`다 |

### `config lang`

| 필드 | 형식 | 뜻 |
| --- | --- | --- |
| `locale` | 문자열 | 저장한 언어(`en`·`ko`) |

### `help`

`data`는 늘 `null`이다.
