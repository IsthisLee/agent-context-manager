# 0009. 에이전트 규칙 파일의 frontmatter를 파일 맨 앞에 두고 Antigravity 규칙을 항상 적용한다

* **상태:** 채택됨 (Accepted), 일부 대체됨: Cursor 규칙 파일 산출물은 [ADR 0011](0011-supported-agents.md)로 만들지 않는다
* **일자:** 2026-09-14
* **결정자:** 제품 소유자·개발자
* **근거:** [외부 참고 문헌의 에이전트 규칙 파일 로드 근거](../references.md#에이전트-규칙-파일-로드-근거)
* **관련:** [ADR 0004](0004-antigravity-rules-path.md)의 결과 중 "기능적 중복" 판단과 공식 문서 인용을 정정한다. 산출물 경로 `.agents/rules/agentic.md` 결정은 유지한다. 관리 블록 병합 계약은 [Agentic 관리 산출물의 안전한 동기화](../discussion/architecture/topics/managed-artifact-safety.md)를 따른다.

## 배경 (Context)

`AGENTS.md` 단일 공급이 실제 에이전트에서 동작하는지 점검했다. 점검 방법·에이전트별 결과·외부 문서 인용의 정본은 [외부 참고 문헌의 에이전트 규칙 파일 로드 근거](../references.md#에이전트-규칙-파일-로드-근거)이며, 여기서는 결정에 필요한 결론만 요약한다.

- Claude Code·Codex·GitHub Copilot CLI·Antigravity CLI·Cursor CLI는 루트 `AGENTS.md`를 읽었다.
- **Antigravity 규칙 파일이 로드되지 않았다.** frontmatter가 없는 `.agents/rules/agentic.md`는 로드되지 않았고, 맨 앞에 `trigger: always_on`만 추가하자 로드됐다. 공식 문서는 켜지는 방식의 기본값과 frontmatter 문법을 적지 않는다.
- **frontmatter가 파일 첫 줄에서 시작하지 않았다.** `mergeManagedDocument`가 템플릿 전체를 `<!-- agentic:managed:start -->` 마커로 감싸서, 새로 생성한 `.cursor/rules/agentic.mdc`의 첫 줄이 마커였고 `alwaysApply: true` frontmatter는 둘째 줄부터 시작했다. Cursor CLI는 이 파일을 로드하지 않았고, frontmatter가 첫 줄에 오도록 고친 파일은 로드했다.
- **ADR 0004의 인용이 현재 공식 문서와 다르다.** ADR 0004는 Antigravity가 루트 `AGENTS.md`·`GEMINI.md`를 읽는다고 공식 문서를 근거로 적었지만, 2026-09-14에 확인한 공식 문서에는 `AGENTS.md` 언급이 없다. 루트 `AGENTS.md`를 읽는 동작은 실험으로만 확인됐다. 또 ADR 0004가 "기능적 중복"이라고 판단한 `.agents/rules/agentic.md`는 실제로는 로드되지 않는 파일이었다.

## 검토한 대안 (Options)

1. **Antigravity 전용 파일을 없애고 루트 `AGENTS.md`에만 의존한다.** 실험상 지침 전달에는 손실이 없다. 하지만 `AGENTS.md` 읽기는 공식 문서에 없는 동작이라 예고 없이 바뀔 수 있다. 문서가 보장하는 `.agents/rules`를 동작하게 두는 편이 안전하므로 배제했다.
2. **frontmatter를 관리 영역 hash에 포함한다.** 관리 영역의 정의가 바뀌므로, 이미 적용된 프로젝트는 기록된 hash와 새로 계산한 hash가 달라져 다음 `sync`에서 거짓 충돌로 멈춘다. 배제했다.
3. **Agentic이 파일 맨 앞 frontmatter를 항상 템플릿 값으로 덮어쓴다.** 사용자가 `trigger: model_decision`처럼 켜지는 방식을 바꿨을 때 충돌 감지 없이 조용히 되돌린다. 사용자 영역 보존 계약과 맞지 않아 배제했다.
4. **`trigger: model_decision`을 기본값으로 쓴다.** 컨텍스트는 아낄 수 있지만 모델이 적용 여부를 판단하므로 로드가 보장되지 않는다. 포인터 파일은 약 600바이트로 짧아 Always On의 비용이 작다. 배제했다.
5. **frontmatter를 관리 블록 밖 파일 맨 앞에 두고, 이미 있으면 보존한다 (채택).**

## 결정 (Decision)

- `mergeManagedDocument`는 템플릿이 frontmatter로 시작하면 그 frontmatter를 관리 블록 밖 파일 맨 앞에 둔다. 관리 블록과 관리 hash에는 본문만 들어간다.
- 기존 파일 맨 앞에 frontmatter가 이미 있으면 그대로 보존하고, 없으면 템플릿 frontmatter를 맨 앞에 넣는다. 이전 버전이 관리 블록 안에 넣은 frontmatter는 블록을 다시 쓸 때 사라지므로 한 번만 남는다.
- Antigravity 템플릿 `templates/antigravity-rules/agentic.md`에 `trigger: always_on` frontmatter를 추가한다.

## 결과 및 영향 (Consequences)

- **호환성:** 관리 영역의 범위(마커 블록)는 바뀌지 않는다. 이전 버전이 만든 마커 우선 파일은 디스크의 관리 블록 hash가 기록과 같으므로 충돌 없이 `sync`되고, 그 과정에서 frontmatter가 맨 앞으로 옮겨진다.
- **알려진 한계:** 파일 맨 앞에 frontmatter가 이미 있으면 이후 템플릿의 frontmatter 변경은 그 파일에 전파되지 않는다. frontmatter는 관리 hash 밖이므로 사용자가 고쳐도 충돌로 감지하지 않는다.
- **확인하지 못한 것:** 확인은 각 에이전트의 CLI로만 했다. Antigravity IDE와 Cursor IDE에서 같은 결과가 나오는지는 확인하지 않았다.
- **반영하지 않은 범위:** 이 저장소 루트의 `.agents/rules/agentic.md`와 `.cursor/rules/agentic.mdc`는 이전에 생성된 파일이며 이번 변경에서 다시 생성하지 않았다.
- **검증:**
  - `node --test evals/sync-merge.test.mjs evals/profile.test.mjs`: 구현 전 37개 중 5개 실패, 구현 후 37개 모두 통과.
  - `pnpm test`: 96개 중 95개 통과. 실패 1개는 이 변경 전부터 실패하던 문서 검사기다.
  - 수정한 코드로 새 프로젝트에 적용한 뒤 `agy --add-dir <project> -p`로 다시 묻자 "Antigravity Rules for"가 보였다.
  - `cursor-agent -p --trust`: 수정 전 코드가 만든 프로젝트에서는 "Cursor Rules for"가 보이지 않았고, 수정한 코드로 적용한 프로젝트에서는 보였다.
