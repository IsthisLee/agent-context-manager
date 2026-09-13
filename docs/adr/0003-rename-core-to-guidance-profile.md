# 0003. Core를 Guidance Profile(프로필)로 개명하고 apply/sync 의미를 분리한다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-13
* **결정자:** 제품 소유자·개발자
* **관련:** [0001 제품 범위](0001-product-scope.md)의 "Core" 용어를 대체한다.

## 배경 (Context)

이 패키지의 핵심 개념은 "사용자·조직이 소유하는, 여러 개를 만들어 프로젝트마다 골라 적용하는 공통 지침 저장소"였고, 이름을 `Core`로 썼다.

`Core`는 일상·업계에서 "시스템의 중심·본질적인 단 하나"를 뜻한다(.NET Core, core module, core team). 그런데 이 개념은 정반대로 **여러 개를 만들어 바꿔 끼우는** 성격이다. 그래서 문서 거의 모든 첫 등장에서 `Core(공통 지침 저장소)`처럼 괄호 설명을 붙여야 뜻이 섰고, CPU 코어·core dump·core library 등 과포화된 기술 용어와도 충돌했다.

적용 명령도 의미가 겹쳐 있었다. `init`은 최초 적용, `sync`는 재적용이었지만 `sync`는 내부적으로 `init`과 같은 함수를 호출했고, 둘의 유일한 차이는 "프로필 이름을 어떻게 찾느냐"뿐이었다. 적용 계열 명령(`setup`, `init`, `sync`)은 `--core` 플래그로 프로필을 받고, 관리 명령(`core create` 등)은 명사를 앞세우는 두 가지 문법이 섞여 있었다.

## 검토한 대안 (Options)

1. **Core 유지 + 첫 실행·`--help`에 정의 앵커링.** 리네임 비용이 0이지만 약한 의미성은 그대로다.
2. **Profile로 개명 + `apply` 단일 멱등 명령으로 통일(`sync` 제거).** 가장 단순하지만, "이미 묶인 프로필만 새로고침"이라는 안전 경계가 사라진다.
3. **Profile로 개명 + apply/sync 의미 분리(채택).** `apply`는 항상 이름을 받아 프로필을 지정·전환하고, `sync`는 이름을 받지 않고 프로젝트에 기록된 프로필만 새로고침한다.

## 결정 (Decision)

- 개념 이름을 `Core` → **Guidance Profile**(한국어 **개발 지침 프로필**, 짧게 **프로필** / `profile`)로 바꾼다.
- 모든 프로필 관리·적용 명령을 `profile` 하위 명령으로 통일한다: `profile create/list/view/remove/setup/apply/sync`. 프로필 이름은 위치 인자로 받고 `--core` 플래그는 없앤다.
- `init` → `profile apply <name> <project>`. 이름을 **반드시** 받는다(지정·전환). 멱등하며, 이미 적용된 프로젝트에 다시 실행하면 관리 영역만 갱신한다.
- `sync` → `profile sync <project>`. 이름을 **받지 않고** 프로젝트 `agentic.project.json`에 기록된 프로필만 새로고침한다. 프로필 이름(둘째 위치 인자)이나 `--profile`/`--core`를 주면 거부한다 — 일괄 동기화에서 실수로 바인딩이 바뀌는 것을 막는다. 아직 적용되지 않은 프로젝트에서는 `profile apply`로 먼저 적용하라는 오류로 끝난다.
- 저장 위치를 `~/.agentic-cores/<name>` → `~/.agentic-profiles/<name>`, 메타데이터 파일을 `agentic-core.json` → `agentic-profile.json`으로 바꾼다. 최초 접근 때 이전 `~/.agentic-cores`가 있으면 한 번 자동 이관한다.
- 프로젝트 `agentic.project.json`의 프로필 식별 키를 `core` → `profile`로 바꾼다. 이전 `core` 키도 읽어 호환한다.

## 결과 및 영향 (Consequences)

- **호환성 파괴(CLI).** `core`/`init`/`setup --core`/`sync --core` 형태는 더 이상 동작하지 않는다. `0.1.0`이 이미 npm에 게시돼 있으므로 `CHANGELOG.md`의 `Unreleased`에 호환성 파괴로 기록한다. pre-1.0 단계라 구명령 별칭은 두지 않는다.
- **데이터는 보존된다.** 기존 `~/.agentic-cores`와 그 안의 프로필은 최초 실행 때 자동으로 새 경로·파일명으로 이관되고, 이미 적용된 프로젝트의 `core` 키도 계속 읽힌다.
- **의미가 또렷해진다.** "프로필을 지목한다 → `apply`, 있는 것을 새로고침 → `sync`"로 두 명령이 겹치지 않는다.
- **동등 경로 유지.** 각 기능은 CLI·TUI·`profile list` 관리 메뉴에서 모두 실행 가능하며, `bin/contracts.mjs`의 `PROFILE_OPERATION_CONTRACT`와 `evals/interface-parity.test.mjs`가 이를 고정한다.
- **후속.** `docs/assets/`의 흐름 다이어그램(svg·html·png)은 생성 산출물이라 이 변경에서 갱신하지 않았고, 별도 재생성이 필요하다. `docs/implementation-principles.md`의 `파일:줄` 인용은 기준 커밋 기준이므로 코드 반영 후 줄 번호를 다시 맞춰야 한다.
