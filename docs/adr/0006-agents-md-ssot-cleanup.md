# Architecture Decision Record (ADR) 0006: AGENTS.md 중심 SSOT 정리

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-12
* **결정자:** Isthis & Codex

---

## 1. 배경 및 문제 (Context & Problem Statement)

ADR 0002에서 대상 프로젝트의 `AGENTS.md`를 유일한 SSOT로 채택했다. 그러나 `specifications/`에는 핵심 원칙·보안 경계·에이전트 계약을 중복 설명하는 문서가 남아 있었고, `init`과 `sync`는 이 파일들을 읽거나 대상 프로젝트에 주입하지 않았다.

이 상태는 실제 생성 원본인 `templates/AGENTS.md`와 사용되지 않는 `specifications/`를 동시에 SSOT처럼 보이게 해 유지보수 대상을 불필요하게 늘렸다.

## 2. 고려한 대안 (Options Considered)

1. **`specifications/`를 유지하고 SSOT로 복원:** 템플릿 생성기를 재설계해야 하며, Markdown 규칙을 다시 조합하는 복잡성이 생긴다.
2. **`specifications/`를 참고 문서로 격하:** 규칙 중복과 실제 생성 경로의 불일치가 계속 남는다.
3. **`specifications/`를 제거하고 AGENTS.md 경로만 유지 (채택):** 대상 프로젝트의 `AGENTS.md`와 이를 생성하는 `templates/AGENTS.md`의 관계를 명확히 한다.

## 3. 결정 사항 (Decision)

1. 사용되지 않는 `specifications/` 디렉터리를 제거한다.
2. 대상 프로젝트의 규칙 SSOT는 `AGENTS.md`로 유지한다.
3. Core의 생성 원본은 `templates/AGENTS.md`이며, 다른 에이전트용 템플릿은 해당 파일을 가리키는 포인터 역할만 한다.
4. 긴 운영 절차와 향후 아키텍처 논의는 `docs/`에 두고, `AGENTS.md`에는 필요한 링크와 핵심 실행 규칙만 둔다.
5. ADR 0001의 `specifications/` 언급은 당시의 역사적 결정을 나타내므로 수정하지 않고, 이 ADR이 그 부분을 대체한다.

## 4. 결과 및 영향 (Consequences)

* 규칙의 실제 생성 경로가 `templates/AGENTS.md` → 대상 프로젝트 `AGENTS.md`로 명확해진다.
* 중복 문서 세 개와 패키지 배포 항목이 제거된다.
* 역할 계약과 운영 상세는 향후 `docs/workflow.md`에 기록하고, 생성되는 `AGENTS.md`는 간결한 지도 역할을 유지한다.
