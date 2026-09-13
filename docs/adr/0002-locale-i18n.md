# ADR 0002: CLI·생성 지침의 로케일(ko/en) 국제화

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-13
* **결정자:** 제품 소유자·개발자
* **관련:** [0003](0003-rename-core-to-guidance-profile.md)이 이 ADR의 저장 경로 `~/.agentic-cores`를 `~/.agentic-profiles`로 개명한다.

## 배경

패키지의 비대화형 CLI 골격(help·에러·출력)은 영어이지만, 대화형 TUI 문자열과 `setup`이 Core에 새기는 지침 텍스트, `renderCoreAgents`가 프로젝트 `AGENTS.md`에 찍는 뼈대가 한국어였다. 그 결과 영어권 사용자는 기본 경험과 실제 생성물이 한국어로 나와 패키지를 그대로 쓰기 어려웠다. 로케일 선택은 저장 포맷과 사용자 기본 동작에 영향을 주는 되돌리기 어려운 결정이므로 ADR로 기록한다.

## 검토한 대안

- **장치 언어 자동 감지 기본.** `LANG`/`LC_ALL`로 기본 로케일을 정한다. 편하지만 같은 명령이 기계마다 다른 결과를 내 결정론을 해치고, 기존 한국어 사용자의 CI 생성물을 조용히 영어로 뒤집을 위험이 있어 버렸다.
- **영어 기본으로 전환.** 신규 사용자에게 친절하나 기존 동작을 바꿔 호환성을 깨므로 버렸다.
- **Core에 로케일 고정.** create 시점 언어로만 Core를 저장한다. 구현은 작지만 한 Core를 다른 언어로 적용할 수 없어 목표(영어권 사용자가 문제없이)를 완전히 만족하지 못한다.

## 결정

기본 로케일은 `ko`로 두어 기존 동작을 보존하고, 영어는 opt-in으로 연다. 로케일 결정 순서는 `--lang` 플래그 → `AGENTIC_LANG` 환경변수 → 저장된 사용자 선택(`$AGENTIC_HOME/.agentic-cores/config.json`) → (대화형이면 첫 실행에 한 번 물어 저장, 비대화형이면 `ko`)이다. `ko`/`en` 외의 값은 오류로 거부한다. 지침 텍스트와 뼈대는 저장이 아니라 적용 시점에 로케일 리소스에서 렌더한다. 지정이 없는 비대화형 실행은 기존과 바이트 단위로 동일하다.

## 결과 및 영향

- 영어 사용자는 `--lang en`·`AGENTIC_LANG=en`·첫 실행 선택·`config lang en` 중 하나로 TUI와 생성물을 모두 영어로 받는다.
- 기존 한국어 사용자와 CI(비대화형·지정 없음)는 동작이 바뀌지 않는다.
- 문자열은 `bin/i18n.mjs`의 ko/en 카탈로그로 단일화되고, 로케일 해석은 `resolveLocale()` 한 곳에 모인다.
- 검증: `evals/i18n.test.mjs`가 순서·거부·ko 보존·en 무한글·저장 선택 재사용을 확인한다. 관련 논의의 정본 형식은 [implementation-contracts.md](../discussion/architecture/topics/implementation-contracts.md)를 따른다.
