# 파일 형식과 저장 위치


## 저장 위치

<!-- agctx-doc-sources: src/shared/home.ts -->
<!-- agctx-doc-sources-sha256: 4f44840c1ba3bb152200dbff3b5c94090a8d18f85bf22ee77d82b3e1572d19cf -->

프로필은 `~/.agctx/profiles/<name>` 아래에 메타데이터 `profile.json`과 규칙 파일로 저장된다. 규칙 파일은 기본으로 `AGENTS.md`이고, `profile.json`의 `instructions`가 다른 파일을 가리킬 수 있다([profile.json](#profilejson)). Git 프로필이면 같은 폴더에 `.git`이 있고, 원격 주소와 추적 브랜치는 Git 설정에 둔다. 언어 설정은 `~/.agctx/config.json`, 적용한 저장소 목록은 `~/.agctx/repos.json`에 저장된다. `AGCTX_HOME` 환경변수를 설정하면 `~/.agctx` 대신 그 폴더를 쓴다. 이때 프로필은 `$AGCTX_HOME/profiles/<name>`, 언어 설정은 `$AGCTX_HOME/config.json`에 있다. `verify`는 `CODEX_HOME`(기본 `~/.codex`)과 `CLAUDE_CONFIG_DIR`(기본 `~/.claude`) 아래의 세션 기록을 읽기만 한다.

프로젝트에는 `AGENTS.md`, `CLAUDE.md`, `.agents/rules/agctx.md`, `agctx.project.json`(적용한 프로필·프로젝트 이름·적용 버전·관리 영역 해시), `.agctx/`(마지막 적용본 `base/`, 충돌을 풀 때 만드는 백업 `backups/`)가 생긴다.

## agctx.project.json

<!-- agctx-doc-sources: src/project/plan.ts, src/shared/types.ts -->
<!-- agctx-doc-sources-sha256: 7802d33cfaa9d340d579ddb8710df414914e0c7848db50be7e68133db714e0be -->

`profile apply`·`sync`가 프로젝트 루트에 쓰는 적용 기록이다. 다시 쓸 때 아래 표에 없는 키(사람이나 다른 도구가 넣은 값)도 지우지 않고 그대로 남긴다.

| 필드 | 뜻 |
| --- | --- |
| `schemaVersion` | 형식 버전. 지금은 2이며 1로 기록된 파일도 읽는다 |
| `profile` | 적용한 프로필 이름. `sync`가 이 값을 쓴다 |
| `projectName` | `AGENTS.md`에 쓴 프로젝트 이름. 팀원이 저장소를 다른 이름의 폴더로 clone해도 이 이름을 쓰므로, `sync` 결과가 폴더 이름에 따라 달라지지 않는다 |
| `source` | Git 프로필이면 `{ git, branch, commit }`. URL의 사용자 정보와 토큰은 지운다 |
| `pin` | `--pin`으로 고정했으면 `true` |
| `uncommitted` | 프로필의 규칙 파일이나 `profile.json`에 커밋하지 않은 수정이 있는 상태로 적용했으면 `true`. 그 수정은 원격에 없어 다른 사람이 같은 내용을 받을 수 없으므로 `check`가 뒤처짐(1)으로 알린다 |
| `managedHashes` | 관리 파일 경로(`/` 구분)마다 관리 영역의 sha256. 줄 끝을 LF로 맞춘 내용으로 계산하므로 CRLF로 체크아웃한 파일도 같은 값이 된다. 하위 폴더 연결 파일도 들어간다 |

```json
{
  "schemaVersion": 2,
  "profile": "team-backend",
  "projectName": "orders-api",
  "source": {
    "git": "/work/team-backend.git",
    "branch": "main",
    "commit": "39ca6e115f85ffa4178c86326f24c313253a4c9e"
  },
  "pin": true,
  "managedHashes": {
    "AGENTS.md": "e60685b9…",
    "CLAUDE.md": "b4a3d190…",
    ".agents/rules/agctx.md": "df4f0e9c…"
  }
}
```

## profile.json

<!-- agctx-doc-sources: src/profile/store.ts, src/profile/setup.ts -->
<!-- agctx-doc-sources-sha256: 8f249e2ea0a0cc9bc516001bbfd786bd0dc08aeaedc51969c8f400373ea0c9d2 -->

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

판정은 `src/profile/store.ts`의 `isValidProfileMetadata`<!--s:d0109c71d11e-->와 `isInstructionsPath`<!--s:77864c748c5b-->가 하고, 원격에서 받은 파일의 링크 검사는 `src/profile/store.ts`의 `regularFileInside`<!--s:3b89d29d5e13-->와 `src/shared/git.ts`의 `committedFile`<!--s:57e01f0132f4-->이 한다. 고정한 프로젝트가 기록한 커밋에서 규칙 파일을 찾는 일은 `src/profile/git-profile.ts`의 `committedProfile`<!--s:11ddd4e196f4-->이 한다.

## .agctx-install.json

<!-- agctx-doc-sources: src/skills/install.ts -->
<!-- agctx-doc-sources-sha256: b061df79fc794972b3a42b4bb09d4a328ba7a547a2ea5fd602cfbc2630b58eb4 -->

`agctx install`이 에이전트의 스킬 폴더(예: `~/.claude/skills/agctx/`)마다 두는 설치 기록이다. 이 파일이 있고 폴더의 파일이 기록과 같아야 agctx가 둔 폴더로 보고, 다시 설치할 때 바꾸거나 `agctx uninstall`로 지운다.

```json
{
  "schemaVersion": 1,
  "version": "0.4.0",
  "files": {
    "SKILL.md": "be91396dda8f024e20a2a365bb902958d61617dd0e74b3c857f66cff951af230"
  }
}
```

- `version`은 설치한 CLI의 버전이다. 모든 명령이 이 값을 지금 CLI의 버전과 비교하고, 다르면 `agctx install`을 다시 실행하라고 알린다.
- `files`는 이 기록을 뺀 폴더 안 파일마다 `/`로 나눈 경로와 sha256이다. 파일이 이 값과 다르거나 기록이 없는 폴더는 `--force` 없이는 바꾸거나 지우지 않는다. 판정은 `src/skills/install.ts`의 `planInstall`<!--s:bf01a108b299-->과 `planUninstall`<!--s:1e60481a2e98-->이 한다.

## repos.json

<!-- agctx-doc-sources: src/repos/registry.ts -->
<!-- agctx-doc-sources-sha256: 27b931137e98513f178f3920dea7d305170bbffb2a2efeafbb8968b996ebd53a -->

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
