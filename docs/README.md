# Agentic Documentation Index

`agentic` 환경의 공식 기술 문서 및 설계 기록 모음입니다.

---

## 📚 문서 목록

1. **[아키텍처 개요 (Architecture)](architecture/)**
   * 코어 분리형 토폴로지 (Upstream Core ➔ Downstream Project 주입)
   * 3대 핵심 구성 요소 및 결정론적 검증 원칙
2. **[제품 방향 (Product Direction)](product-direction.md)**
   * Agentic의 목적, 책임 경계, 장기 구현 방향의 정본
   * README 제품 소개의 기준 문서
3. **[아키텍처 논의 (Architecture Discussion)](architecture-discussion/)**
   * 프로젝트 분석, 역할 선택, 선택적 평가, 검증 증거의 현재 부족한 점과 개편 방향
4. **[실전 워크플로 가이드 (Workflow)](workflow.md)**
   * 신규/기존 프로젝트 10초 초기화 및 검증 루프
   * AGENTS.md 중심의 단일 정본 관리 워크플로
5. **아키텍처 결정 기록 (ADRs)**
   * **[ADR 0001: 린 크로스 에이전트 하네스로의 피벗](adr/0001-lean-cross-agent-pivot.md)**: 자체 러너 폐기 및 린 하네스 피벗
   * **[ADR 0002: AGENTS.md 중심 SSOT 및 포인터 참조 패턴](adr/0002-agents-md-ssot-and-pointer-pattern.md)**: 5대 에이전트 규칙 중복 제거 및 단일 진실 공급원 확립
   * **[ADR 0003: 스마트 동기화 머지 및 콜드 스타트 스캐폴딩](adr/0003-smart-sync-merge-and-cold-start.md)**: 커스텀 규칙 보존, 신규 프로젝트 테스트 자동화, 지침 비대화 진단
   * **[ADR 0007: 안전한 콜드 스타트 테스트 부트스트랩](adr/0007-safe-cold-start-test-bootstrap.md)**: 기존 테스트 보존과 빈 프로젝트의 스모크 테스트 생성 경계
   * **[ADR 0004: 무의존성 순수 ESM 및 JSDoc 타입 검증](adr/0004-zero-dependency-esm-and-jsdoc.md)**: 무빌드 제로 디펜던시 유지 및 컴파일 괴리 방지
   * **[ADR 0005: ADR 기록 및 관리 의무화](adr/0005-adr-management.md)**: 중요 설계 결정의 기록 기준과 변경 이력 관리
   * **[ADR 0006: AGENTS.md 중심 SSOT 정리](adr/0006-agents-md-ssot-cleanup.md)**: 사용되지 않는 `specifications/` 제거 및 생성 경로 명확화
6. **[참고 문헌 및 비교 분석 (References)](references.md)**
   * 2026년 공식 연구 리포트 및 생태계 도구(`revfactory/harness`, `Archon` 등)와의 심층 비교
