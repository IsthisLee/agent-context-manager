# 진행 상황

이 파일은 **지금 진행 중인 작업과 다음 세션이 이어받을 순서**만 적는다. 결정·근거·측정값은 각 정본 문서에 두고, 여기에는 링크와 다음에 할 일만 둔다. 세션을 시작할 때 읽고 끝낼 때 고친다는 규칙은 [`AGENTS.md`](AGENTS.md)의 "세션 시작과 끝" 항목이다.

## 새 세션이 시작할 순서

1. 이 파일을 읽는다.
2. `git status`와 `git log --oneline -10`으로 브랜치와 최근 변경을 확인한다. 커밋하지 않은 변경이 있으면 누구의 것인지 먼저 묻는다.
3. `pnpm run check`로 기준선을 확인한다.
4. 아래 "진행 중인 작업"의 맨 위 항목부터 정본 문서를 읽고 이어서 진행한다.

## 진행 중인 작업

### 구현 중인 논의 주제

`docs/discussion/topics.json`에서 상태가 `Implementing`인 주제다. 이 표는 `node tools/generate-progress.ts`가 만들고, "다음에 할 일"은 각 주제의 `권장 다음 작업` 칸에서 가져온다. 여기서 고치지 말고 그 문서를 고친다.

<!-- agctx:generated:in-progress:start -->
| 주제 | 다음에 할 일 |
| --- | --- |
| [자연어 요청을 통한 agctx 사용](docs/discussion/architecture/topics/agent-mediated-usage.md) | 노출과 트리거 계약은 [ADR 0029](docs/adr/0029-agent-surface-contract.md)로 확정해 구현했다. 남은 것은 명령별 `data` 필드의 스키마를 문서로 정하는 일과, 배포한 npm 패키지를 임시 프로젝트에 설치해 에이전트가 스킬대로 agctx를 호출하는 시나리오 평가다. |
| [agctx 관리 산출물의 안전한 동기화](docs/discussion/architecture/topics/managed-artifact-safety.md) | 파일별 소유권을 `agctx.project.json`에 기록하고, 마커가 없는 파일은 자동 덮어쓰지 않는 정책부터 확정한다. |
| [기본 지침의 근거 기준과 분량 예산](docs/discussion/architecture/topics/guidance-evidence-and-budget.md) | 근거 기준·문구·분량 예산은 [ADR 0024](docs/adr/0024-guidance-evidence-and-budget.md)와 [ADR 0026](docs/adr/0026-guidance-items-and-evidence-tiers.md)으로 확정해 구현했다. 남은 것은 프로젝트 `AGENTS.md` 분량 경고다. `apply`·`sync`가 200줄 초과 또는 24 KiB 이상에서 경고만 내도록 구현하고 세 인터페이스 경로의 평가를 추가한다. |
| [문서 소스 해시 게이트의 핀 범위와 승인 단위](docs/discussion/repository/topics/doc-gate-pin-scope.md) | [결정](docs/discussion/repository/topics/doc-gate-pin-scope.md#결정) 절의 구현 순서대로 진행하고, 끝나면 [측정](docs/discussion/repository/topics/doc-gate-pin-scope.md#측정) 절과 같은 방법으로 두 지표를 다시 잰다. |
<!-- agctx:generated:in-progress:end -->

### 그 밖의 일

논의 주제가 아닌 일이다. 이 표는 손으로 쓴다.

| 작업 | 정본 | 상태 | 다음에 할 일 |
| --- | --- | --- | --- |
| Claude Code의 `AGENTS.md` 직접 읽기 반영 | [에이전트 지침 로드와 전달 확인 근거](docs/references.md#에이전트-지침-로드와-전달-확인-근거) | 확인 전 | 설치된 Claude Code로 `CLAUDE.md` 없이 `AGENTS.md`를 읽는지 실측한다. 읽으면 README의 로드 설명, `explain` 판정, 관련 개념 문서를 고친다 |
| `AGENTS.md` 강조 줄이기 | [Claude Code 모범 사례](https://code.claude.com/docs/en/best-practices) | 결정됨 | 굵은 글씨가 있는 줄 가운데 꼭 필요한 몇 줄만 남긴다. 구조를 나타내는 항목 이름은 강조로 보지 않는다 |

## 알려진 한계

지금 알고 있는 약점이다. 수치와 근거는 링크한 정본에 있다.

- 문서 소스 해시 게이트는 다시 읽지 않고 stamp만 해도 통과한다. 재stamp의 44%가 본문 변경 없이 통과했다([측정](docs/discussion/repository/topics/doc-gate-pin-scope.md#측정)). 줄 번호와 코드 발췌를 없애 울릴 이유는 줄였지만([ADR 0032](docs/adr/0032-cite-code-by-name.md)), 남은 서술 문장에는 이 한계가 그대로다. 「문서 소스 해시 게이트의 핀 범위와 승인 단위」가 다룬다.
- 이름으로 가리킬 수 없는 동작(함수 안의 특정 분기 등)을 문서에서 어떻게 가리킬지는 정하지 않았다([제약](docs/discussion/repository/topics/code-citation-style.md#구현-기록-인용을-이름으로-바꾸고-두-문서를-다시-씀)).
- README와 `explain`은 Claude Code가 `CLAUDE.md`로 가져오지 않은 `AGENTS.md`를 읽지 않는다고 전제한다. v2.1.277 이상에서는 틀릴 수 있다([근거](docs/references.md#에이전트-지침-로드와-전달-확인-근거)). 「Claude Code의 `AGENTS.md` 직접 읽기 반영」이 다룬다.

## 버린 접근

같은 막다른 길을 다시 시도하지 않도록 이유와 함께 남긴다. 자세한 근거는 링크한 정본에 있다.

- 문서를 심볼 단위로 핀하는 방법: 줄 번호가 밀리는 변화를 놓친다([검토한 대안](docs/discussion/repository/topics/doc-gate-pin-scope.md#검토한-대안)).
- 규칙 파일을 폴더별 `AGENTS.md`로 나누는 방법: 루트에서 시작한 세션에 전달되지 않았다(PR #52).
- 논의 상태를 주제 문서에서 생성하거나 색인에만 쓰는 방법: [검토한 대안](docs/discussion/repository/topics/discussion-status-source.md#검토한-대안).

## 최근 기록

`main`에 병합된 최근 커밋 10개다. 이 목록은 `node tools/generate-progress.ts`가 `git log main`에서 만든다. PR은 squash로 병합되므로 브랜치의 커밋은 병합하면서 하나로 합쳐진다. 그래서 병합된 이력만 적는다. 손으로 고치지 않는다. 더 오래된 이력과 각 변경의 이유는 git 기록에서 본다.

<!-- agctx:generated:recent:start -->
- 2026-09-19: chore(release): 0.4.0 (#66)
- 2026-09-19: chore!: 라이선스를 MIT로 바꾸고 공개 운영 파일을 줄인다 (#65)
- 2026-09-19: feat: 에이전트용 스킬을 한국어로 다시 쓴다 (#64)
- 2026-09-19: feat: 에이전트를 CLI·TUI와 같은 계약 아래 두는 표면으로 만든다 (#63)
- 2026-09-19: fix: CodeQL이 워크플로 파일을 검사하지 않던 것을 고친다 (#62)
- 2026-09-19: feat!: 지침 항목의 값을 켜고 끄는 둘로 줄인다 (#61)
- 2026-09-19: fix: 스킬 설치 안내가 기여자 전용 스킬까지 설치하던 것을 고친다 (#60)
- 2026-09-19: docs: 전역 지침 공유 실측과 FAQ 항목을 더한다 (#59)
- 2026-09-18: docs: 해시 게이트의 핀 범위와 승인 단위를 논의 주제로 연다 (#57)
- 2026-09-18: docs: 지침 카탈로그를 레퍼런스로 옮기고 README 구성을 다시 짠다 (#56)
<!-- agctx:generated:recent:end -->

## 갱신 규칙

- 세션을 끝낼 때 "진행 중인 작업"의 상태와 다음에 할 일을 고쳐 그 세션의 마지막 커밋에 함께 넣는다. "최근 기록"은 `node tools/generate-progress.ts`로 다시 만든다.
- 새로 알게 된 한계는 "알려진 한계"에 링크와 함께 남기고, 해결되면 지운다.
- 해 보고 버린 접근은 이유와 함께 "버린 접근"에 남긴다.
- 끝난 작업은 표에서 지운다. 무엇을 했는지는 커밋이 남기므로 따로 적지 않는다.
- 결정·근거·측정값은 이 파일에 쓰지 않는다. 정본 문서에 쓰고 여기서는 링크한다.
