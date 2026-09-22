# 0044. 프로필의 MCP 서버를 Claude Code `.mcp.json`과 Codex `.codex/config.toml`에 소유 영역만 병합해 쓴다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-22
* **결정자:** 제품 소유자
* **근거:** [MCP 서버 설정 위치와 형식 근거](../references.md#mcp-서버-설정-위치와-형식-근거)
* **관련:** [ADR 0021](0021-profile-scope-skills-mcp-subagents.md)이 MCP를 프로필이 담을 대상으로 정했다. 이 ADR은 그 첫 구현이다. [ADR 0042](0042-choose-agents-per-repository.md)가 미뤄 둔 대상 종류 고르기(`include`)를 여기서 구현하고, [ADR 0043](0043-stop-on-unmanaged-files.md)의 표지 없는 파일 규칙을 MCP 설정 파일에도 적용한다. 논의는 [프로필 설정 표면 확장](../discussion/architecture/topics/profile-config-surface.md)에 있다.

## 배경 (Context)

- 팀이 같은 MCP 서버(사내 이슈 트래커, 문서 검색 등)를 써야 협업이 균질한데, 지금은 이 설정이 프로필 밖 사람마다 손에 있다.
- 에이전트마다 형식이 다르다. Claude Code는 저장소 루트의 `.mcp.json`(JSON), Codex는 신뢰한 프로젝트의 `.codex/config.toml`(TOML)을 읽는다. 원격 서버의 필드 이름과 비밀값을 넘기는 방법도 다르다. Claude Code는 `${VAR}`를 펼치지만 Codex는 변수 이름을 적는 필드를 쓴다.
- JSON에는 주석이 없어 지침 파일처럼 관리 블록 표지를 둘 수 없다. 그리고 사람이 넣은 서버와 같은 파일을 나눠 쓴다.
- Codex는 같은 이름의 서버를 사용자 설정과 키 하나씩 합친다(직접 실험). 팀 파일이 뺀 키에 사용자 값이 섞일 수 있다.

## 검토한 대안 (Options)

| 항목 | 대안 | 판단 |
| --- | --- | --- |
| 프로필 형식 | 도구 중립 `mcp.json`(`command`·`args`·`env` 또는 `url`·`headers`) | **채택.** 에이전트마다 옮겨 쓰고, 아는 필드만 받아 조용히 버리는 설정이 없다 |
| | 에이전트별 파일을 그대로 복사 | 프로필 작성자가 형식마다 같은 서버를 여러 번 적어야 한다 |
| JSON 소유 영역 | `agctx.project.json`의 `managedKeys`에 서버 이름 기록 | **채택.** 파일에 표지를 넣지 않고도 사람이 넣은 서버와 가른다 |
| | 파일 전체를 agctx가 소유 | 사람이 넣은 서버를 지운다 |
| TOML 소유 영역 | `# agctx:managed:start`·`end` 주석 블록 | **채택.** TOML은 주석을 받으므로 지침 파일과 같은 방식이다 |
| 같은 이름의 서버 | 멈춘다 | **채택.** `--adopt`로도 덮어쓰지 않는다. 사람이 둔 서버를 바꾸는 것은 편입이 아니다 |
| | 프로필이 이긴다 | 사람의 설정을 조용히 바꾼다 |
| Codex로 옮길 수 없는 값 | 그 서버만 Codex에서 빼고 경고 | **채택.** 펼쳐지지 않는 `${VAR}`를 그대로 쓰면 서버가 잘못된 값으로 뜬다 |
| Antigravity | 이번에는 쓰지 않는다 | **채택.** 워크스페이스 파일을 읽는 조건과 `${VAR}` 지원을 확인하지 못했다 |
| 고친 서버 항목의 충돌 해결 | `resolve --discard`(백업 후 다시 만듦)만 | **채택.** 고친 줄을 관리 영역 밖으로 옮길 자리가 JSON·TOML에는 없다 |

## 결정 (Decision)

1. 프로필 폴더의 `mcp.json`에 `{ "servers": { "<이름>": … } }`로 서버를 적는다. 로컬 서버는 `command`(필수)·`args`·`env`, 원격 서버는 `url`(http·https)·`headers`다. 다른 필드나 잘못된 값은 사용법 오류(64)로 멈춘다. 숨은 문자 검사는 규칙 파일과 같다.
2. 고른 에이전트가 Claude Code면 `.mcp.json`의 `mcpServers`에, Codex면 `.codex/config.toml`의 관리 블록에 쓴다. 원격 서버는 Claude Code에 `type: "http"`를 붙인다. Codex에는 `args`·`env`·`env_vars`·`http_headers`·`env_http_headers`를 비어 있어도 적어 사용자 설정이 섞이는 것을 줄인다. 사용자 설정에만 있는 키(`bearer_token_env_var`·`cwd` 등)까지 막을 수는 없으므로, 이 컴퓨터의 Codex 사용자 설정에 같은 이름의 서버가 있으면 경고한다.
3. Codex로 옮길 때 값 전체가 `${이름}`인 같은 이름의 환경 변수는 `env_vars`로, 값 전체가 `${VAR}`인 헤더는 `env_http_headers`로, `Authorization: Bearer ${VAR}`는 `bearer_token_env_var`로 옮긴다. 그 밖에 `${...}`가 든 값(URL, `command`·`args` 포함)은 그 서버만 Codex에서 빼고 경고한다.
4. JSON 파일은 `managedKeys`에 적은 서버 항목만, TOML 파일은 관리 블록만 agctx가 소유한다. 소유 영역의 해시와 원문(`.agctx/base/`)을 지침 파일과 같이 기록하고, 사람이 고쳤으면 충돌(2)로 멈춘다. `resolve --discard`가 백업한 뒤 다시 만든다.
5. 사람이 같은 이름의 서버를 이미 두었으면 `project.mcp-name-taken`(2)로 멈춘다. TOML은 표 머리(따옴표 이름과 하위 표 포함), 점 표기 키, `[mcp_servers]` 아래의 인라인 표를 모두 본다. 사람이 만든 설정 파일에 처음 쓰는 것은 [ADR 0043](0043-stop-on-unmanaged-files.md)대로 `--adopt`로만 한다.
6. 프로필에서 서버를 빼면 그 서버만 지우고, agctx 것만 남은 파일은 지운다.
7. `profile apply --include <rules|mcp|all>`로 저장소가 받을 대상 종류를 고르고 `agctx.project.json`의 `include`에 기록한다. `rules`는 뺄 수 없다. 기록이 없으면 hooks를 뺀 전부다. TUI는 프로필에 `mcp.json`이 있을 때만 묻는다.
8. 적용 계획에는 쓸 서버와 그 명령·URL을 한 줄로 보여 준다. 다른 사람의 컴퓨터에서 실행될 명령이기 때문이다.

## 결과 및 영향 (Consequences)

- 프로필에 `mcp.json`을 더하면 다음 `sync`부터 저장소마다 `.mcp.json`과 `.codex/config.toml`이 생긴다. 받기 싫은 저장소는 `--include rules`로 뺀다.
- Claude Code는 대화형 세션에서 처음 쓸 때 승인을 묻고, Codex는 신뢰한 프로젝트에서만 읽는다. agctx는 파일을 쓸 뿐 승인이나 신뢰를 대신하지 않는다.
- 비밀값은 파일에 쓰지 않고 환경 변수로 넘기도록 안내한다. agctx는 값이 비밀인지 판정하지 않는다.
- Antigravity, skills, subagents, hooks는 같은 소유 영역 계약을 넓혀 구현할 후속 작업이다.
- `.mcp.json`은 agctx가 다시 쓸 때 원래 들여쓰기를 따르지만 키 순서 외의 서식(한 줄 배열, 숫자 표기 등)은 `JSON.stringify` 형태로 바뀐다.
- `--include rules`로 뺐다가 다시 받거나 프로필에 `mcp.json`을 처음 넣을 때, 그 사이 사람이 만든 설정 파일이 있으면 `--adopt`가 필요하다.
- 적용 계획은 쓸 서버의 명령·URL과 env·헤더 이름, 빼는 서버를 보여 주고, 터미널 제어 문자는 드러내 보인다.
