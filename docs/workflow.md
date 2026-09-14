# 사용자 워크플로

이 문서는 `@isthis/agentic` 사용 절차를 순서와 소유권 중심으로 요약한다. 개념과 설명은 [사용 가이드](usage-guide.md)에, 명령·옵션의 세부 문법은 [CLI Reference](cli-reference.md)에 있다.

<!-- agentic-doc-sources: bin/agentic.mjs, bin/agt.mjs, bin/analyzer.mjs, bin/conflicts.mjs, bin/contracts.mjs, bin/fs-utils.mjs, bin/i18n.mjs, bin/merge-editor.mjs, bin/project-plan.mjs -->
<!-- agentic-doc-sources-sha256: 720aa740e348b9fa5b67935591063d52cd0363ab7701563acd4efb0b1a190b67 -->

> [!TIP]
> 가장 간단한 사용법은 `agt` 또는 `agentic`만 입력해 메인 TUI를 여는 것이다. 메인 메뉴에서 프로필 관리·생성·설정과 도움말에 접근할 수 있다.

## 절차

1. **생성**: `agt profile create [<name>] [--scope <scope>]`
2. **설정**: `agt profile setup [<name>] [--tdd <level> ...]`
3. **적용**: `agt profile apply <name> <project>` (먼저 `--dry-run`으로 계획 확인 가능)
4. **개발**: 평소 쓰는 에이전트에 작업 의뢰. 에이전트가 프로젝트 `AGENTS.md`를 읽고 작업한다
5. **동기화**: 프로필을 고친 뒤 `agt profile sync <project>`로 관리 영역만 재적용
6. **충돌 해결**: 관리 영역을 밖에서 고쳐 `apply`·`sync`가 멈추면 `agt profile sync --dry-run <project>`로 차이를 보고 `agt profile resolve <project>`로 푼다
7. **삭제**: `agt profile remove [<name>] [--yes]` (적용된 프로젝트 파일은 보존)

관리 메뉴는 `agt profile list`로 열고 scope를 고른 뒤 위 작업을 이어서 실행한다. 각 명령의 정확한 인자·옵션과 TUI·자동화 방식은 [CLI Reference](cli-reference.md)를 따른다.

## 명령의 소유권

| 주체          | 책임                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| 사용자        | 프로필 선택·설정 승인, 적용 대상과 변경 diff 검토, 프로젝트 도메인 지침 관리 |
| Agentic       | 프로필·지침 파일 생성, 선택된 프로필의 동기화, 포인터 산출물 제공            |
| AI 에이전트   | 지침을 읽고 프로젝트 코드·테스트를 변경하며 결과를 보고                      |
| 대상 프로젝트 | 비즈니스 코드·데이터·도메인 지침·검증 명령 보유                              |

명령의 인자·옵션과 생성 파일 형식은 [CLI Reference](cli-reference.md)를 따르고 아직 구현되지 않은 계획은 [아키텍처 구현 계획](discussion/architecture/)에서 확인한다.
