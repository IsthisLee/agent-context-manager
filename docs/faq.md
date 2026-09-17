# 자주 묻는 질문

## agctx가 에이전트를 실행하나요?

아니다. 에이전트가 읽을 파일을 만들고 동기화할 뿐이다. 예외는 사용자가 `agctx verify --probe`로 요청할 때 전달 확인용으로 에이전트 CLI를 도구 없이 한 번 실행하는 경우다([전달 확인과 검증의 범위](concepts/verification.md)).

## 코드베이스를 분석해 프로젝트 지침을 만들어 주나요?

아니다. 초안은 각 에이전트의 `/init`으로 만들고 사람이 다듬어 `AGENTS.md`의 프로젝트 규칙 확장 섹션에 둔다. 이유는 [ADR 0006](adr/0006-no-codebase-analysis-guidance.md)에 있다.

## Cursor나 GitHub Copilot도 지원하나요?

지원하지 않는다. 지원 에이전트는 Codex·Claude Code·Antigravity다([지원 에이전트](reference/supported-agents.md)).

## 생성된 파일을 커밋해야 하나요?

커밋한다. `AGENTS.md`, `CLAUDE.md`, `.agents/rules/agctx.md`, 하위 폴더 연결 파일, `agctx.project.json`, `.agctx/base/`를 커밋해야 한다. 그래야 agctx를 설치하지 않은 팀원이나 CI처럼 저장소만 받아 쓰는 환경도 같은 지침을 받고, CI의 `check`가 기록한 버전과 비교할 수 있다. `.agctx/backups/`만 커밋하지 않으며, 이 폴더는 agctx가 만든 `.agctx/.gitignore`가 이미 빼 둔다([파일 형식과 저장 위치](reference/file-formats.md)).

## 관리 영역 안을 고쳤더니 sync가 멈춰요.

관리 영역은 `apply`·`sync`가 매번 다시 만드는 곳이라, 그 안을 고치면 고친 내용을 지우지 않으려고 멈춘다. `agctx profile resolve <프로젝트>`를 실행하면 고친 줄을 관리 영역 밖(`AGENTS.md`는 프로젝트 규칙 확장 섹션 끝, `CLAUDE.md` 같은 포인터 파일은 관리 블록 아래)으로 옮기고 관리 영역을 다시 만든다([관리 영역과 확장 영역](concepts/managed-and-extension-areas.md#관리-영역을-고쳐서-멈췄을-때)).

## 모노레포 하위 폴더의 규칙이 Claude Code에 들어가지 않아요.

Claude Code는 `AGENTS.md`를 직접 읽지 않고 `CLAUDE.md`만 읽는다. `agctx profile sync`를 실행하면 하위 `AGENTS.md` 옆에 그 파일을 가져오는 `CLAUDE.md` 연결 파일을 만든다. 또 하위 폴더에서 Claude Code를 시작하면 루트 `AGENTS.md`는 시작 폴더 밖의 파일이 된다. 그래서 그 프로젝트를 처음 대화형으로 열 때 뜨는 승인 창에서 허용해야 루트 규칙도 들어간다([모노레포에서 쓰기](guides/monorepo.md)).

## 여러 컴퓨터에서 같은 프로필을 쓰려면요?

프로필 폴더를 Git 저장소로 만들어 첫 커밋을 하고, `profile connect`와 `profile push`로 내 Git 원격에 올린다. 다른 컴퓨터에서는 `profile clone <원격 주소>`로 받는다. 이미 적용한 저장소는 커밋된 파일로 지침을 받으므로 다시 적용하지 않아도 된다([성격이 다른 저장소 여럿에 프로필 나눠 쓰기](guides/multi-repo-individual.md#다른-컴퓨터에서-같은-프로필-쓰기)).
