# 0004. Antigravity 규칙 파일을 `.agents/rules/`로 생성한다

* **상태:** 채택됨 (Accepted), 일부 정정됨: 결과의 "기능적 중복" 판단과 공식 문서 인용은 [ADR 0009](0009-agent-rule-frontmatter.md)가 정정한다.
* **일자:** 2026-09-13
* **결정자:** 제품 소유자·개발자
* **관련:** [에이전트 산출물 동기화](../discussion/architecture/topics/agent-sync.md)의 "실제 해석 가능성 확인" 후속을 부분 해소한다. 적용 전 규칙 위치 탐지는 [에이전트 규칙 위치 탐지](../discussion/architecture/topics/agent-rule-discovery.md)로 분리한다.

## 배경 (Context)

`profile apply`·`profile sync`는 Antigravity 어댑터 산출물을 `.gemini/rules/agentic.md`에 생성해 왔다. 이는 Gemini CLI의 `.gemini/` 규약을 "Antigravity는 구글·Gemini 계열"이라는 추정으로 Antigravity에 그대로 적용한 것이었고, 실제 Antigravity 규약을 확인하지 않은 가정이었다.

Antigravity 공식 문서(`antigravity.google/docs/rules-workflows`)를 확인한 결과는 다르다.

- 워크스페이스 규칙 폴더는 **`.agents/rules/`(복수)가 현재 기본값**이고, `.agent/rules/`(단수)는 하위호환으로 유지된다.
- 전역 규칙은 `~/.gemini/GEMINI.md`에 둔다.
- Antigravity는 루트의 `AGENTS.md`와 `GEMINI.md`도 규칙으로 읽는다.

즉 `.gemini/rules/agentic.md`는 Antigravity가 읽지 않는 자리에 놓인 산출물이었다. 그동안 Antigravity에 지침이 실제로 전달되던 경로는 이 패키지가 함께 생성하는 루트 `AGENTS.md`였고, `.gemini/rules/agentic.md`는 어느 도구도 읽지 않는 잡파일로 남아 있었다. `agent-sync` 논의에 미해결 후속으로 적어 둔 "지원 대상별 최소 포인터와 실제 해석 가능성 확인"이 실제 불일치로 드러난 사례다.

## 검토한 대안 (Options)

1. **A: Antigravity 전용 어댑터 제거, 루트 `AGENTS.md`에만 의존.** Antigravity가 `AGENTS.md`를 네이티브로 읽으므로 지침 전달에는 손실이 없다. "도구가 정본 참조를 지원하면 어댑터를 만들지 않는다"는 `agent-sync`의 설계 계약과도 맞고, 아무도 읽지 않는 파일이 사라진다. 단, 지원 도구 중 Antigravity만 전용 파일이 없어 산출물 모델이 비대칭이 된다.
2. **B: 올바른 공식 경로 `.agents/rules/agentic.md`로 재배치(채택).** 모든 지원 도구가 각자 정식 경로에 전용 파일을 갖는 대칭을 유지하고, 향후 Antigravity 전용 지침이나 activation 모드(Always On·Model Decision)를 담을 슬롯을 확보한다. 단, 현재 파일 내용이 "`AGENTS.md`를 읽어라"는 포인터라, Antigravity가 이미 네이티브로 읽는 `AGENTS.md`를 가리키는 기능적 중복이다.
3. **`.agent/rules/`(단수)에도 동시 생성해 하위호환까지 덮기.** 지금은 기본값 `.agents/rules/`만으로 충분하고, 두 곳 생성은 중복 관리 부담이라 배제한다.

## 결정 (Decision)

- Antigravity 어댑터 산출물을 **`.agents/rules/agentic.md`**로 생성한다.
- 템플릿 디렉터리를 `templates/gemini-rules/` → `templates/antigravity-rules/`로 바꾼다. 템플릿 내용은 그대로 두고(헤더가 이미 "Antigravity Rules"다), 위치와 이름만 바로잡는다.
- 파일 내용은 `AGENTS.md`를 가리키는 포인터로 유지한다. 유지 근거는 도구별 정식 경로 일관성이며, 현재 이 파일이 기능적으로 중복임을 인정한다.
- `.agent/rules/`(단수)에는 생성하지 않는다.

## 결과 및 영향 (Consequences)

- **기능적 중복 인정.** Antigravity는 루트 `AGENTS.md`를 네이티브로 읽으므로 `.agents/rules/agentic.md`는 지침 전달에 추가 효과가 없다. 유지하는 이유는 (1) 지원 도구별 전용 파일의 대칭, (2) 향후 Antigravity 전용 내용·activation 모드를 담을 슬롯 두 가지다. 이 슬롯에 실제 전용 내용이 생기면 중복은 해소된다.
- **호환성·마이그레이션.** 이전에 apply한 프로젝트에는 낡은 `.gemini/rules/agentic.md`가 남는다. 이 패키지는 관리 산출물을 삭제하지 않는 정책이라(적용 프로젝트 파일 보존) 자동으로 정리하지 않는다. 다음 `apply`·`sync`에서 `agentic.project.json`의 `managedHashes`에서는 `.gemini/rules/agentic.md` 항목이 사라지지만 디스크의 파일 자체는 남으므로, 사용자가 수동으로 지워야 한다. `CHANGELOG.md`의 `Unreleased`에 이 안내를 적는다.
- **다른 도구는 무영향.** Cursor `.cursor/rules/agentic.mdc`, Copilot `.github/copilot-instructions.md`, Claude `CLAUDE.md`는 각 도구의 정식 경로이므로 변경하지 않는다. 이번 수정은 Antigravity 한 건에만 해당한다.
- **반영 범위.** `bin/agentic.mjs`의 산출물 매핑, `templates/antigravity-rules/agentic.md`, `evals/profile.test.mjs`(managedHashes 기대 목록·심링크/부모 경로 프리플라이트 테스트), README(ko/en) 지원 에이전트 표, `docs/discussion/architecture/topics/agent-sync.md`·`managed-artifact-safety.md`, `CHANGELOG.md`.
- **검증.** `pnpm test`(node --test) 전체 통과.
- **후속.** 적용 전에 기존 에이전트 규칙 위치를 스캔·보고하는 discovery는 이 ADR 범위 밖이며, `agent-rule-discovery` 논의 문서에서 다룬다. 다른 도구도 최근 `AGENTS.md`를 읽기 시작했으므로 "중복 포인터를 전부 정리할지"는 별도 결정으로 남긴다.
