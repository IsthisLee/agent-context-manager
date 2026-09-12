# Changelog

이 프로젝트의 사용자 영향 변경을 기록한다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)을 따르며, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따른다.

## [Unreleased]

### Added

- 용도별 Core 생성·목록과 선택적 개발 지침 설정
- 선택한 Core의 프로젝트 적용과 에이전트별 지침 산출물 동기화

### Changed

- 실행 영수증을 테스트 실행 사실로 한정하고, 규칙 준수·제품 품질 평가와 구분
- 문서 정본·제품 범위·Core 소유권을 명확히 정리
- 저장소 개발·CI 패키지 관리자를 고정된 pnpm 환경으로 전환하고 npm 배포·사용 호환성은 유지
- Core 생성·지침 설정에서 옵션 생략 시 사용할 수 있는 TUI 제공
- `agentic setup` 단독 실행 시 scope별 Core 선택과 지침별 TUI 설정 제공
- `agt`를 `agentic` CLI의 짧은 별칭으로 제공
- TUI에 선택 설명·입력 검증·취소·최종 승인 단계를 추가

### Removed

- 대상 프로젝트에 검증 실행기·`doctor`·콜드 스타트 테스트를 주입하던 이전 하네스 기능

## [0.1.0] - 2026-09-12

### Added

- 크로스 에이전트 지침 동기화와 프로젝트 검증 도구의 초기 공개 버전
