# 0029. 에이전트를 CLI·TUI와 같은 계약 아래 두는 세 번째 표면으로 둔다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-18
* **결정자:** 제품 소유자
* **근거:** [에이전트 지침 로드와 전달 확인 근거](../references.md#에이전트-지침-로드와-전달-확인-근거)의 skills CLI 실측과 [지침 파일 지침의 근거](../references.md#지침-파일-지침의-근거)에 인용된 Claude Code best practices "Claude loads them on demand without bloating every conversation".
* **관련:** [ADR 0025](0025-every-command-in-cli-and-tui.md)의 동등성 계약에 에이전트 표면을 더한다. 등록부 계약은 [ADR 0016](0016-command-contract.md), 스킬 배포는 [ADR 0019](0019-explain-verify-and-agent-skills.md)다. 계약과 남은 작업은 [자연어 요청을 통한 agctx 사용](../discussion/architecture/topics/agent-mediated-usage.md) 논의가 맡는다.

## 배경 (Context)

- ADR 0025는 "모든 명령은 CLI와 TUI에서 실행할 수 있어야 한다"를 계약으로 두고 평가가 강제한다. 에이전트 경로는 계약 밖이었다.
- 에이전트 경로의 재료는 이미 있다. 모든 명령에 `--json`, 종료 코드 0·1·2·3·4·64·69·70, 스킬 두 개(`agctx`·`agctx-author`), 등록부에서 생성하는 스킬 명령 목록이다.
- 그런데 **어느 명령이 어느 스킬에 들어가는지가 `tools/generate-skills.ts`에 손으로 박힌 id 아홉 개였다.** 새 명령을 더해도 그 목록에 넣지 않으면 에이전트는 그 명령의 존재를 모른다. CLI·TUI는 평가가 강제하는데 에이전트만 사람이 기억해야 했다.
- **노출만으로는 부족하다.** 에이전트가 스킬을 부를지 판단하는 재료는 frontmatter의 `name`과 `description`뿐이고 본문은 부른 뒤에 로드된다. `profile create`는 명령 목록에 **있었는데도** description과 「Pick the command」 어디에도 생성 시나리오가 없어서, "컨텍스트 프로필 만들어줘"가 스킬에 닿지 않았다.
- 그리고 `agctx` 스킬은 모델이 스스로 부를 수 있는데 **모든 명령을 싣고 있었다.** `profile push`·`repos pr`처럼 원격을 바꾸는 명령까지 포함이다. 본문의 승인 규칙에만 의존했고, 그 규칙은 지침이라 지켜진다는 보장이 없다.

## 검토한 대안 (Options)

| 대안 | 판단 |
| --- | --- |
| CLI·TUI와 똑같이 모든 명령을 에이전트에 노출한다 | 모델이 `push`·`repos pr`·`remove`를 스스로 부를 수 있게 된다. 우리가 배포하는 "커밋·push·배포는 실행 전에 승인받는다"를 우리 도구가 어긴다 |
| 지금처럼 스킬 소속을 손으로 관리한다 | 새 명령이 조용히 빠진다. 지금 `profile create`가 그 상태였다 |
| 명령마다 에이전트 정책을 선언하고 평가가 강제한다 | **채택.** 노출과 트리거를 모두 검사한다 |
| 스킬을 하나로 합치고 본문 규칙으로만 막는다 | 모델 호출 차단(`disable-model-invocation`)이 스킬 단위이므로 하나로 합치면 그 장치를 쓸 수 없다 |

## 결정 (Decision)

### 정책 세 가지

명령 등록부에 `AgentPolicy`를 둔다. 값은 `changes`에서 유도하고 예외만 `agent` 필드로 적는다.

| 정책 | 뜻 | 유도 규칙 |
| --- | --- | --- |
| `auto` | 모델이 스스로 부를 수 있다 | `changes: 'none'` |
| `ask` | 사용자가 이름으로 부를 때만. `agctx-author` 스킬로 간다 | `changes`가 `profile-store`·`repository`·`remote` |
| `never` | 어느 스킬도 담지 않는다 | `agent: 'never'`로만 |

`never`는 셋이다. `profile remove`(되돌릴 수 없는 삭제), `config lang`(사용자 개인 설정), `help`(스킬이 명령 목록을 이미 가짐).

유도 규칙을 두는 이유는 **새 명령이 정책 없이 존재할 수 없게** 하는 것이다. 필드를 적지 않아도 정책이 생기고, 그 정책이 스킬 소속을 정한다.

### 스킬 두 개의 소속

- `skills/agctx/SKILL.md`는 `auto`만 싣는다. 모델이 스스로 부를 수 있는 스킬이므로 **읽기만 하는 명령만** 들어간다.
- `skills/agctx-author/SKILL.md`는 `auto`와 `ask`를 싣는다. 이름으로 부를 때만 동작하고(`disable-model-invocation: true`, `allow_implicit_invocation: false`), 게시 전에 상태를 확인해야 하므로 읽기 명령도 필요하다.

`tools/generate-skills.ts`의 손으로 박은 id 목록을 지우고 정책으로 고른다.

### 트리거 덮음

노출과 별개로, **에이전트가 부를 이유가 있어야** 한다.

- `auto`인 모든 명령은 `agctx` 스킬의 「Pick the command」 절에 그 명령을 실행하는 시나리오가 있어야 한다.
- `ask`인 모든 명령은 `agctx-author` 스킬의 같은 절에 있어야 한다.
- 두 스킬의 `description`은 그 시나리오가 다루는 범위를 말해야 한다. 에이전트는 description만 보고 스킬을 부를지 정한다.

`evals/agent-surface.test.ts`가 이 셋을 검사한다.

## 결과 및 영향 (Consequences)

- **`agctx` 스킬이 명령 스물둘에서 일곱으로 줄어든다.** `profile list`·`view`·`status`, `check`, `explain`, `verify`, `repos status`다. 모델이 스스로 파일을 쓰거나 원격에 보내는 명령을 부를 길이 사라진다.
- **`agctx-author` 스킬이 명령 열아홉을 담고 시나리오 일곱을 얻는다.** 프로필 생성·적용·충돌 해소·Git 연결이 이제 시나리오로 들어와, "프로필 만들어줘"가 스킬에 닿는다.
- 새 명령을 더하면 정책이 유도되고 스킬 목록에 자동으로 들어가지만, **시나리오는 사람이 써야 한다.** 쓰지 않으면 평가가 실패해 그 명령이 에이전트에 닿지 않는다는 사실이 드러난다.
- 요구가 바뀌어 고친 평가가 둘이다. `evals/skills.test.ts`가 `agctx` 스킬에 모든 명령이 있는지 검사하던 것은 이 결정으로 틀렸으므로 지웠고, 두 스킬 모두 `--dry-run`과 승인 규칙을 담는지 검사하던 것은 `agctx-author`만 검사하도록 좁혔다. 대신 `agctx` 스킬에 바꾸는 명령이 없는지 검사하는 평가를 더했다.
- `--json`의 명령별 `data` 스키마 문서화는 이 결정에 들어가지 않는다. 에이전트가 출력을 추측해 읽지 않게 하려면 필요하고, [자연어 요청을 통한 agctx 사용](../discussion/architecture/topics/agent-mediated-usage.md)의 남은 작업이다.
- 사용자 문서는 [에이전트에게 agctx를 맡기기](../guides/agent-skills.md)의 스킬 표에 정책을 반영한다.
