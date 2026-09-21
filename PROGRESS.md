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
| [agctx 관리 산출물의 안전한 동기화](docs/discussion/architecture/topics/managed-artifact-safety.md) | 관리 영역의 경계 표시와 포매터 차이 판정은 [ADR 0034](docs/adr/0034-managed-end-marker-in-agents-md.md)로 확정해 구현했다. 남은 것은 마커가 없는 기존 파일을 자동으로 덮어쓰지 않는 기본 정책과, 파일별 소유권을 `agctx.project.json`에 기록하는 일이다. |
| [기본 지침의 근거 기준과 분량 예산](docs/discussion/architecture/topics/guidance-evidence-and-budget.md) | 근거 기준·문구·분량 예산은 [ADR 0024](docs/adr/0024-guidance-evidence-and-budget.md)와 [ADR 0026](docs/adr/0026-guidance-items-and-evidence-tiers.md)으로 확정해 구현했다. 남은 것은 프로젝트 `AGENTS.md` 분량 경고다. `apply`·`sync`가 200줄 초과 또는 24 KiB 이상에서 경고만 내도록 구현하고 세 인터페이스 경로의 평가를 추가한다. |
| [문서 소스 해시 게이트의 핀 범위와 승인 단위](docs/discussion/repository/topics/doc-gate-pin-scope.md) | 절 단위 핀, 문서 단위 승인, 실패 원인 표시, 지문만 찍은 문서 검출까지 구현했다. 남은 것은 [결정](docs/discussion/repository/topics/doc-gate-pin-scope.md#결정)의 (1) 실행 대조 확대와 (4) 두 지표 재측정이다. 명령 출력을 싣는 문서에 시나리오 고정물을 붙여 핀을 없애고, 그 뒤에 [측정](docs/discussion/repository/topics/doc-gate-pin-scope.md#측정) 절과 같은 방법으로 다시 잰다. |
<!-- agctx:generated:in-progress:end -->

### 그 밖의 일

논의 주제가 아닌 일이다. 이 표는 손으로 쓴다.

| 작업 | 정본 | 상태 | 다음에 할 일 |
| --- | --- | --- | --- |
| `AGENTS.md` 강조 줄이기 | [Claude Code 모범 사례](https://code.claude.com/docs/en/best-practices) | 결정됨 | 굵은 글씨가 있는 줄 가운데 꼭 필요한 몇 줄만 남긴다. 구조를 나타내는 항목 이름은 강조로 보지 않는다 |

## 알려진 한계

지금 알고 있는 약점이다. 수치와 근거는 링크한 정본에 있다.

- 문서 소스 해시 게이트는 다시 읽지 않고 stamp만 해도 통과한다. 개편 전 측정에서 재stamp의 44%가 본문 변경 없이 통과했다([측정](docs/discussion/repository/topics/doc-gate-pin-scope.md#측정)). 승인을 문서 단위로 바꾸고 `--restamped`로 뒤늦게 찾아내게 했지만, 검출은 경고일 뿐 막지는 않는다. 개편 뒤의 비율은 커밋이 쌓여야 다시 잴 수 있다. 「문서 소스 해시 게이트의 핀 범위와 승인 단위」가 다룬다.
- 해시 줄을 해싱에서 빼는 처리가 문서의 첫 번째 해시 줄만 지운다. 그래서 절이 여러 개인 문서를 다시 stamp하면, 그 문서를 핀한 문서가 본문이 그대로여도 실패한다. README 두 개가 서로를 핀해 stamp를 두 번 해야 맞춰지는 것이 이 때문이다. [문서 게이트](docs/contributing/doc-gate.md#문서-소스-해시-게이트)가 약속한 동작과 다르다.
- 이름으로 가리킬 수 없는 동작(함수 안의 특정 분기 등)을 문서에서 어떻게 가리킬지는 정하지 않았다([제약](docs/discussion/repository/topics/code-citation-style.md#구현-기록-인용을-이름으로-바꾸고-두-문서를-다시-씀)).
- `explain`의 Claude Code 판정은 `explain`을 실행하는 사람의 `~/.claude/settings.json`을 읽는다. 관리 설정이나 `--settings` 파일로 `instructionFiles` 값을 준 환경, 그리고 직접 읽기가 꺼지는 세션(제삼자 제공자·telemetry 해제·설치 직후 첫 세션)은 판정할 수 없다([ADR 0035](docs/adr/0035-claude-code-reads-agents-md.md)).

## 버린 접근

같은 막다른 길을 다시 시도하지 않도록 이유와 함께 남긴다. 자세한 근거는 링크한 정본에 있다.

- 문서를 심볼 단위로 핀하는 방법: 줄 번호가 밀리는 변화를 놓친다([검토한 대안](docs/discussion/repository/topics/doc-gate-pin-scope.md#검토한-대안)).
- 규칙 파일을 폴더별 `AGENTS.md`로 나누는 방법: 루트에서 시작한 세션에 전달되지 않았다(PR #52).
- 논의 상태를 주제 문서에서 생성하거나 색인에만 쓰는 방법: [검토한 대안](docs/discussion/repository/topics/discussion-status-source.md#검토한-대안).

## 최근 기록

`main`에 병합된 최근 커밋 10개다. 이 목록은 `node tools/generate-progress.ts`가 `git log main`에서 만든다. PR은 squash로 병합되므로 브랜치의 커밋은 병합하면서 하나로 합쳐진다. 그래서 병합된 이력만 적는다. 손으로 고치지 않는다. 더 오래된 이력과 각 변경의 이유는 git 기록에서 본다.

<!-- agctx:generated:recent:start -->
- 2026-09-21: feat: 해시 게이트의 승인을 문서 단위로 좁히고 지문만 찍은 문서를 찾아낸다 (#73)
- 2026-09-21: fix!: explain이 Claude Code의 AGENTS.md 직접 읽기를 판정한다 (#72)
- 2026-09-21: docs: 관리 영역 경계 마커의 구현 기록을 논의 문서에 남긴다 (#71)
- 2026-09-21: feat!: AGENTS.md의 관리 영역 경계를 마커로 표시하고 포매터 변경을 걸러낸다 (#70)
- 2026-09-20: chore(deps): @clack/prompts를 1.8.1로 올린다
- 2026-09-20: docs: 문서가 코드를 가리키는 방식을 바꾸고 게이트 범위를 절 단위로 좁힌다 (#69)
- 2026-09-19: chore(release): 0.4.0 (#66)
- 2026-09-19: chore!: 라이선스를 MIT로 바꾸고 공개 운영 파일을 줄인다 (#65)
- 2026-09-19: feat: 에이전트용 스킬을 한국어로 다시 쓴다 (#64)
- 2026-09-19: feat: 에이전트를 CLI·TUI와 같은 계약 아래 두는 표면으로 만든다 (#63)
<!-- agctx:generated:recent:end -->

## 갱신 규칙

- 세션을 끝낼 때 "진행 중인 작업"의 상태와 다음에 할 일을 고쳐 그 세션의 마지막 커밋에 함께 넣는다. "최근 기록"은 `node tools/generate-progress.ts`로 다시 만든다.
- 새로 알게 된 한계는 "알려진 한계"에 링크와 함께 남기고, 해결되면 지운다.
- 해 보고 버린 접근은 이유와 함께 "버린 접근"에 남긴다.
- 끝난 작업은 표에서 지운다. 무엇을 했는지는 커밋이 남기므로 따로 적지 않는다.
- 결정·근거·측정값은 이 파일에 쓰지 않는다. 정본 문서에 쓰고 여기서는 링크한다.
