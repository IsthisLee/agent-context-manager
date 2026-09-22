# 파일 형식과 저장 위치


## 저장 위치

<!-- agctx-doc-sources: src/shared/home.ts -->
<!-- agctx-doc-sources-sha256: ab20aee2b4fe9db8bbb9ccd4aa04b5f6684f95d82cff775996eef22c5ff32c5f -->

프로필은 `~/.agctx/profiles/<name>` 아래에 메타데이터 `profile.json`과 규칙 파일로 저장된다. 규칙 파일은 기본으로 `AGENTS.md`이고, `profile.json`의 `instructions`가 다른 파일을 가리킬 수 있다([profile.json](#profilejson)). `profile link`로 연결한 프로필은 그 폴더에 `link.json`만 두고 연결한 폴더를 읽는다([link.json](#linkjson)). Git 프로필이면 같은 폴더에 `.git`이 있고, 원격 주소와 추적 브랜치는 Git 설정에 둔다. 언어 설정은 `~/.agctx/config.json`, 적용한 저장소 목록은 `~/.agctx/repos.json`에 저장된다. `AGCTX_HOME` 환경변수를 설정하면 `~/.agctx` 대신 그 폴더를 쓴다. 이때 프로필은 `$AGCTX_HOME/profiles/<name>`, 언어 설정은 `$AGCTX_HOME/config.json`에 있다. `verify`는 `CODEX_HOME`(기본 `~/.codex`)과 `CLAUDE_CONFIG_DIR`(기본 `~/.claude`) 아래의 세션 기록을 읽기만 한다.

프로젝트에는 `AGENTS.md`, `CLAUDE.md`, `.agents/rules/agctx.md`, `agctx.project.json`(적용한 프로필·프로젝트 이름·적용 버전·관리 영역 해시), `.agctx/`(마지막 적용본 `base/`, 충돌을 풀 때 만드는 백업 `backups/`)가 생긴다.

## agctx.project.json

<!-- agctx-doc-sources: src/project/plan.ts, src/shared/types.ts -->
<!-- agctx-doc-sources-sha256: 83785e6b2858772e3d84ef7025ffd0c2544ae3ab14d97c330d29cae559e270b9 -->

`profile apply`·`sync`가 프로젝트 루트에 쓰는 적용 기록이다. 다시 쓸 때 아래 표에 없는 키(사람이나 다른 도구가 넣은 값)도 지우지 않고 그대로 남긴다.

| 필드 | 뜻 |
| --- | --- |
| `schemaVersion` | 형식 버전. 지금은 2이며 1로 기록된 파일도 읽는다 |
| `profile` | 적용한 프로필 이름. `sync`가 이 값을 쓴다 |
| `projectName` | `AGENTS.md`에 쓴 프로젝트 이름. 팀원이 저장소를 다른 이름의 폴더로 clone해도 이 이름을 쓰므로, `sync` 결과가 폴더 이름에 따라 달라지지 않는다 |
| `source` | Git 프로필이면 `{ git, branch, commit }`. URL의 사용자 정보와 토큰은 지운다 |
| `pin` | `--pin`으로 고정했으면 `true` |
| `uncommitted` | 프로필의 규칙 파일, `profile.json`, `mcp.json`, `skills/`, `subagents/`, `hooks.json`에 커밋하지 않은 수정이 있는 상태로 적용했으면 `true`. 그 수정은 원격에 없어 다른 사람이 같은 내용을 받을 수 없으므로 `check`가 뒤처짐(1)으로 알린다 |
| `agents` | `profile apply --agent`로 고른 에이전트(`codex`·`claude`·`antigravity`)를 등록 순서로 담은 목록. 키가 없으면 지원 에이전트 전부다. `sync`·`repos sync`·`repos pr`·`check`가 이 선택을 따른다. 목록이 아니거나, 비었거나, 모르는 이름이 있으면 명령이 종료 코드 64로 멈춘다 |
| `include` | `profile apply --include`로 고른 대상 종류(`rules`·`mcp`·`skills`·`subagents`·`hooks`). 키가 없으면 hooks를 뺀 전부다. `rules`는 늘 들어 있어야 하고, 아니면 명령이 종료 코드 64로 멈춘다 |
| `managedKeys` | JSON 설정 파일마다 agctx가 쓴 항목. `.mcp.json`은 MCP 서버 이름이고, `.claude/settings.json`과 `.codex/hooks.json`은 agctx가 넣은 hook 묶음마다 `<이벤트>:<묶음 해시 16자리>`다. 이 항목만 agctx가 바꾸고 지운다. 맵이 아니거나 값이 글 목록이 아니면 명령이 종료 코드 64로 멈춘다 |
| `managedHashes` | 관리 파일 경로(`/` 구분)마다 관리 영역의 sha256. 줄 끝을 LF로 맞춘 내용으로 계산하므로 CRLF로 체크아웃한 파일도 같은 값이 된다. 하위 폴더 연결 파일과, agctx가 쓴 skills·subagents 파일(파일 내용 전체가 관리 영역)도 들어간다. 경로는 프로젝트 루트 기준 상대 경로여야 하며, 절대 경로나 `..`가 든 경로가 있으면 `apply`·`sync`·`check`가 아무것도 바꾸지 않고 종료 코드 64로 멈춘다 |

```json
{
  "schemaVersion": 2,
  "profile": "team-backend",
  "projectName": "orders-api",
  "agents": ["codex", "claude"],
  "source": {
    "git": "/work/team-backend.git",
    "branch": "main",
    "commit": "39ca6e115f85ffa4178c86326f24c313253a4c9e"
  },
  "pin": true,
  "managedHashes": {
    "AGENTS.md": "e60685b9…",
    "CLAUDE.md": "b4a3d190…"
  }
}
```

## profile.json

<!-- agctx-doc-sources: src/profile/store.ts, src/profile/setup.ts -->
<!-- agctx-doc-sources-sha256: 0c177cba3fa6d9dec39c3ac31058b64ecddfe655d497fd8e321df18d3a2ffa10 -->

프로필 폴더의 메타데이터다. `profile create`가 `schemaVersion`(1)·`name`·`scope`·`createdAt`을 쓰고, `profile setup`이 고른 수준을 `settings`에, 고친 시각을 `updatedAt`에 더한다. `setup`은 이미 있는 다른 필드를 그대로 둔다.

프로필의 규칙 파일은 기본으로 프로필 폴더 루트의 `AGENTS.md`다. 이미 있는 규칙 저장소처럼 규칙 파일이 다른 곳에 있으면, `instructions`에 그 파일의 경로를 적고 `schemaVersion`을 2로 둔다([기존 저장소를 프로필로 쓰기](../guides/team-sharing.md#기존-저장소를-프로필로-쓰기)).

```json
{
  "schemaVersion": 2,
  "name": "team-rules",
  "scope": "company",
  "instructions": "templates/AGENTS.md"
}
```

| 필드 | 규칙 |
| --- | --- |
| `schemaVersion` | `instructions`가 없으면 1과 2를 받고, 있으면 2만 받는다. 1에 `instructions`가 있으면 거부한다. 0.4.0까지의 모든 릴리스는 1만 받으므로, 옛 버전은 `instructions`를 쓴 프로필을 거부하고 다른 파일을 대신 적용하지 않는다. |
| `instructions` | 저장소 루트를 기준으로 한 상대 경로이고 폴더는 `/`로 나눈다. `.md` 파일만 가리킬 수 있다. 빈 값, 절대 경로, 역슬래시, `.`·`..` 조각, `.git` 조각은 거부한다. 없으면 `AGENTS.md`다. |

`profile clone`과 `profile pull`은 원격에서 받는 규칙 파일이 일반 파일인지 확인하고, 그 파일이나 거쳐 가는 폴더가 심볼릭 링크면 거부한다. 보관함에 이미 있는 프로필은 사용자의 폴더이므로 규칙 파일이 링크여도 읽는다. 고정한 프로젝트를 다시 만들 때는 기록한 커밋의 `profile.json`이 가리키는 파일을 쓰므로, 원천이 나중에 규칙 파일을 옮겨도 기록한 커밋의 내용이 그대로 나온다.

판정은 `src/profile/store.ts`의 `isValidProfileMetadata`<!--s:c3bf5c60f82f-->와 `isInstructionsPath`<!--s:1865487d2906-->가 하고, 원격에서 받은 파일의 링크 검사는 `src/profile/store.ts`의 `regularFileInside`<!--s:eafe6522b61c-->와 `src/shared/git.ts`의 `committedFile`<!--s:57e01f0132f4-->이 한다. 고정한 프로젝트가 기록한 커밋에서 규칙 파일을 찾는 일은 `src/profile/git-profile.ts`의 `committedProfile`<!--s:6781660c390f-->이 한다.

## mcp.json

<!-- agctx-doc-sources: src/mcp/servers.ts, src/mcp/targets.ts, src/mcp/toml.ts, src/mcp/json-merge.ts, src/project/mcp-plan.ts -->
<!-- agctx-doc-sources-sha256: 7284d25d663034e3d2044c7ebd137abb5d9db694ce135dee775d6cafb5c8e605 -->

프로필 폴더 루트에 두는 MCP 서버 목록이다. 프로필에 없으면 MCP 파일을 쓰지 않는다. 쓰는 법은 [팀 MCP 서버 나눠 쓰기](../guides/mcp-servers.md)에 있다.

```json
{
  "servers": {
    "issues": { "command": "npx", "args": ["-y", "@acme/issues-mcp"], "env": { "ISSUES_TOKEN": "${ISSUES_TOKEN}" } },
    "docs": { "url": "https://mcp.acme.dev/docs", "headers": { "Authorization": "Bearer ${DOCS_TOKEN}" } }
  }
}
```

| 필드 | 규칙 |
| --- | --- |
| `servers` | 필수. 서버 이름(영문자·숫자·`-`·`_`, 64자까지)마다 서버 하나. 다른 최상위 키는 거부한다 |
| `command` | 로컬 서버(stdio)를 시작하는 명령. 빈 글은 거부한다. `url`과 함께 쓸 수 없다 |
| `args` | 로컬 서버의 인자 목록. 문자열만 |
| `env` | 로컬 서버의 환경 변수. 이름마다 문자열 값 |
| `url` | 원격 서버(HTTP)의 주소. `http://` 또는 `https://`로 시작해야 한다 |
| `headers` | 원격 서버의 HTTP 헤더. 이름마다 문자열 값 |

판정은 `src/mcp/servers.ts`의 `parseMcpServers`<!--s:625c4bb2291c-->가 한다. 이 밖의 필드는 에이전트가 이해하지 못할 설정을 조용히 버리지 않도록 종료 코드 64로 거부한다. 숨은 문자 검사는 규칙 파일과 같고, `profile clone`은 `mcp.json`이 심볼릭 링크인 저장소를 받지 않는다.

적용하면 고른 에이전트마다 아래 파일에 쓴다. 옮기는 규칙은 `src/mcp/targets.ts`의 `claudeEntry`<!--s:88bd8b30cfb6-->와 `codexTables`<!--s:b66a45840724-->에 있다.

| 에이전트 | 파일 | agctx가 소유하는 영역 |
| --- | --- | --- |
| Claude Code | `.mcp.json`의 `mcpServers` | `agctx.project.json`의 `managedKeys`에 적은 이름의 항목. 원격 서버에는 `"type": "http"`를 붙인다 |
| Codex | `.codex/config.toml` | `# agctx:managed:start`와 `# agctx:managed:end` 사이의 블록. 파일 끝에 둔다. 서버마다 `[mcp_servers.<이름>]` 표 하나 |

- **Codex로 옮기는 값:** 값 전체가 `${이름}`인 같은 이름의 환경 변수는 `env_vars`, 값 전체가 `${VAR}`인 헤더는 `env_http_headers`, `Authorization: Bearer ${VAR}`는 `bearer_token_env_var`로 간다. 그 밖에 `${...}`가 든 값(URL, `command`·`args` 포함)이 있는 서버는 Codex 파일에만 빠지고 경고가 나온다. `args`·`env`·`env_vars`·`http_headers`·`env_http_headers`는 비어 있어도 적는다.
- **소유 영역의 기록:** 소유 영역의 sha256을 `managedHashes`에, 원문을 `.agctx/base/.mcp.json.base`·`.agctx/base/.codex/config.toml.base`에 둔다. JSON 원문은 키를 정렬하고 두 칸 들여쓴 형태다.
- **판정:** 사람이 같은 이름의 서버를 두었으면 멈추고, 사람이 만든 설정 파일에 처음 쓰는 것은 `--adopt`로만 한다. 관리 블록 밖에서 같은 서버를 정의했는지는 표 머리, 점 표기 키, 인라인 표를 모두 보는 `src/mcp/toml.ts`의 `definedServers`<!--s:35ff1886d569-->가 찾는다. 계획은 `src/project/mcp-plan.ts`의 `planMcpFiles`<!--s:e7c6f27be8bb-->가 세운다.

## skills·subagents·hooks

<!-- agctx-doc-sources: src/artifacts/definitions.ts, src/artifacts/profile-files.ts, src/artifacts/targets.ts, src/artifacts/hooks-merge.ts, src/project/artifact-plan.ts -->
<!-- agctx-doc-sources-sha256: e39bee3610a83371b6d5375466a6f7d99b257cd2ac793f3ac5cb955ae7a648e9 -->

프로필 폴더 루트에 두는 skill·subagent·hook 정의다. 쓰는 법은 [팀 skills·subagents·hooks 나눠 쓰기](../guides/skills-subagents-hooks.md)에 있다. 판정은 `src/artifacts/definitions.ts`의 `parseProfileArtifacts`<!--s:32c68e98acb5-->가 하고, 틀리면 종료 코드 64로 멈춘다.

| 파일 | 규칙 |
| --- | --- |
| `skills/<이름>/SKILL.md` | 머리말에 폴더 이름과 같은 `name`, 한 줄 `description`. 이름은 소문자·숫자·하이픈 64자까지. 같은 폴더의 다른 파일도 함께 복사한다 |
| `subagents/<이름>.md` | 머리말에 파일 이름과 같은 `name`, 한 줄 `description`. 머리말 뒤의 본문이 지시다. 하위 폴더는 거부한다 |
| `hooks.json` | `{ "hooks": { "<hook 이름>": { "<에이전트>": { "<이벤트>": [ … ] } } } }`. 에이전트는 `claude`·`codex`·`antigravity`, 이벤트는 그 에이전트 문서의 목록(`src/artifacts/definitions.ts`의 `HOOK_EVENTS`<!--s:eb138d3b276e-->) 안에서만 받는다. 항목은 `{ "matcher": "…", "hooks": [ { "type": "command", "command": "…" } ] }`이고 처리기의 다른 키(`timeout` 등)는 그대로 옮긴다 |

- 텍스트가 아닌 파일, 심볼릭 링크, 숨은 문자가 든 파일은 거부한다. Git 프로필은 추적 중이거나 `.gitignore`가 가리지 않은 파일만 읽고, Git이 아닌 프로필은 `__pycache__`·`node_modules` 같은 부산물 폴더를 건너뛴다(`src/artifacts/profile-files.ts`의 `workingArtifactFiles`<!--s:b604d6ec5c44-->). 고정한 저장소는 기록한 커밋의 파일을 읽는다.
- 쓰는 곳은 `src/artifacts/targets.ts`의 `SKILL_ROOTS`<!--s:a17f7ad11104-->·`SUBAGENT_TARGETS`<!--s:76263bc9767f-->·`HOOK_TARGETS`<!--s:73db9d115065-->에 있다.

| 종류 | Claude Code | Codex | agctx가 소유하는 영역 |
| --- | --- | --- | --- |
| skills | `.claude/skills/<이름>/` | `.agents/skills/<이름>/`(Antigravity도 이 폴더를 읽는다) | 쓴 파일 하나하나의 내용 전체 |
| subagents | `.claude/agents/<이름>.md`(그대로) | `.codex/agents/<이름>.toml`(`name`·`description`·`developer_instructions`) | 쓴 파일의 내용 전체 |
| hooks | `.claude/settings.json`의 `hooks` | `.codex/hooks.json`의 `hooks` | `managedKeys`의 `<이벤트>:<해시>`와 같은 matcher 묶음(`src/artifacts/hooks-merge.ts`의 `groupKey`<!--s:caa2c8d7d7b9-->) |

- **skills·subagents의 판정:** 같은 skill 폴더나 subagent 파일에 agctx가 쓰지 않은 다른 내용의 파일이 있으면 `project.artifact-taken`(2)으로 멈추고 `--adopt`로도 덮어쓰지 않는다. 내용이 프로필과 같은 파일은 맡는다. agctx가 이미 쓰고 있는 skill 폴더에 사람이 더한 다른 파일은 그대로 둔다.
- **hooks의 판정:** 사람이 만든 설정 파일에 처음 쓰는 것은 `--adopt`로만 한다. `hooks`가 객체가 아니거나 값이 배열이 아니면 `project.invalid-hooks-file`(64)로 멈춘다. agctx의 묶음은 이벤트 배열 끝에 넣고, 빼면 agctx 것만 남았던 `.codex/hooks.json`은 지운다.
- **기록:** 소유 영역의 sha256을 `managedHashes`에, 원문을 `.agctx/base/<경로>.base`에 둔다. hooks의 원문은 이벤트별 묶음을 키를 정렬해 두 칸 들여쓴 JSON이다. 계획은 `src/project/artifact-plan.ts`의 `planArtifactFiles`<!--s:c403f51e0f8f-->가 세운다.

## link.json

<!-- agctx-doc-sources: src/profile/store.ts, src/profile/link.ts -->
<!-- agctx-doc-sources-sha256: 003a720ac7b39955cb4f01f6e177ef293593bb457c574b8d4ad134ab8f26ec9a -->

`profile link`로 연결한 프로필이 보관함의 `profiles/<이름>/`에 두는 포인터다. `profile.json`과 규칙 파일은 가리키는 폴더에 있다.

```json
{
  "schemaVersion": 1,
  "path": "/work/team-rules",
  "scope": "personal",
  "instructions": "templates/AGENTS.md"
}
```

- 읽으려면 `schemaVersion`(1)과 `path`가 있어야 한다. `scope`와 `instructions`는 그 폴더의 `profile.json`에서 마지막으로 읽은 용도와 규칙 파일이다. `profile link`를 다시 실행하거나 그 프로필을 쓰는 명령이 읽을 때마다 갱신한다. 끊긴 링크를 되살리는 안내 명령(`agctx profile link <경로> --name <name> --scope <scope> --instructions <file>`)에 이 값을 넣는다. 평소에는 연결한 폴더의 `profile.json`이 정본이고, 이 값은 읽지 않는다.
- `link.json`이 있고 `profile.json`이 없는 보관함 폴더만 포인터로 본다. 받아 온 저장소가 루트에 자기 `link.json`을 가지고 있어도 사본 프로필이다. 판정은 `src/profile/store.ts`의 `isPointerFolder`<!--s:3cf97987e045-->가 한다.
- `path`는 절대 경로다. 그 폴더가 없거나(`missing-folder`), 그 폴더의 `profile.json`이 없거나(`missing-metadata`) 이 프로필의 것이 아니거나(`invalid-metadata`), `profile.json`이 가리키는 규칙 파일이 없거나(`missing-rules`), `link.json`을 읽을 수 없으면(`invalid-link`) 끊긴 링크다. `invalid-link`의 `path`는 `link.json` 파일의 경로다. `profile link`가 생기기 전에 손으로 만든 운영체제 심볼릭 링크도 가리키던 폴더가 없어지면 `missing-folder`인 끊긴 링크다. `profile list`는 이유와 함께 따로 보여 주고(`--json`이면 `brokenLinks`의 `{ name, path, reason }`), 그 프로필을 쓰는 명령은 가리키던 경로를 알리며 멈춘다. 판정은 `src/profile/store.ts`의 `profileLocation`<!--s:db62a3ef2844-->이 하고, 목록은 `src/profile/store.ts`의 `readStore`<!--s:e6650e618cc1-->가 모은다.
- 형식이 틀리면 읽을 수 없다고 멈춘다. `profile remove`로 지운 뒤 다시 연결한다.
- `profile remove`는 이 파일이 든 보관함 폴더만 지우고, 가리키는 폴더는 건드리지 않는다.
- `profile list --json`의 `profiles` 항목에는 연결한 프로필에만 `link`(가리키는 경로)가 붙는다.

## .agctx-install.json

<!-- agctx-doc-sources: src/skills/install.ts -->
<!-- agctx-doc-sources-sha256: 9b95f4b49a6e2e0cf08166e860ad9b8133e091fd6ceaa40bb6168dc62eddc1fb -->

`agctx install`이 에이전트의 스킬 폴더(예: `~/.claude/skills/agctx/`)마다 두는 설치 기록이다. 이 파일이 있고 폴더의 파일이 기록과 같아야 agctx가 둔 폴더로 보고, 다시 설치할 때 바꾸거나 `agctx uninstall`로 지운다.

```json
{
  "schemaVersion": 1,
  "version": "0.5.0",
  "files": {
    "SKILL.md": "be91396dda8f024e20a2a365bb902958d61617dd0e74b3c857f66cff951af230"
  }
}
```

- `version`은 설치한 CLI의 버전이다. 모든 명령이 이 값을 지금 CLI의 버전과 비교하고, 다르면 `agctx install`을 다시 실행하라고 알린다.
- `files`는 이 기록을 뺀 폴더 안 파일마다 `/`로 나눈 경로와 sha256이다. 파일이 이 값과 다르거나 기록이 없는 폴더는 `--force` 없이는 바꾸거나 지우지 않는다. 판정은 `src/skills/install.ts`의 `planInstall`<!--s:32bd2c1d333d-->과 `planUninstall`<!--s:0612b36435ed-->이 한다.

## repos.json

<!-- agctx-doc-sources: src/repos/registry.ts -->
<!-- agctx-doc-sources-sha256: 60991ac650375f4bab62b0ab25311fa3f6af94902a84ed68c188eebb1d443dbf -->

`$AGCTX_HOME/repos.json`(기본 `~/.agctx/repos.json`)은 이 컴퓨터에서 프로필을 적용한 저장소 목록이다. `{ "schemaVersion": 1, "repos": [...] }` 형식이고 항목마다 `path`(폴더의 실제 경로)·`profile`·`pinned`·`updatedAt`이 있다. 어떤 저장소에도 커밋하지 않는다.

## .agctx/

| 경로 | 뜻 | 커밋 |
| --- | --- | --- |
| `.agctx/base/<경로>.base` | 마지막으로 쓴 관리 영역 원문. 충돌을 풀 때 기준 | 한다 |
| `.agctx/backups/<시각>/` | `profile resolve --discard`가 덮어쓰기 전에 남긴 백업 | 하지 않는다 |
| `.agctx/.gitignore` | `backups/`를 커밋에서 뺀다 | 한다 |

## 관리 표지

| 표지 | 위치 | 뜻 |
| --- | --- | --- |
| `<!-- agctx:managed:start -->` ~ `<!-- agctx:managed:end -->` | `CLAUDE.md`, `.agents/rules/agctx.md`, 하위 폴더 연결 파일 | agctx가 다시 만드는 블록 |
| `<!-- agctx:managed:end -->` | 프로젝트 `AGENTS.md` | 파일 처음부터 이 줄까지가 프로필 영역, 아래는 프로젝트 영역([ADR 0034](../adr/0034-managed-end-marker-in-agents-md.md)) |
| `## N. Project rule extensions` 또는 `## N. 프로젝트 규칙 확장` | 프로젝트 `AGENTS.md` | 마커가 아직 없는 파일에서만 경계 노릇을 한다. `profile sync`가 마커를 넣으면 평범한 제목이 된다 |
| `<!-- agctx:guidance:start -->` ~ `<!-- agctx:guidance:end -->` | 프로필의 규칙 파일(`AGENTS.md` 또는 `instructions`가 가리킨 파일) | `profile setup`이 다시 쓰는 지침 블록. 프로젝트에 적용할 때는 표지만 빠지고 본문은 그대로 간다 |
