# Agentic 문서 안내

문서는 정본을 하나만 두고, 다른 문서에서는 요약과 링크만 제공한다.

## 문서 지도

1. [제품 방향](product-direction.md): 목표·범위·용어·단계별 완료 기준
2. [구현 원리](implementation-principles.md): npm·Node.js·CLI 생태계 원리와 이 패키지 구현의 연결
3. [현재 아키텍처](architecture/): 현재 구현된 구조와 소유권
   - [기능 구현 메커니즘](architecture/implementation-mechanics.md): 현재 구현된 각 기능의 내부 코드 로직
   - [지침 카탈로그](architecture/guidance-catalog.md): 프로필에 배포되는 공통 지침 6개의 정본과 작성 경로
4. [아키텍처 구현 계획](discussion/architecture/): 단계별 계약과 미구현 기능
5. [사용 가이드](usage-guide.md): 설치부터 동기화까지 처음부터 끝까지 읽는 사용 설명
6. [사용자 워크플로](workflow.md): 순서와 명령 소유권을 빠르게 보는 절차 요약
7. [CLI Reference](cli-reference.md): 모든 명령어·옵션·TUI·자동화 방식
8. [공개 저장소 운영](repository-operations.md): 품질 게이트·릴리스·보안·기여 정책
9. [외부 참고 문헌](references.md): 연구·사례·비교 도구
10. [결정 기록](adr/): 확정된 장기 결정
   - [ADR 0001: 제품 범위](adr/0001-product-scope.md)
   - [ADR 0002: 로케일(ko/en) 국제화](adr/0002-locale-i18n.md)
   - [ADR 0003: Core를 Guidance Profile로 개명하고 apply/sync 분리](adr/0003-rename-core-to-guidance-profile.md)
   - [ADR 0004: Antigravity 규칙 파일을 `.agents/rules/`로 생성](adr/0004-antigravity-rules-path.md)

저장소 공개 운영 파일: [`CONTRIBUTING.md`](../CONTRIBUTING.md) · [`SECURITY.md`](../SECURITY.md) · [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) · [이슈 템플릿](../.github/ISSUE_TEMPLATE/)

문서 변경 시 루트 [`AGENTS.md`](../AGENTS.md)와 [`구현 계약`](discussion/architecture/topics/implementation-contracts.md)의 규칙을 따른다.
