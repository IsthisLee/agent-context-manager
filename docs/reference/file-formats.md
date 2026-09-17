# 파일 형식과 저장 위치

<!-- agctx-doc-sources: src/shared/home.ts, src/shared/types.ts, src/project/plan.ts, src/repos/registry.ts, src/profile/store.ts, src/profile/setup.ts -->
<!-- agctx-doc-sources-sha256: c70b041538181f85bd9fca4eb9ed692a0abc3c95af3353b4a90540a0ce6c04a7 -->

## 저장 위치

프로필은 `~/.agctx/profiles/<name>` 아래에 메타데이터 `profile.json`과 지침 `AGENTS.md`로 저장된다. Git 프로필이면 같은 폴더에 `.git`이 있고, 원격 주소와 추적 브랜치는 Git 설정에 둔다. 언어 설정은 `~/.agctx/config.json`, 적용한 저장소 목록은 `~/.agctx/repos.json`에 저장된다. `AGCTX_HOME` 환경변수를 설정하면 `~/.agctx` 대신 그 폴더를 쓴다. 이때 프로필은 `$AGCTX_HOME/profiles/<name>`, 언어 설정은 `$AGCTX_HOME/config.json`에 있다. `verify`는 `CODEX_HOME`(기본 `~/.codex`)과 `CLAUDE_CONFIG_DIR`(기본 `~/.claude`) 아래의 세션 기록을 읽기만 한다.

프로젝트에는 `AGENTS.md`, `CLAUDE.md`, `.agents/rules/agctx.md`, `agctx.project.json`(바인딩한 프로필·프로젝트 이름·적용 버전·관리 영역 hash), `.agctx/`(base·backups)가 생긴다.

## agctx.project.json

`profile apply`·`sync`가 프로젝트 루트에 쓰는 적용 기록이다. 모르는 키는 지우지 않고 다시 기록한다.

| 필드 | 뜻 |
| --- | --- |
| `schemaVersion` | 형식 버전. 지금은 2이며 1로 기록된 파일도 읽는다 |
| `profile` | 적용한 프로필 이름. `sync`가 이 값을 쓴다 |
| `projectName` | `AGENTS.md`에 쓴 프로젝트 이름. 다른 이름의 폴더에서도 같은 결과를 만든다 |
| `source` | Git 프로필이면 `{ git, branch, commit }`. URL의 사용자 정보와 토큰은 지운다 |
| `pin` | `--pin`으로 고정했으면 `true` |
| `uncommitted` | 커밋하지 않은 프로필 수정으로 적용했으면 `true` |
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

프로필 폴더의 메타데이터다. `profile create`가 `schemaVersion`(1)·`name`·`scope`·`createdAt`을 쓰고, `profile setup`이 고른 수준을 `settings`에, 고친 시각을 `updatedAt`에 더한다.

## repos.json

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
| `## N. Project rule extensions` 또는 `## N. 프로젝트 규칙 확장` | 프로젝트 `AGENTS.md` | 이 제목 위는 프로필 영역, 아래는 프로젝트 영역 |
| `<!-- agctx:guidance:start -->` ~ `<!-- agctx:guidance:end -->` | 프로필 `AGENTS.md` | `profile setup`이 다시 쓰는 지침 블록 |
