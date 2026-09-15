# 자주 묻는 질문

## agctx가 에이전트를 실행하나요?

아니다. 에이전트가 읽을 파일을 만들고 동기화할 뿐이다. 예외는 사용자가 `agctx verify --probe`로 요청할 때 전달 확인용으로 에이전트 CLI를 도구 없이 한 번 실행하는 경우다([전달 확인과 검증의 범위](concepts/verification.md)).

## 코드베이스를 분석해 프로젝트 지침을 만들어 주나요?

아니다. 초안은 각 에이전트의 `/init`으로 만들고 사람이 다듬어 `AGENTS.md`의 프로젝트 규칙 확장 섹션에 둔다. 이유는 [ADR 0006](adr/0006-no-codebase-analysis-guidance.md)에 있다.

## Cursor나 GitHub Copilot도 지원하나요?

지원하지 않는다. 지원 에이전트는 Codex·Claude Code·Antigravity다([지원 에이전트](reference/supported-agents.md)).

## 생성된 파일을 커밋해야 하나요?

커밋한다. `AGENTS.md`, `CLAUDE.md`, `.agents/rules/agctx.md`, 하위 폴더 연결 파일, `agctx.project.json`, `.agctx/base/`를 커밋해야 agctx가 없는 팀원이나 저장소만 받는 환경도 같은 규칙을 받고, CI의 `check`가 버전을 확인할 수 있다([파일 형식과 저장 위치](reference/file-formats.md)).

## 관리 영역 안을 고쳤더니 sync가 멈춰요.

관리 영역은 agctx가 다시 만드는 곳이다. `agctx profile resolve <프로젝트>`가 고친 줄을 영역 밖으로 옮겨 준다([관리 영역과 확장 영역](concepts/managed-and-extension-areas.md)).

## 모노레포 하위 폴더의 규칙이 Claude Code에 들어가지 않아요.

`agctx profile sync`가 하위 `AGENTS.md` 옆에 연결 파일을 만든다. 하위 폴더에서 시작하면 루트 규칙은 한 번 승인해야 들어간다([모노레포에서 쓰기](guides/monorepo.md)).

## 여러 컴퓨터에서 같은 프로필을 쓰려면요?

프로필을 Git 저장소에 올리고 다른 컴퓨터에서 `profile clone`한다([성격이 다른 저장소 여럿에 프로필 나눠 쓰기](guides/multi-repo-individual.md#다른-컴퓨터에서-같은-프로필-쓰기)).
