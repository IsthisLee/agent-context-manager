# 0008. 관리 영역 충돌을 보여 주고 마지막 적용본(base)으로 복구한다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-14
* **결정자:** 제품 소유자·개발자
* **관련:** [관리 산출물의 안전한 동기화](../discussion/architecture/topics/managed-artifact-safety.md) 논의의 충돌 시각화·복구를 구현으로 확정한다. 모델 호출과 에이전트 런타임을 범위 밖에 둔 [ADR 0001](0001-product-scope.md) 안에서 동작한다. `--edit`의 적용 조건은 [ADR 0010](0010-edit-merge-regenerates-managed-area.md)이 대체한다.

## 배경 (Context)

`profile apply`·`profile sync`는 `agentic.project.json`에 기록한 관리 영역 hash와 현재 파일이 다르면 `Managed file changed outside Agentic: <file>` 한 줄만 출력하고 멈췄다. 임시 프로젝트로 재현한 결과는 다음과 같다.

- `--dry-run`, 같은 프로필로 다시 `apply`, 다른 프로필로 `apply`, 파일을 지운 뒤 `sync`가 모두 같은 오류로 멈췄다. 사용자는 무엇이 달라졌는지 볼 수단이 없었다.
- 기록된 것은 hash뿐이라 원래 관리 영역을 보여 주거나 되돌릴 수 없었다.
- 사용 가이드의 마지막 복구 절차(`agentic.project.json`을 치우고 `apply`)는 관리 영역 안의 편집을 경고 없이 버렸다.

## 검토한 대안 (Options)

1. **멈춤을 유지하고 문서로만 안내한다.** 구현 비용은 없지만 사용자가 차이를 볼 수 없고 git이 없는 프로젝트는 원본을 되찾을 수 없다.
2. **`--force` 덮어쓰기를 둔다.** 관리 영역 안의 편집을 잃는다. 논의 문서가 기본 경로로 금지한 방식이다.
3. **hash만으로 판정한다.** 지금 다시 만든 관리 영역의 hash가 기록과 같으면 사용자 편집을 정확히 가려낼 수 있다. 하지만 그 사이 프로필이나 템플릿이 바뀌면 사용자 편집과 프로필 변경이 섞여 가려낼 수 없다.
4. **마지막으로 쓴 관리 영역 원문(base)을 저장한다.** 프로필이 바뀌어도 base를 기준으로 사용자 편집만 가려낼 수 있고 VS Code 3-way merge에 base로 넘길 수 있다. 저장 위치로는 `agentic.project.json` 안의 문자열과 `.agentic/base/` 아래 파일을 비교했다. JSON 안에 두면 파일은 늘지 않지만 줄바꿈이 `\n`으로 이스케이프된 긴 diff가 생기고 편집기에 넘기려면 임시 파일로 풀어야 한다.
5. **diff 구현:** 직접 구현한 줄 단위 LCS, `diff`(jsdiff), `fast-diff`·`diff-match-patch`를 비교했다.
6. **편집기 연동:** 두 파일만 받는 `code --diff`와 base가 필요한 `code --wait --merge <path1> <path2> <base> <result>`를 비교했다.

## 결정 (Decision)

4번을 채택하고 다음을 구현한다.

- **base 저장:** `apply`·`sync`·`resolve`가 성공할 때 관리 파일마다 관리 영역 원문을 `.agentic/base/<프로젝트 상대 경로>.base`에 쓴다. `sha256(base) === managedHashes[path]`를 불변식으로 둔다. 파일로 두어 PR에서 일반 텍스트 diff로 보이게 하고 git에 커밋해 팀원도 같은 기준으로 충돌을 풀게 한다. `.base` 접미사는 에이전트가 하위 폴더의 `CLAUDE.md`·`AGENTS.md`로 읽지 않게 하려는 것이다.
- **마지막 적용본을 아는 조건:** base 파일의 hash가 기록과 같거나, base가 없더라도 지금 다시 만든 관리 영역의 hash가 기록과 같을 때다.
- **충돌 표시:** 실제 `apply`·`sync`는 계속 파일을 쓰지 않고 멈추되, 충돌 파일 전체와 `profile sync --dry-run`·`profile resolve` 명령을 함께 출력한다. `--dry-run`은 계획을 끝까지 출력하고 충돌 파일을 `conflict`로 표시하며 diff를 보여 준 뒤 종료 코드 1로 끝난다. 실제 실행이 실패할 상황을 CI와 에이전트가 성공으로 오인하지 않게 하려는 것이다.
- **`profile resolve [--dry-run] [--discard] [--edit] <project>`:**
  - 마지막 적용본을 알면 관리 영역 안에서 추가·수정한 줄을 관리 영역 밖으로 옮긴다. 포인터 파일은 관리 블록 바로 아래, `AGENTS.md`는 확장 섹션 끝이다. 관리 영역은 현재 프로필로 새로 만든다. 지운 줄은 되살아나며 개수를 보고한다.
  - 파일이 없으면 다시 만든다.
  - 마지막 적용본을 모르면 diff를 보여 주고 멈춘다. `--discard`를 명시하면 현재 파일을 `.agentic/backups/<ISO 시각>/`에 복사한 뒤 새로 만든다. 백업은 `.agentic/.gitignore`로 커밋에서 뺀다.
  - `--edit`은 VS Code 3-way merge 편집기를 열고, 편집기를 닫은 뒤 결과 파일의 관리 영역이 새로 만든 관리 영역과 같을 때만 적용한다.
  - 풀 수 없는 충돌이 하나라도 남으면 어떤 파일도 쓰지 않는다.
- **diff:** 사용자가 검증된 라이브러리를 선택해 `diff`(jsdiff) 9를 런타임 의존성으로 추가한다. BSD-3-Clause이고 런타임 의존성이 없으며 ESM을 제공한다. 확인 시점 기준 주간 다운로드는 약 1억 200만 회, 최근 게시는 2026-04였다. `fast-diff`와 `diff-match-patch`는 각각 2023년, 2022년 이후 새 버전이 없어 제외했다.
- **기록 키:** `managedHashes` 키를 `/` 경로로 통일한다. 이전 코드가 `path.relative`로 키를 만들어 Windows에서 `\` 키가 기록될 수 있었으므로 `\` 키도 읽는다.
- **인터페이스:** CLI 명령, `profile list` 관리 메뉴의 `프로젝트 충돌 해결`, TUI에서 `apply`·`sync`가 충돌로 멈췄을 때 이어지는 해결 흐름을 함께 제공하고 `PROFILE_OPERATION_CONTRACT`에 등록한다.

## 결과 및 영향 (Consequences)

- 적용한 프로젝트에 `.agentic/base/*.base` 5개와 `.agentic/.gitignore`가 생긴다. 프로필을 갱신할 때마다 base diff가 PR에 함께 올라온다.
- base가 없는 기존 프로젝트는 다음 성공한 `apply`·`sync`부터 base가 생긴다. 그 전에 프로필까지 바뀐 충돌은 `--discard`로만 풀 수 있다. `.agentic/`를 지워도 다음 `apply`·`sync`가 다시 만든다.
- 평가: `evals/conflicts.test.mjs`(순수 함수 7개)와 `evals/conflict-resolve.test.mjs`(CLI 18개)가 충돌 메시지, dry-run 표시와 종료 코드, 파일 누락, base 저장, 자동 해결, 프로필 변경, base 없음, `--discard`, 지운 줄 복원, `--dry-run`, `--edit`의 적용·거부·`code` 없음을 고정한다. `--edit`은 PATH에 둔 가짜 `code` 스크립트로 평가한다.
- **약한 곳:**
  - 템플릿 줄을 고친 편집은 고친 줄이 밖으로 옮겨지고 원래 줄이 되살아나 비슷한 문장이 두 번 남을 수 있다. resolve 출력이 이를 알린다.
  - 실제 VS Code 창과 Windows의 `code.cmd` 실행은 자동 평가로 확인하지 않는다.
  - TUI의 해결 흐름은 등록 계약만 평가하고 대화형 조작은 평가하지 않는다.
  - 여러 파일 전체 롤백, 마커 없는 기존 파일 정책, 마커 손상 진단은 이 결정의 범위 밖이며 논의 문서의 후속 과제로 남는다.
