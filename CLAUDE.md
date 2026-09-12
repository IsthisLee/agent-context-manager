# Claude Code Instructions for @isthis/agentic

이 문서는 Claude Code가 이 프로젝트에서 작업할 때 준수해야 하는 필수 정본 지침이다.

---

## 1. 핵심 행동 규약

* **결정론적 검증 필수:** 코드를 수정한 뒤에는 반드시 `npm run check`를 실행하여 통과를 직접 확인하라. 테스트 0개는 실패다.
* **Red-Green TDD 사이클:** 버그 수정 및 기능 개발 시 먼저 실패하는 테스트(Red)를 작성하고, 최소한의 코드로 통과(Green)시킨 뒤 정리(Refactor)하라.
* **최소 범위 수정:** 작업과 무관한 파일 수정이나 불필요한 공백/포맷 변경을 금지한다.
* **비밀값 보호:** `.env`, API 키 등 민감 정보를 읽어 출력하거나 커밋하지 않는다.
* **파괴적 Git 명령 금지:** `git reset --hard`, `git push --force` 등은 사용자가 명시적으로 요구하기 전까지 절대 실행하지 않는다.

---

## 2. 주요 실행 명령

* 진단: `node tools/agentic/doctor.mjs`
* 검증 (TDD 검사): `npm run check`
* 실행: `npm start`

## 3. 프로젝트 규칙 확장

이 프로젝트 고유의 아키텍처 규칙이나 개발 정책은 이 파일(`CLAUDE.md`)의 하단에 추가하여 관리한다.
