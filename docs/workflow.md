# 사용자 워크플로

이 문서는 `agent-context-manager` 사용 절차를 순서와 소유권 중심으로 요약한다. 개념과 설명은 [사용 가이드](usage-guide.md)에, 명령·옵션의 세부 문법은 [CLI Reference](cli-reference.md)에 있다.

<!-- agctx-doc-sources: src -->
<!-- agctx-doc-sources-sha256: 08cae775597efe09750a882d3bf85a1602471055650c542cd8458f5b77ab9196 -->

> [!TIP]
> 가장 간단한 사용법은 `agctx`만 입력해 메인 TUI를 여는 것이다. 메인 메뉴에서 프로필 관리·생성·설정과 도움말에 접근할 수 있다.

## 절차

1. **생성**: `agctx profile create [<name>] [--scope <scope>]`
2. **설정**: `agctx profile setup [<name>] [--tdd <level> ...]`
3. **적용**: `agctx profile apply <name> <project>` (먼저 `--dry-run`으로 계획 확인. 터미널이 아닌 환경에서는 `--yes`를 붙여야 파일을 쓴다)
4. **개발**: 평소 쓰는 에이전트에 작업 의뢰. 에이전트가 프로젝트 `AGENTS.md`를 읽고 작업한다
5. **동기화**: 프로필을 고친 뒤 `agctx profile sync <project>`로 관리 영역만 재적용
6. **충돌 해결**: 관리 영역을 밖에서 고쳐 `apply`·`sync`가 멈추면 `agctx profile sync --dry-run <project>`로 차이를 보고 `agctx profile resolve <project>`로 푼다
7. **삭제**: `agctx profile remove [<name>] [--yes]` (적용된 프로젝트 파일은 보존)

관리 메뉴는 `agctx profile list`로 열고 scope를 고른 뒤 위 작업을 이어서 실행한다. 각 명령의 정확한 인자·옵션과 TUI·자동화 방식은 [CLI Reference](cli-reference.md)를 따른다.

### 팀 공유와 CI 확인

1. **공유 시작(관리자)**: 프로필 폴더에서 `git init`·첫 커밋을 만든 뒤 `agctx profile connect <name> <git-url>` → `agctx profile push <name>`
2. **받기(구성원)**: `agctx profile clone <git-url>` → `agctx profile apply <name> <project>` (검토한 커밋에 머물려면 `--pin`)
3. **갱신 반영**: 관리자가 커밋해 `profile push`하면 구성원은 `agctx profile status --refresh` → `agctx profile pull <name>` → `agctx profile sync <project>` (고정한 프로젝트는 `agctx profile apply <name> <project> --pin`)
4. **CI 확인**: `agctx check --refresh <project>` (종료 코드 1은 뒤처짐, 2는 관리 영역 충돌, 3은 숨은 문자)

절차의 설명과 CI 예시는 [사용 가이드](usage-guide.md#팀과-git으로-공유하기)에 있다.

## 명령의 소유권

| 주체          | 책임                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| 사용자        | 프로필 선택·설정 승인, 적용 대상과 변경 diff 검토, 프로젝트 도메인 지침 관리 |
| agctx       | 프로필·지침 파일 생성, 선택된 프로필의 동기화, 포인터 산출물 제공, 적용 버전 기록·검사 |
| AI 에이전트   | 지침을 읽고 프로젝트 코드·테스트를 변경하며 결과를 보고                      |
| 대상 프로젝트 | 비즈니스 코드·데이터·도메인 지침·검증 명령 보유                              |
| Git 호스트    | 프로필 원격 저장소의 권한·리뷰·변경 이력                                     |
| CI            | `agctx check`로 저장소가 기록한 프로필 버전과 맞는지 확인                    |

명령의 인자·옵션과 생성 파일 형식은 [CLI Reference](cli-reference.md)를 따르고 아직 구현되지 않은 계획은 [아키텍처 구현 계획](discussion/architecture/)에서 확인한다.
