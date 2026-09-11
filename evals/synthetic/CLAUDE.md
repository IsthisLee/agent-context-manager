# Claude Code Instructions for synthetic-demo

이 문서는 Claude Code가 이 프로젝트에서 작업할 때 준수해야 하는 필수 정본 지침이다.

---

## 1. 핵심 행동 규약

* **결정론적 검증 필수:** 코드를 수정한 뒤에는 반드시 `npm run check`를 실행하여 통과를 직접 확인하라. 테스트 0개는 실패다.
* **최소 범위 수정:** 작업과 무관한 파일 수정이나 불필요한 공백/포맷 변경을 금지한다.
* **비밀값 보호:** `.env`, API 키 등 민감 정보를 읽어 출력하거나 커밋하지 않는다.
* **파괴적 Git 명령 금지:** `git reset --hard`, `git push --force` 등은 사용자가 명시적으로 요구하기 전까지 절대 실행하지 않는다.

---

## 2. 주요 실행 명령

* 진단: `node tools/agentic/doctor.mjs`
* 검증 (TDD 검사): `npm run check`
* 실행: `npm start`

---

## 3. 규칙 승격 가이드 (Rule Promotion)

작업 중 얻은 유용한 패턴은 `agentic` 공통 코어에 반영할 수 있으나, 본 프로젝트의 회사명/비즈니스 로직/고유 변수명은 완전히 제외하고 순수 기술 패턴으로만 추상화해야 한다.
