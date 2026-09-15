# 성격이 다른 저장소 여럿에 프로필 나눠 쓰기

<!-- agctx-doc-sources: src/repos, src/profile/git-profile.ts, src/i18n/messages-en.ts -->
<!-- agctx-doc-sources-sha256: 95e730f4dd1b21366c17e80e1e907abb4e40327bf83f57569edf5cbd4baa8714 -->

개인 블로그와 사이드 프로젝트에는 내 작업 습관을, 회사 API 서버에는 회사 규칙을 적용하는 경우다. 사용자 수준 지침 파일(`~/.claude/CLAUDE.md` 등)은 저장소를 구분하지 못하므로, 저장소마다 프로필을 골라 적용한다.

```mermaid
flowchart LR
  subgraph STORE["프로필 보관함"]
    P["personal<br/>내 작업 습관"]
    C["company<br/>회사 규칙"]
  end
  P -->|"profile apply"| BLOG["blog"]
  P -->|"profile apply"| SIDE["side-project"]
  C -->|"profile apply"| API["api-server"]
```

같은 사람이라도 저장소마다 다른 프로필을 쓴다. 개인 규칙은 개인 저장소에만, 회사 규칙은 회사 저장소에만 들어간다.

## 저장소마다 프로필 적용

```bash
agctx profile create personal --scope personal
agctx profile setup personal
agctx profile apply personal ~/work/blog
agctx profile apply personal ~/work/side-project
agctx profile apply company ~/work/api-server
```

프로젝트의 도메인 규칙은 저장소마다 `AGENTS.md`의 확장 섹션 아래에 쓴다([빠른 시작](../getting-started/quick-start.md)).

## 여러 저장소를 한 번에 맞추기

프로필 하나를 여러 저장소가 쓰면, 프로필이 바뀔 때마다 저장소를 하나씩 열지 않고 `repos` 명령으로 한 번에 맞춘다. `profile apply`·`profile sync`를 실행한 저장소는 이 컴퓨터의 목록(`~/.agctx/repos.json`)에 자동으로 기록된다. 결정과 안전 계약은 [ADR 0018](../adr/0018-multi-repository-sync.md)에 있다.

```mermaid
flowchart LR
  PULL["profile pull<br/>또는 프로필 편집"] --> STATUS["repos status<br/>뒤처진 저장소 확인"]
  STATUS -->|"고정하지 않은 저장소"| SYNC["repos sync<br/>바로 반영 · 커밋은 사람이"]
  STATUS -->|"고정한 저장소"| PR["repos pr<br/>저장소마다 브랜치·PR"]
  PR --> REVIEW["각 저장소 CI의 check와 리뷰 뒤 병합"]
```

고정하지 않은 저장소는 보관함을 따라 바로 바뀌고, 고정한 저장소는 PR을 검토하고 병합해야 새 버전을 쓴다.

### 뒤처진 저장소 보기

```bash
$ agctx repos status
behind            personal         -      -               /work/blog
ok                client-a         -      -               /work/client-a-api
behind            personal         -      -               /work/notes
Next: agctx repos sync --profile personal
```

위 출력은 실제 실행 결과에서 경로만 바꿨다. 옮기거나 지운 폴더는 `missing`으로 나오고 `agctx repos list --prune`으로 목록에서 지운다.

### 고정하지 않은 저장소 동기화

```bash
agctx repos sync --profile personal --dry-run
agctx repos sync --profile personal
```

`repos sync`는 모든 저장소의 계획을 보여 준 뒤 한 번만 묻는다. 고정한 저장소(`pinned`), 관리 파일에 커밋하지 않은 변경이 있는 저장소(`dirty`), 관리 영역을 밖에서 고친 저장소(`conflict`)는 건너뛰고 나머지를 계속한다. 쓴 파일의 커밋은 저장소마다 사람이 한다.

## 다른 컴퓨터에서 같은 프로필 쓰기

프로필 보관함은 어떤 저장소에도 커밋되지 않는다. 컴퓨터를 옮겨도 같은 개인 프로필을 쓰려면 프로필 자체를 내 Git 저장소에 올린다.

1. 보관함의 `personal` 폴더에서 `git init`과 첫 커밋을 만든 뒤 `agctx profile connect personal <내 Git 저장소 주소>`와 `agctx profile push personal`을 실행한다. 커밋은 사람이 하고 agctx는 원격 연결과 push만 한다.
2. 새 컴퓨터에서 `agctx profile clone <내 Git 저장소 주소>`를 실행한다. 프로필 이름은 받은 `profile.json`의 이름을 쓴다.
3. 이미 적용한 저장소는 커밋된 파일로 규칙을 받는다. 이후 프로필을 고치면 `agctx profile pull personal` 뒤 `agctx repos sync --profile personal`로 맞춘다.

원격 연결과 push·pull의 자세한 절차와 출력은 [팀과 Git으로 공유하기](team-sharing.md)에 있다.
