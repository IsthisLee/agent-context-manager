# 설치

<!-- agctx-doc-sources: package.json -->
<!-- agctx-doc-sources-sha256: fadb8efeb76c759982c4bddd4ba199381a67fed127c4967bf80e3e6f5f693f7a -->

agctx는 npm 패키지 `agent-context-manager`로 배포되고, 설치하면 `agctx` 명령이 생긴다. Node.js 22 이상이 필요하다.

```bash
npm install -g agent-context-manager
agctx help
```

- 설치하지 않고 한 번만 쓰려면 `npx agent-context-manager <명령>`으로 실행한다. CI에서 쓰는 예시는 [CI와 자동화에서 쓰기](../guides/ci.md)에 있다.
- 터미널에서 인자 없이 `agctx`를 실행하면 메인 TUI가 열려 프로필 만들기·설정·적용을 메뉴로 진행한다.
- Git 프로필 명령과 `check --refresh`에는 `git`이 필요하다. `repos pr`이 PR까지 열려면 GitHub CLI `gh`가 필요하다.
- 표시 언어는 영어가 기본이다. 한국어는 `--lang ko`, `AGCTX_LANG=ko`, `agctx config lang ko` 가운데 하나로 고른다.
- `command not found: agctx`가 나오면 전역 bin 경로가 PATH에 없다. `npm prefix -g`로 위치를 확인해 PATH에 더한다.

다음 단계는 [빠른 시작](quick-start.md)이다.
