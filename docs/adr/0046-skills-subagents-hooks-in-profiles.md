# 0046. 프로필의 skills·subagents·hooks를 에이전트마다 저장소에 쓰고, hooks는 저장소가 고를 때만 쓴다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-23
* **결정자:** 제품 소유자
* **근거:** [skills·subagents·hooks 위치와 형식 근거](../references.md#skillssubagentshooks-위치와-형식-근거)
* **관련:** [ADR 0021](0021-profile-scope-skills-mcp-subagents.md)이 skills·subagents를, [ADR 0022](0022-profile-scope-hooks.md)가 hooks를 프로필 대상으로 정했다. 이 ADR은 그 구현이다. [ADR 0044](0044-mcp-servers-in-profiles.md)의 소유 영역 계약과 `include`를 넓히고, [ADR 0043](0043-stop-on-unmanaged-files.md)의 표지 없는 파일 규칙을 hooks 설정 파일에도 적용한다. 논의는 [프로필 설정 표면 확장](../discussion/architecture/topics/profile-config-surface.md)에 있다.

## 배경 (Context)

- 팀은 규칙과 MCP 서버뿐 아니라 공유 skill, 역할을 나눈 subagent, 규칙을 강제하는 hook까지 같은 것을 쓰고 싶어 한다. 지금은 이것들을 사람이 저장소마다 손으로 복사한다.
- 에이전트마다 위치와 형식이 다르다.
  - skill은 세 에이전트가 모두 `SKILL.md`가 든 폴더를 읽는다. Claude Code는 `.claude/skills/`, Codex와 Antigravity는 `.agents/skills/`를 읽는다.
  - subagent는 Claude Code가 Markdown(`.claude/agents/<이름>.md`), Codex가 TOML(`.codex/agents/<이름>.toml`, `developer_instructions` 필수)을 읽는다. 도구 이름 체계도 다르다.
  - hooks는 Claude Code(`.claude/settings.json`의 `hooks`)와 Codex(`.codex/hooks.json`)가 같은 `hooks.<이벤트>` 배열 형식을 쓰지만, 이벤트 목록과 matcher가 가리키는 도구 이름이 다르다.
- `.claude/settings.json`에는 사람이 둔 권한 설정과 hooks가 함께 있다. hooks의 matcher 묶음에는 이름이 없다.
- hooks는 다른 사람의 컴퓨터에서 실행될 명령이다. ADR 0022는 적용 전에 명령을 보여 주고 확인받으라고 정했다.
- Antigravity는 문서가 적은 워크스페이스 위치에 skill·subagent·hooks를 두어도 agy 1.2.5 실행에서 읽지 않았다. 원인은 확인하지 못했다.

## 검토한 대안 (Options)

| 항목 | 대안 | 판단 |
| --- | --- | --- |
| 프로필 형식 | `skills/<이름>/`, `subagents/<이름>.md`(Claude Code 형식), `hooks.json`(hook 이름마다 에이전트별 이벤트) | **채택.** skill은 세 에이전트가 같은 형식이라 그대로 복사한다. subagent는 가장 풍부한 Claude Code 형식을 정본으로 두고 다른 형식으로 옮긴다 |
| | hooks를 도구 중립 형식 하나로 적는다 | matcher가 가리키는 도구 이름(`Edit`와 `apply_patch`)과 이벤트가 달라 옮길 수 없다. 조용히 틀린 hook이 된다 |
| skills·subagents 소유 | 쓴 파일마다 해시를 `managedHashes`에 기록하고 파일째 소유 | **채택.** 지침 파일의 충돌·되돌리기 계약을 그대로 쓴다 |
| | 폴더째 덮어쓰기 | 사람이 둔 skill을 지운다 |
| 같은 자리에 사람의 파일 | 멈춘다(`--adopt`로도 덮어쓰지 않음). 내용이 프로필과 같으면 맡는다 | **채택.** 편입은 사람의 내용을 보존하는 것인데, 파일째 소유는 내용을 바꾸기 때문이다 |
| hooks 소유 | `managedKeys`에 `<이벤트>:<묶음 해시>`를 적고 같은 해시의 묶음을 agctx 것으로 읽는다 | **채택.** 파일에 표지를 넣지 않고도 사람이 둔 hooks와 가른다. 사람이 고친 묶음은 해시가 달라져 충돌로 보인다 |
| | 위치(배열 끝의 몇 개)로 소유 | 사람이 뒤에 묶음을 더하면 엉뚱한 묶음을 지운다 |
| hooks를 받는 조건 | `include`에 `hooks`를 적은 저장소만 | **채택.** 기록이 없거나 `--include all`이면 받지 않는다. 실행될 명령을 받는 일은 저장소가 이름으로 골라야 한다 |
| | `--include all`에 hooks를 넣는다 | `all`을 "기록을 지운다"로 쓰는 기존 계약(ADR 0044)과 평가가 있다. hooks를 모르는 사이에 받게 된다 |
| 여러 저장소 동기화 | `repos sync`는 hooks가 바뀌는 저장소를 쓰지 않고 `profile sync`로 넘긴다 | **채택.** 여러 저장소를 한 번에 확인하면 저장소마다 실행될 명령을 보여 줄 수 없다 |
| Antigravity | skills는 `.agents/skills`에 쓰고, subagents와 hooks는 쓰지 않고 알린다 | **채택.** `.agents/skills`는 Codex가 읽는 것을 확인했다. 확인하지 못한 hook은 실행될 명령이라 쓰지 않는다 |
| 모르는 hook 이벤트 | 문서의 이벤트 목록 밖이면 멈춘다 | **채택.** 에이전트가 설정 파일을 거부하면 사람이 둔 설정까지 쓰지 못하게 된다 |

## 결정 (Decision)

1. 프로필 폴더에 다음을 둘 수 있다. 숨은 문자 검사는 규칙 파일과 같고, 심볼릭 링크와 텍스트가 아닌 파일은 사용법 오류(64)로 멈춘다.
   - `skills/<이름>/SKILL.md`와 같은 폴더의 다른 파일. 머리말의 `name`이 폴더 이름과 같고 `description`이 있어야 한다.
   - `subagents/<이름>.md`. 머리말의 `name`이 파일 이름과 같고 `description`이 있어야 한다. 본문이 지시다.
   - `hooks.json`: `{ "hooks": { "<이름>": { "claude": { "<이벤트>": [ … ] }, "codex": { … } } } }`. 처리기는 `command`가 있는 `type: "command"`만 받는다.
2. 저장소에 쓰는 곳은 다음과 같다.
   - skills는 Claude Code를 고르면 `.claude/skills/<이름>/`, Codex나 Antigravity를 고르면 `.agents/skills/<이름>/`에 그대로 복사한다. 실행 권한을 지킨다.
   - subagents는 Claude Code에 `.claude/agents/<이름>.md`(그대로), Codex에 `.codex/agents/<이름>.toml`(`name`·`description`·`developer_instructions`)로 쓴다. 옮기지 못한 머리말 키는 경고한다.
   - hooks는 Claude Code에 `.claude/settings.json`의 `hooks`, Codex에 `.codex/hooks.json`으로 쓴다. 이벤트마다 배열 끝에 넣고 사람이 둔 묶음과 다른 키는 그대로 둔다.
3. skills·subagents 파일은 파일째 agctx가 소유한다. 해시와 원문을 지침 파일처럼 기록하고, 사람이 고치면 충돌(2)로 멈추며 `resolve --discard`가 백업한 뒤 다시 만든다. 같은 skill 폴더나 subagent 파일에 agctx가 쓰지 않은 다른 내용의 파일이 있으면 `project.artifact-taken`(2)으로 멈춘다.
4. hooks는 `managedKeys`의 `<이벤트>:<묶음 해시>`로 agctx의 묶음을 가른다. 사람이 만든 설정 파일에 처음 쓰는 것은 `--adopt`로만 한다.
5. `--include`는 `rules`·`mcp`·`skills`·`subagents`·`hooks`를 받는다. 기록이 없거나 `all`이면 hooks를 뺀 전부다.
6. 적용 계획은 쓸 skills·subagents 이름과, hook마다 에이전트·이벤트·matcher·명령을 보여 준다. Codex hooks가 있으면 사람마다 `/hooks`에서 승인해야 실행된다고 알린다. 터미널이 아니면 `--yes` 없이 쓰지 않는다.
7. `repos sync`는 hooks가 바뀌는 저장소를 `review` 상태(종료 코드 1)로 두고 쓰지 않는다.
8. Antigravity에는 subagents와 hooks를 쓰지 않고, 고른 에이전트에 Antigravity가 있으면 그 사실을 알린다. 프로필 `hooks.json`의 `antigravity` 항목은 검사만 한다.

## 결과 및 영향 (Consequences)

- 프로필에 `skills/`나 `subagents/`를 더하면 다음 `sync`부터 저장소마다 파일이 생긴다. 받기 싫은 저장소는 `--include`에서 뺀다.
- hooks를 받으려면 저장소마다 `--include`에 `hooks`를 적어야 한다. 받은 hooks는 Claude Code 대화형 세션에서는 폴더를 신뢰한 뒤에, Codex에서는 프로젝트를 신뢰하고 `/hooks`에서 승인한 뒤에 실행된다. agctx는 hooks를 실행하지 않는다.
- Claude Code에서 같은 이름의 개인 skill이 있으면 저장소 skill보다 개인 것이 쓰인다. agctx는 개인 설정을 보지 않는다.
- hook 묶음을 사람이 고치면 해시가 달라져 agctx가 그 묶음을 사람의 것으로 본다. `resolve --discard` 뒤에도 고친 묶음은 남으므로, 필요 없으면 사람이 지운다.
- 알려진 이벤트 목록은 에이전트가 이벤트를 늘리면 갱신해야 한다. 그 전까지 새 이벤트는 사용법 오류로 멈춘다.
- Antigravity에 subagents와 hooks를 쓰는 일, 바이너리 파일이 든 skill은 후속 작업이다.
