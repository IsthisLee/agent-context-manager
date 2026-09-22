# 팀 MCP 서버 나눠 쓰기


팀이 함께 쓰는 MCP 서버(사내 이슈 트래커, 문서 검색 등)를 프로필에 한 번 적어 두면, 프로필을 적용한 저장소마다 Claude Code의 `.mcp.json`과 Codex의 `.codex/config.toml`에 같은 서버가 들어간다. 사람이 그 파일에 따로 넣은 서버와 설정은 그대로 남는다. 결정과 근거는 [ADR 0044](../adr/0044-mcp-servers-in-profiles.md)에 있다.

## 목차

- [준비 사항](#준비-사항)
- [프로필에 서버 적기](#프로필에-서버-적기)
- [저장소에 적용하기](#저장소에-적용하기)
- [에이전트마다 들어가는 모양](#에이전트마다-들어가는-모양)
- [서버를 바꾸거나 빼기](#서버를-바꾸거나-빼기)
- [멈췄을 때](#멈췄을-때)
- [알아 둘 점](#알아-둘-점)

## 준비 사항

- **agctx와 프로필:** 설치와 프로필 만들기는 [빠른 시작](../getting-started/quick-start.md)에 있다.
- **비밀값:** 토큰은 파일에 쓰지 않고 환경 변수로 넘긴다. 팀원마다 자기 셸이나 비밀 관리 도구에 그 변수를 둔다.
- **지원하는 에이전트:** Claude Code와 Codex다. Antigravity는 워크스페이스 설정을 읽는 조건을 확인하지 못해 아직 쓰지 않는다([근거](../references.md#mcp-서버-설정-위치와-형식-근거)).

## 프로필에 서버 적기

<!-- agctx-doc-sources: src/mcp/servers.ts -->
<!-- agctx-doc-sources-sha256: 161c69b829396c3098c1271d31cde6f9714380258a331b56dcc850d7e635e15c -->

프로필 폴더(`agctx profile view <프로필>`이 읽는 폴더, 연결한 프로필이면 그 저장소 루트)에 `mcp.json`을 만든다. 로컬에서 실행하는 서버는 `command`와 `args`·`env`를, 원격 서버는 `url`과 `headers`를 적는다.

```json
{
  "servers": {
    "issues": {
      "command": "npx",
      "args": ["-y", "@acme/issues-mcp"],
      "env": { "ISSUES_TOKEN": "${ISSUES_TOKEN}" }
    },
    "docs": {
      "url": "https://mcp.acme.dev/docs",
      "headers": { "Authorization": "Bearer ${DOCS_TOKEN}" }
    }
  }
}
```

- 서버 이름은 영문자·숫자·`-`·`_`로 64자까지다.
- 이 밖의 필드(`cwd`, `type` 등)를 쓰면 적용할 때 어느 필드인지 알려 주며 멈춘다. 에이전트가 이해하지 못할 설정을 조용히 버리지 않기 위해서다.
- 비밀값은 `"${ISSUES_TOKEN}"`처럼 **값 전체**를 환경 변수로 적는다. Codex는 `${...}`를 펼치지 않아서, 값 전체가 같은 이름의 변수일 때만 Codex용 필드로 옮길 수 있다.
- Git 프로필이면 `mcp.json`도 커밋해 올린다. 고정한 저장소는 기록한 커밋의 `mcp.json`을 쓴다.

적은 서버는 `agctx profile view`의 마지막 줄에서 확인한다.

```bash
$ agctx profile view team-backend
…
MCP servers: docs (https://mcp.acme.dev/docs; headers Authorization), issues (npx -y @acme/issues-mcp; env ISSUES_TOKEN)
```

## 저장소에 적용하기

<!-- agctx-doc-sources: src/project/mcp-plan.ts, src/mcp/targets.ts -->
<!-- agctx-doc-sources-sha256: 98a17b63ae226faf96b0ba78c12da1895b718d72015361841746256b49b4ede3 -->

지침과 같은 `profile apply`·`profile sync`가 MCP 서버도 쓴다. 계획 아래에 쓸 서버의 명령·URL과 env·헤더 이름이 한 줄로 나오고, 빼는 서버가 있으면 `MCP servers removed:` 줄이 더 나온다. 다른 사람의 컴퓨터에서 실행될 명령이므로 적용하기 전에 이 줄을 확인한다. 값이 비밀일 수 있는 env와 헤더는 이름만 보여 주고, 터미널 제어 문자는 `\u001b`처럼 드러낸다.

```bash
$ agctx profile apply team-backend . --dry-run
Dry-run: 12 file(s) to change.
  create    AGENTS.md
  create    CLAUDE.md
  create    .agents/rules/agctx.md
  create    .mcp.json
  create    .codex/config.toml
  …
  create    agctx.project.json
MCP servers from the profile: docs (https://mcp.acme.dev/docs; headers Authorization), issues (npx -y @acme/issues-mcp; env ISSUES_TOKEN)
Dry-run: no files were changed.
```

- **MCP를 받지 않을 저장소:** `--include`에 받을 종류를 쉼표로 적고 `mcp`를 뺀다. `agctx profile apply <프로필> <저장소> --include rules`는 규칙만 받고, `--include rules,skills,subagents`는 MCP 서버만 뺀다. 이 선택은 `agctx.project.json`의 `include`에 남아 이후 `sync`도 따른다. 다시 받으려면 `--include all`(hooks를 뺀 전부)로 적용하고, hooks도 받는 저장소면 `--include rules,mcp,skills,subagents,hooks`처럼 목록에 적는다. 그 사이 사람이 `.mcp.json`이나 `.codex/config.toml`을 만들어 두었으면 agctx가 관리하던 기록이 없으므로 `unmanaged`로 멈추고, `--adopt`를 붙여야 한다. 프로필에 `mcp.json`을 처음 넣을 때도 같다. TUI의 「프로젝트에 적용」은 프로필에 있는 종류를 고르는 목록에 MCP 서버를 함께 보여 준다. skills·subagents·hooks는 [팀 skills·subagents·hooks 나눠 쓰기](skills-subagents-hooks.md)에 있다.
- **에이전트 고르기:** `--agent`로 Claude Code를 빼면 `.mcp.json`을, Codex를 빼면 `.codex/config.toml`을 쓰지 않는다.
- **커밋:** 만들어진 `.mcp.json`, `.codex/config.toml`, `.agctx/base/`의 사본, `agctx.project.json`을 함께 커밋한다.

## 에이전트마다 들어가는 모양

Claude Code의 `.mcp.json`에는 서버 항목이 그대로 들어가고, 원격 서버에는 `"type": "http"`가 붙는다. Claude Code는 `${...}`를 스스로 펼친다.

```json
{
  "mcpServers": {
    "docs": {
      "type": "http",
      "url": "https://mcp.acme.dev/docs",
      "headers": {
        "Authorization": "Bearer ${DOCS_TOKEN}"
      }
    },
    "issues": {
      "command": "npx",
      "args": [
        "-y",
        "@acme/issues-mcp"
      ],
      "env": {
        "ISSUES_TOKEN": "${ISSUES_TOKEN}"
      }
    }
  }
}
```

Codex의 `.codex/config.toml`에는 관리 블록 안에 서버 표가 들어간다. 환경 변수는 Codex가 읽는 필드로 옮겨진다. `"ISSUES_TOKEN": "${ISSUES_TOKEN}"`은 `env_vars`로, `Authorization: Bearer ${DOCS_TOKEN}`은 `bearer_token_env_var`로 간다. Codex는 같은 이름의 서버를 사용자 설정과 키 하나씩 합치므로, 목록과 표 키는 비어 있어도 적어 팀원의 값이 섞이는 것을 줄인다. 그래도 사용자 설정에만 있는 키(`bearer_token_env_var`, `cwd`, `startup_timeout_sec` 등)는 팀 서버에 붙으므로, 적용할 때 이 컴퓨터의 Codex 사용자 설정에 같은 이름의 서버가 있으면 경고한다.

```toml
# agctx:managed:start
# MCP servers from the agctx profile. Change them in the profile, not here.
[mcp_servers.docs]
url = "https://mcp.acme.dev/docs"
bearer_token_env_var = "DOCS_TOKEN"
http_headers = {}
env_http_headers = {}

[mcp_servers.issues]
command = "npx"
args = ["-y", "@acme/issues-mcp"]
env = {}
env_vars = ["ISSUES_TOKEN"]
# agctx:managed:end
```

agctx가 쓴 서버는 `agctx.project.json`에 기록된다. `.mcp.json`은 JSON이라 표지를 둘 수 없으므로 서버 이름을 `managedKeys`에 적고, 그 이름의 항목만 agctx가 바꾼다.

```json
  "managedKeys": {
    ".mcp.json": [
      "docs",
      "issues"
    ]
  }
```

## 서버를 바꾸거나 빼기

프로필의 `mcp.json`을 고치고 `agctx profile sync`(여러 저장소면 `repos sync`나 `repos pr`)를 실행한다. 아래는 `docs`를 뺀 뒤의 계획에서 바뀌지 않는 줄을 지운 것이다.

```bash
$ agctx profile sync . --dry-run
Dry-run: 5 file(s) to change.
  update    .mcp.json
  update    .codex/config.toml
  update    .agctx/base/.mcp.json.base
  update    .agctx/base/.codex/config.toml.base
  update    agctx.project.json
MCP servers from the profile: issues (npx -y @acme/issues-mcp; env ISSUES_TOKEN)
MCP servers removed: docs
Dry-run: no files were changed.
```

- 뺀 서버만 지우고 사람이 넣은 서버와 설정은 남긴다.
- 프로필에서 `mcp.json`을 지우면 agctx가 쓴 서버를 모두 지운다. agctx 것만 남아 있던 파일은 파일째 지운다.

## 멈췄을 때

- **`already defines MCP servers with the same names`**(종료 코드 2): 사람이 같은 이름의 서버를 이미 두었다. agctx는 자기가 쓰지 않은 서버를 덮어쓰지 않으므로, 그 서버의 이름을 바꾸거나 지우거나 프로필에서 이름을 바꾼다.
- **`unmanaged .mcp.json`·`unmanaged .codex/config.toml`**(종료 코드 2): 사람이 만든 설정 파일이 이미 있다. 그 파일에 agctx 서버를 더해도 되면 `--adopt`를 붙여 다시 실행한다([ADR 0043](../adr/0043-stop-on-unmanaged-files.md)).
- **`conflict .mcp.json`**(종료 코드 2): agctx가 쓴 서버 항목을 누군가 고쳤다. 서버 항목에는 고친 줄을 옮길 자리가 없으므로, 고친 내용을 프로필의 `mcp.json`에 옮긴 뒤 `agctx profile resolve <저장소> --discard`로 백업하고 다시 만든다. 백업은 `.agctx/backups/<시각>/`에 남는다.
- **`Codex (.codex/config.toml) did not get MCP server …`**(경고): Codex로 옮길 수 없는 값이 있다. 다른 이름의 변수(`"API_KEY": "${ACME_API_KEY}"`), 값 일부에 쓴 변수(`"https://${HOST}/mcp"`), `command`·`args` 안의 변수가 여기에 해당한다. 그 서버는 Claude Code에만 들어간다. Codex에도 넣으려면 같은 이름의 변수를 값 전체로 쓴다.
- **`settings after the agctx block without a table header`**(경고): `.codex/config.toml`에서 agctx 블록 뒤에 표 머리 없이 적은 설정은 TOML 규칙상 블록의 마지막 서버 표에 붙는다. 그 설정을 블록 위로 옮긴다.
- **`your Codex user settings also define MCP server(s)`**(경고): 이 컴퓨터의 `~/.codex/config.toml`(또는 `$CODEX_HOME/config.toml`)에 같은 이름의 서버가 있다. Codex가 키 하나씩 합치므로, 개인 토큰 변수나 작업 폴더가 팀 서버에 붙지 않게 개인 설정의 그 서버 이름을 바꾸거나 지운다.

## 알아 둘 점

- **승인과 신뢰:** Claude Code는 대화형 세션에서 `.mcp.json`의 서버를 처음 쓸 때 사람에게 승인을 묻는다. Codex는 신뢰한 프로젝트에서만 `.codex/config.toml`을 읽는다. agctx는 파일을 쓸 뿐 승인이나 신뢰를 대신하지 않는다.
- **우선순위:** 팀원이 자기 설정에 같은 이름의 서버를 두면, Claude Code는 로컬 범위(`~/.claude.json`의 그 프로젝트 항목)를 `.mcp.json`보다 먼저 쓴다. Codex는 프로젝트 설정이 사용자 설정보다 먼저다.
- **서식:** agctx가 `.mcp.json`을 다시 쓸 때 파일이 쓰던 들여쓰기는 따르지만, 한 줄로 쓴 배열 같은 서식은 펼쳐지고 숫자는 `JSON.stringify` 모양(`2.50`은 `2.5`, `1e3`은 `1000`)이 된다.
