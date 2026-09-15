# 0011. 지원 에이전트를 Codex·Claude Code·Antigravity로 좁히고 Cursor·Copilot 산출물을 만들지 않는다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-15
* **결정자:** 제품 소유자
* **근거:** 외부 근거 없음: 지원 범위는 제품 소유자의 결정이며 외부 사실에 기대지 않는다.
* **관련:** [ADR 0009](0009-agent-rule-frontmatter.md)가 Cursor 규칙 파일에 적용한 결정을 대체한다. 에이전트 규칙 파일의 frontmatter 계약과 Antigravity 결정은 그대로 둔다. [ADR 0004](0004-antigravity-rules-path.md)의 Antigravity 경로 결정도 그대로다.

## 배경 (Context)

지금까지 `profile apply`·`profile sync`는 `AGENTS.md`와 함께 포인터 파일 네 종류(`CLAUDE.md`, `.agents/rules/agentic.md`, `.cursor/rules/agentic.mdc`, `.github/copilot-instructions.md`)를 만들고 갱신했다.

다음 단계의 제품 방향은 파일을 만드는 데서 그치지 않고, 저장소 여러 곳을 맞추고 에이전트가 규칙을 실제로 받는지 확인하는 것이다. 확인 기능은 에이전트마다 규칙을 읽는 조건과 남기는 기록을 따로 다뤄야 하므로, 지원하는 에이전트 수가 곧 유지 비용이 된다. 제품 소유자는 2026-09-15에 지원 목록에서 Cursor와 GitHub Copilot을 빼기로 정했다.

## 검토한 대안 (Options)

1. **다섯 에이전트 유지:** 산출물 템플릿은 이미 있다. 대신 앞으로 만들 확인 기능에서 두 에이전트의 로드 조건과 기록 판독을 따로 만들고 유지해야 한다.
2. **파일은 만들되 지원 목록에서만 뺀다:** 만들기는 하는데 받았는지 확인하지 않는 파일이 생긴다. 생성보다 전달을 완료 기준으로 삼는 방향과 맞지 않는다.
3. **세 에이전트로 좁히고 두 산출물을 만들지 않는다.**

## 결정 (Decision)

3을 택한다.

- 지원 에이전트는 Codex(`AGENTS.md` 표준), Claude Code(`CLAUDE.md`), Antigravity(`.agents/rules/`)다.
- `apply`·`sync`는 `.cursor/rules/agentic.mdc`와 `.github/copilot-instructions.md`를 만들거나 갱신하지 않는다. 두 템플릿을 패키지에서 뺀다.
- 프로젝트에 이미 있는 두 파일은 지우지 않는다. 관리 블록 밖에 사람이 쓴 내용이 섞였을 수 있기 때문이다. 두 파일의 관리 hash는 다음 `apply`·`sync`에서 `managedHashes`에서 빠진다.

## 결과 및 영향 (Consequences)

- 프로젝트 산출물은 `AGENTS.md`, `CLAUDE.md`, `.agents/rules/agentic.md`와 각 관리 영역의 base 복사본으로 줄어든다.
- **호환성 파괴:** 이 변경 이후 두 파일은 갱신되지 않고 관리 블록이 옛 내용으로 남는다. `.agentic/base/`의 두 base 파일도 남는다. 필요 없으면 사용자가 직접 지운다.
- ADR 0009의 frontmatter 복구 평가는 Cursor 규칙 파일 대신 Antigravity 규칙 파일로 검사한다. `references.md`의 Cursor·Copilot 로드 실측 기록은 판단 이력으로 남긴다.
- README, 사용 가이드, 아키텍처 문서의 지원 목록과 산출물 목록, 저장소 자체의 `.cursor/`, `.github/copilot-instructions.md`를 함께 정리한다. 어떤 평가도 쓰지 않던 옛 예시 폴더 `evals/synthetic/`도 지운다.
