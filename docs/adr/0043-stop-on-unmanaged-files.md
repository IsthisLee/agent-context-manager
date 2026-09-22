# 0043. agctx 표지가 없는 기존 파일은 `--adopt` 없이 쓰지 않는다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-22
* **결정자:** 제품 소유자
* **근거:** 외부 근거 없음: agctx가 사용자 파일을 다루는 안전 계약을 정하는 결정이다.
* **관련:** [ADR 0008](0008-managed-conflict-recovery.md)(관리 영역 충돌 복구), [ADR 0020](0020-apm-coexistence-and-monorepo-links.md)(APM이 만든 파일에서 멈춤), [ADR 0034](0034-managed-end-marker-in-agents-md.md)(`AGENTS.md`의 경계 마커), [ADR 0042](0042-choose-agents-per-repository.md)(에이전트 고르기). 논의는 [agctx 관리 산출물의 안전한 동기화](../discussion/architecture/topics/managed-artifact-safety.md#마커-없는-파일은-자동-덮어쓰지-않음)에 있다.

## 배경 (Context)

- 지금까지 `profile apply`는 사람이 쓴 루트 `CLAUDE.md`나 `AGENTS.md`에 확인 없이 agctx 관리 영역을 더했다. `CLAUDE.md`는 기존 내용 뒤에 관리 블록이 붙고, `AGENTS.md`는 기존 내용이 프로필 지침 아래로 옮겨졌다. 사람이 쓴 내용은 남았지만 파일의 모양은 동의 없이 바뀌었다.
- 에이전트나 CI가 비대화형으로 `apply`를 실행하면 이 변경을 사람이 미리 볼 기회도 없었다.
- 논의 문서는 세 가지 처리를 제안했다. 1) 바꾸지 않고 멈춘다, 2) 확인을 받은 뒤 기존 내용을 사용자 영역으로 두고 관리 영역을 더한다, 3) 별도 파일을 만든다.

## 검토한 대안 (Options)

| 대안 | 판단 |
| --- | --- |
| 기본은 멈추고, `--adopt`나 TUI 확인으로 편입한다(1 + 2) | **채택.** 사람이 쓴 파일이 동의 없이 바뀌지 않는다. 편입 결과는 지금까지의 동작과 같아서 새 파일 형식이 필요 없다 |
| 기본으로 편입하고 TUI에서만 묻는다(2) | 에이전트·CI가 CLI로 실행하면 여전히 동의 없이 바뀐다 |
| 별도 파일을 만든다(3) | Claude Code가 두 파일을 모두 읽는지 에이전트마다 확인해야 하고, Antigravity 규칙 파일처럼 대체 위치가 없는 경우의 동작을 새로 정해야 한다 |
| 관리 파일 목록(manifest)을 새 필드로 기록한다 | `managedHashes`의 키가 이미 agctx가 관리하는 파일 목록이다. agctx 버전 같은 필드를 더하면 agctx를 올릴 때마다 모든 저장소의 `agctx.project.json`이 바뀌어 PR이 생긴다 |

## 결정 (Decision)

1. 적용할 파일이 이미 있고, 비어 있지 않고, agctx가 관리한 기록(`managedHashes`)이 없고, agctx 표지도 없으면 "관리하지 않는 파일"이다. `AGENTS.md`의 표지는 `<!-- agctx:managed:end -->`, 마커 이전 버전이 쓴 확장 섹션 제목, `> Applied from agctx profile:` 줄이고, 연결 파일의 표지는 `<!-- agctx:managed:start -->` 블록이다.
2. `profile apply`·`profile sync`는 관리하지 않는 파일이 하나라도 있으면 아무것도 쓰지 않고 `project.unmanaged` 오류와 종료 코드 2로 멈춘다. 계획에는 그 파일이 `unmanaged`로 나오고, 오류 안내는 같은 명령에 `--adopt`를 붙인 명령을 보여 준다. `repos sync`·`repos pr`은 그 저장소를 `conflict`로 보고하고 넘어간다.
3. `--adopt`를 주면 지금까지처럼 기존 내용을 사용자 영역으로 두고 관리 영역을 더한다. 한 번 편입한 파일은 `managedHashes`에 기록되므로 다음부터는 묻지 않는다.
4. TUI는 이 오류에서 멈추면 편입할지 묻고(기본 No), Yes면 같은 명령을 `--adopt`로 다시 실행한다.
5. 계획한 파일을 모두 쓰는 `profile resolve`도 같은 판정을 따르며 `--adopt`를 받는다. `check`는 표지 없는 파일을 `sync`와 같이 충돌(2)로 보고한다.
6. 안내는 멈춘 파일에 맞춘다. `CLAUDE.md`·규칙 파일은 그 에이전트를 뺀 `--agent` 명령도 함께 보여 주고, 심볼릭 링크는 쓸 수 없으므로 편입을 권하지 않는다. `AGENTS.md`는 모든 에이전트가 읽어 뺄 수 없다.
7. 관리 파일 목록은 `managedHashes`의 키로 둔다. 이 목록에 없는 파일은 agctx의 것이 아니다. 새 필드는 더하지 않는다.
8. 하위 폴더에 사람이 둔 `CLAUDE.md`는 지금처럼 편입하지 않고 건드리지 않는다([ADR 0020](0020-apm-coexistence-and-monorepo-links.md)).

## 결과 및 영향 (Consequences)

- 이미 `AGENTS.md`나 `CLAUDE.md`가 있는 저장소에 처음 적용하면 한 번 멈추고, `--adopt`를 붙여 다시 실행해야 한다. 이미 agctx로 적용한 저장소는 파일이 기록돼 있어 달라지지 않는다.
- 에이전트나 CI가 처음 적용할 때 사람이 쓴 파일을 바꾸려면 `--adopt`를 명시해야 하므로, 그 결정이 명령에 드러난다.
- 편입한 뒤의 파일 모양은 지금까지와 같다.
- `AGENTS.md`의 표지 판정은 옛 파일과의 호환 때문에 느슨하다. 확장 섹션 제목과 같은 낱말의 제목(번호·제목 단계·뒤에 붙은 글은 달라도 된다)만 있어도 agctx 파일로 보므로, 사람이 그런 제목을 쓴 파일은 멈추지 않고 제목 위의 내용이 관리 영역이 된다.
