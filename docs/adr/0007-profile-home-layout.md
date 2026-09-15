# 0007. 프로필 저장소를 `~/.agentic/` 아래로 모은다

* **상태:** 채택됨 (Accepted), 일부 대체됨: 홈 위치 `~/.agentic/`와 자동 이관은 [ADR 0013](0013-rename-agent-context-manager.md)이 `~/.agctx/`와 이관 없음으로 바꾼다
* **일자:** 2026-09-14
* **결정자:** 제품 소유자·개발자
* **관련:** [0003](0003-rename-core-to-guidance-profile.md)의 `~/.agentic-profiles` 배치를 대체한다. 현재 구조는 [현재 아키텍처](../contributing/architecture.md)와 [기능 구현 메커니즘](../contributing/implementation-mechanics.md)에 반영한다.

## 배경 (Context)

프로필은 `~/.agentic-profiles/<name>`에, 언어 설정은 `~/.agentic-profiles/config.json`에 저장돼 왔다. config.json은 프로필이 아닌데 프로필 폴더 안에 섞여 있었다. 홈 디렉터리에 도구 전용 최상위 dot 폴더도 하나 더 늘었다. 아직 npm에 배포된 판은 개명 이전(`~/.agentic-cores`)이라 `~/.agentic-profiles`라는 이름은 사용자에게 도달하기 전이다.

## 검토한 대안 (Options)

1. **현행 유지(`~/.agentic-profiles`).** 변경 비용은 없지만 config가 프로필 폴더에 섞이는 문제가 남는다.
2. **XDG Base Directory.** 데이터는 `~/.local/share/agentic`, 설정은 `~/.config/agentic`에 둔다. 가장 표준이고 Ruler도 `~/.config/ruler`를 쓴다. 그런데 base 디렉터리가 둘로 갈리고 `$XDG_*` 처리가 붙어 복잡하다.
3. **`~/.agentic/`로 묶기(채택).** 프로필은 `~/.agentic/profiles/<name>`, 설정은 `~/.agentic/config.json`에 둔다. 도구 전용 폴더 하나에 config와 데이터가 깔끔히 갈리고 `~/.claude`·`~/.cursor` 같은 흔한 관례와 같은 결이다.

## 결정 (Decision)

프로필 홈을 `~/.agentic/profiles`로, 언어 설정을 `~/.agentic/config.json`으로 옮긴다. `AGENTIC_HOME`은 그대로 base 디렉터리를 가리키며 그 아래에 `.agentic/`를 만든다. 미출시 상태인 Core→Profile 개명과 같은 변경으로 넣어 사용자는 한 번만 이관한다.

## 결과 및 영향 (Consequences)

- 최초 실행 때 이전 `~/.agentic-cores`나 `~/.agentic-profiles`가 있으면 폴더를 `~/.agentic/profiles`로 옮기고 `config.json`을 `~/.agentic/`로 올린다. Core 시절 홈은 메타데이터도 `agentic-profile.json`으로 바꾼다. best-effort이며 실패해도 크래시하지 않는다.
- npm 배포본이 아직 개명 이전이라 대부분의 사용자는 `~/.agentic-cores`에서 한 번에 새 위치로 온다. 두 번 이관하지 않는다.
- 평가 `evals/profile.test.mjs`가 두 레거시 홈의 이관과 config 승격을 확인한다.
- XDG는 채택하지 않았다. 필요하면 후속 ADR로 다시 연다.
