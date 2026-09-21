# 0035. Claude Code가 AGENTS.md를 직접 읽는 조건을 explain 판정에 반영한다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-21
* **결정자:** 제품 소유자
* **근거:** [에이전트 지침 로드와 전달 확인 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)
* **관련:** [ADR 0019](0019-explain-verify-and-agent-skills.md)가 정한 `explain`·`verify`·스킬 계약은 그대로 두고, 그 결정이 전제한 Claude Code의 `AGENTS.md` 로드 규칙만 고친다. 종료 코드 4의 뜻은 [ADR 0016](0016-command-contract.md)이 예약한 대로 둔다.

## 배경 (Context)

- [ADR 0019](0019-explain-verify-and-agent-skills.md)는 배경에 "Claude Code는 `AGENTS.md`를 직접 읽지 않고 `CLAUDE.md`의 가져오기로만 받는다"고 적었고, `explain`의 판정을 그 전제 위에 세웠다. 그 전제는 이제 사실이 아니다.
- 공식 문서는 Claude Code v2.1.277 이상이 `AGENTS.md`를 프로젝트 지침으로 직접 읽는다고 적는다. 읽는 조건도 문서가 정확히 규정한다. 작업 폴더나 그 위 폴더에 `CLAUDE.md`·`.claude/CLAUDE.md`·`CLAUDE.local.md`가 하나라도 있으면 `AGENTS.md`가 가려지고, 사용자 수준 `~/.claude/CLAUDE.md`와 조직의 관리 `CLAUDE.md`, `.claude/rules/` 파일은 가리는 쪽으로 세지 않는다.
- 설치된 Claude Code 2.1.278로 2026-09-21에 실측해 같은 결과를 얻었다. `AGENTS.md`만 둔 폴더는 확인 토큰을 출력했고, `CLAUDE.md`나 `CLAUDE.local.md`를 함께 둔 폴더는 `NONE`을 출력했다.
- 그래서 `CLAUDE.md`가 없는 저장소에서 `explain`이 `AGENTS.md`에 `missing`을 붙이고 종료 코드 4로 끝나는 것은 거짓 경보다. ADR 0019의 결정 1번에 따라 "에이전트에 닿지 않는 프로젝트 지침 파일"로 판정한 결과인데, 실제로는 Claude Code가 그 파일을 읽는다. 지침이 잘 전달되고 있는 저장소의 CI가 이 코드 때문에 멈춘다.
- 직접 읽기가 모든 세션에서 동작하지는 않는다. v2.1.277 미만, Amazon Bedrock 같은 제삼자 제공자를 쓰거나 telemetry를 꺼서 기능 플래그를 받지 못하는 세션, 설치하거나 올린 직후의 첫 세션에서는 `CLAUDE.md`만 읽는다.

## 검토한 대안 (Options)

| 대안 | 판정 |
| --- | --- |
| 지금 판정을 그대로 둔다 | 채택하지 않는다. 실제로 읽히는 파일을 읽지 않는다고 알리는 거짓 경보이고, 그 때문에 CI가 4로 멈춘다 |
| Claude Code는 `AGENTS.md`를 언제나 읽는다고 본다 | 채택하지 않는다. `CLAUDE.md`가 가리는 경우를 놓쳐서, 반대 방향의 거짓 안심을 준다 |
| **공식 문서의 판정 규칙을 그대로 옮긴다** | **채택.** 가리는 파일과 세지 않는 파일이 문서에 명시돼 있어 저장소의 파일 배치만으로 판정할 수 있다 |
| 기본값만 전제하고 사용자 설정은 보지 않는다 | 채택하지 않는다. 설정을 바꾼 사람에게 새로운 거짓 판정을 남기는데, 이번 변경의 목적이 거짓 판정을 없애는 것이다 |
| **사용자 수준 설정의 `instructionFiles` 값까지 읽어 판정한다** | **채택.** `explain`은 이미 `~/.claude/CLAUDE.md`와 `~/.claude/rules/`를 읽어 판정에 넣으므로 사용자 환경을 보는 것이 이 명령의 기존 범위다. 값은 사용자 수준 설정에만 있으므로 읽을 자리도 하나다 |
| `profile apply`·`profile sync`가 `CLAUDE.md`를 만들지 않게 바꾼다 | 채택하지 않는다. 아래 결정 3번에 이유를 적는다 |

## 결정 (Decision)

1. **`explain`은 공식 문서의 판정 규칙대로 Claude Code의 `AGENTS.md` 로드를 판정한다.**
   - 작업 폴더와 그 위 폴더에 `CLAUDE.md`·`.claude/CLAUDE.md`·`CLAUDE.local.md`가 하나도 없으면, 작업 폴더와 그 위 폴더의 `AGENTS.md`와 `.claude/AGENTS.md`를 세션 시작에 읽는 파일로 판정한다.
   - 이 세 가지 파일이 하나라도 있으면 그 `AGENTS.md`는 가려진 것으로 판정한다. 사용자 수준 `~/.claude/CLAUDE.md`, 조직의 관리 `CLAUDE.md`, `.claude/rules/` 파일은 가리는 쪽으로 세지 않으며 `AGENTS.md`와 함께 로드되는 것으로 본다.
   - 하위 폴더의 `AGENTS.md`는 그 폴더에 세 가지 `CLAUDE.md` 파일이 하나도 없을 때, Claude가 Read 도구로 그 폴더의 파일을 열면 들어간다. 작업 중에만 들어가므로 세션 시작에 읽는 파일과 구분해 판정한다.
   - `AGENTS.local.md`, `AGENTS.override.md`, `.agents/` 아래의 파일은 Claude Code가 읽지 않는 것으로 판정한다.
   - 가려진 `AGENTS.md`는 `not-read`가 아니라 `shadowed`로 판정한다. Codex의 `AGENTS.override.md`와 같은 뜻, 곧 다른 파일을 대신 읽어서 이 파일이 빠진다는 뜻이기 때문이다.
   - 사용자 수준 설정 `~/.claude/settings.json`의 `pluginConfigs["agents-md@builtin"].options.instructionFiles` 값을 읽어 네 값을 모두 따른다. 프로젝트와 로컬 설정 파일의 값은 Claude Code가 무시하므로 읽지 않는다.
2. **`CLAUDE.md`가 없는 저장소의 `AGENTS.md`에 붙던 `missing`이 사라지므로, 그 경우의 종료 코드가 4에서 0으로 바뀐다.** 종료 코드 4의 뜻 자체는 ADR 0016이 예약한 "전달 누락"으로 그대로 둔다. 실제로 닿지 않는 파일이 있으면 여전히 4로 끝난다.
3. **`profile apply`와 `profile sync`가 만드는 `CLAUDE.md`는 그대로 둔다.** `@AGENTS.md` 가져오기를 남겨 두어도 Claude Code가 같은 내용을 두 번 읽지 않는다고 공식 문서가 적고, 직접 읽기가 동작하지 않는 세션까지 이 파일이 덮기 때문이다. 이미 적용한 저장소에서 파일을 지우는 변경을 만들지 않는 것도 이유다.

## 결과 및 영향 (Consequences)

- `CLAUDE.md` 없이 `AGENTS.md`만 둔 저장소에서 `explain`이 거짓 경보를 내지 않는다. 다른 코딩 에이전트용으로 이미 설정된 저장소를 그대로 쓰는 경우가 여기에 해당한다.
- **호환성:** 그 저장소에서 종료 코드가 4에서 0으로 바뀐다. `explain`의 4를 기대하고 실패를 잡던 CI 설정이 있으면 더 이상 걸리지 않는다. 반대로 4가 나던 것 때문에 `explain`을 CI에서 빼 두었다면 다시 넣을 수 있다.
- `profile apply`·`profile sync`의 출력과 이미 적용된 저장소의 파일은 바뀌지 않는다. 사용자가 할 일이 없다.
- 한계:
  - 판정은 `explain`을 돌리는 사람의 `~/.claude/settings.json`을 본다. 같은 저장소라도 설정이 다른 사람에게는 다른 판정이 나오고, 관리 설정이나 `--settings` 파일로 값을 준 환경은 보지 않는다.
  - 직접 읽기가 동작하지 않는 세션에서는 판정과 실제가 어긋난다. v2.1.277 미만, 제삼자 제공자나 telemetry를 끈 세션, 설치·업그레이드 직후의 첫 세션이 해당한다. 이 경우에도 agctx가 만드는 `CLAUDE.md`가 `@AGENTS.md`로 같은 내용을 넣으므로, 프로필을 적용한 저장소에서는 전달이 끊기지 않는다.
  - 실행 중인 Claude Code의 버전을 `explain`이 확인하지는 않는다. 저장소의 파일 배치와 사용자 설정만으로 판정한다.
- 이 결정을 구현하는 코드 변경과 사용자 문서 갱신은 같은 PR에서 함께 한다.
