# 0013. 이름을 Agent Context Manager(agctx)로 바꾸고 이전 이름의 호환 계층을 두지 않는다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-15
* **결정자:** 제품 소유자
* **근거:** 외부 근거 없음: 이름·명령·경로와 호환 계층을 두지 않는 범위는 제품 소유자의 결정이며 외부 사실에 기대지 않는다.
* **관련:** [ADR 0003](0003-rename-core-to-guidance-profile.md)의 명령 이름(`agentic`·`agt`), [ADR 0004](0004-antigravity-rules-path.md)의 규칙 파일 이름(`.agents/rules/agentic.md`), [ADR 0007](0007-profile-home-layout.md)의 프로필 홈 위치와 자동 이관을 대체한다. 프로필 모델, `.agents/rules/` 경로, 홈 아래에 프로필과 설정을 모으는 배치는 그대로 둔다.

## 배경 (Context)

패키지 이름은 `@isthis/agentic`, 명령은 `agentic`과 별칭 `agt`였다. 제품 방향이 프로필 규칙 파일을 만드는 데서 저장소마다 에이전트 컨텍스트를 적용·동기화하고 전달을 확인하는 쪽으로 넓어지면서, 이 이름으로는 하는 일이 드러나지 않았다. 제품 소유자는 2026-09-15에 제품 이름을 Agent Context Manager, npm 패키지를 `agent-context-manager`, 명령을 `agctx`로 정했다.

이름을 바꾸면 이전 이름으로 만든 홈과 프로젝트 파일을 어떻게 다룰지도 정해야 한다. 지금 코드에는 이전 홈(`~/.agentic-cores`, `~/.agentic-profiles`)을 옮기는 코드, 프로젝트 설정의 `core` 키를 읽는 분기, Windows에서 `\`로 기록한 관리 hash 키를 읽는 분기가 있다. 제품 소유자는 이전 이름으로 설치한 사용자를 고려하지 않기로 했다.

## 검토한 대안 (Options)

1. **이름을 그대로 둔다:** 바꿀 것이 없다. 대신 하는 일이 이름에서 드러나지 않는 문제가 남는다.
2. **새 이름으로 바꾸고 이전 명령·경로를 계속 지원한다:** `agt` 별칭과 이전 홈 이관, `core` 키·`\` 키 읽기를 유지한다. 이전 설치본에서 옮겨 오기는 쉽지만 코드와 문서에 두 이름이 계속 남는다.
3. **새 이름으로 바꾸고 호환 계층을 두지 않는다.**

## 결정 (Decision)

3을 택한다.

- 패키지는 `agent-context-manager`, 명령은 `agctx` 하나다. 별칭은 두지 않는다.
- 데이터 폴더는 `~/.agctx`다. 프로필은 `profiles/<name>/`의 `profile.json`과 `AGENTS.md`, 언어 설정은 `config.json`에 둔다. `AGCTX_HOME`은 이 데이터 폴더 자체를 가리킨다. 이전 `AGENTIC_HOME`은 홈 디렉터리를 대신했으므로 뜻이 바뀐다. 언어 환경 변수는 `AGCTX_LANG`이다.
- 프로젝트 파일은 `agctx.project.json`, `.agctx/base/`, `.agctx/backups/`, `.agctx/.gitignore`, `.agents/rules/agctx.md`다. 관리 표지는 `agctx:managed`, 프로필 지침 표지는 `agctx:guidance`다. 프로필 `AGENTS.md`의 제목은 제품 이름 없이 `# Profile: <name>`이고, 프로젝트 `AGENTS.md`에는 `Applied from agctx profile: <name>`을 적는다.
- 이전 이름의 홈(`~/.agentic`, `~/.agentic-profiles`, `~/.agentic-cores`)과 프로젝트 파일은 읽거나 옮기지 않는다. 프로젝트 설정의 `core` 키와 `\`로 기록한 관리 hash 키도 읽지 않는다.
- 문서 소스 해시 표지는 `agctx-doc-sources`로 바꾼다.
- GitHub 저장소 이름은 `IsthisLee/agent-context-manager`로 바꾸고, 새 패키지를 게시한 뒤 `@isthis/agentic`에 새 이름을 안내하는 deprecate 메시지를 단다. 두 작업은 실행 직전에 다시 확인한다.
- 문서의 제품 이름·명령·경로는 새 이름으로 고친다. ADR, 게시된 CHANGELOG 항목, 참고 문헌의 실험 기록, 논의 문서의 옛 코드 인용은 당시 이름을 그대로 둔다.

## 결과 및 영향 (Consequences)

- **호환성 파괴:** 이전 패키지에서 옮겨 오는 사용자는 프로필을 다시 만들고 프로젝트에 다시 적용해야 한다. 이전 이름의 프로젝트 파일(`agentic.project.json`, `.agentic/`, `.agents/rules/agentic.md`)은 지우지 않으므로 필요 없으면 직접 지운다.
- `src/shared/home.ts`에서 이관 코드가 빠지고, `profile sync`는 `--core` 옵션을 따로 검사하지 않는다.
- 평가: 이전 홈 이관 평가 두 개를 새 배치 평가(`AGCTX_HOME` 아래 배치, `AGCTX_HOME`이 없을 때 `~/.agctx`를 쓰고 이전 홈을 건드리지 않음)로, `agt` 별칭 평가를 `agctx` 단일 명령 평가로 바꾼다. 요구가 바뀌어 고친 평가다.
- README 제목과 한 줄 문구는 "Agent Context Manager (agctx)"와 "A profile-based context manager for AI coding agents."로 바꾼다.
