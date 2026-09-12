# Changelog

이 프로젝트의 사용자 영향 변경을 기록한다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)을 따르며, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따른다.

## [Unreleased]

### Added

- 용도별 Core 생성·목록과 선택적 개발 지침 설정
- 선택한 Core의 프로젝트 적용과 에이전트별 지침 산출물 동기화
- 공개 저장소 운영 문서와 기여·보안·행동규범 안내
- Node.js 24 LTS·26 Current CI, npm tarball 검사, Dependabot 설정, provenance 배포 workflow

### Changed

- 실행 영수증을 테스트 실행 사실로 한정하고, 규칙 준수·제품 품질 평가와 구분
- 문서 정본·제품 범위·Core 소유권을 명확히 정리
- 저장소 개발·CI 패키지 관리자를 고정된 pnpm 환경으로 전환하고 npm 배포·사용 호환성은 유지
- 지원 런타임을 Node.js 24 LTS 이상으로 상향하고 CI·배포 workflow·기여 문서를 동일하게 정렬
- Core 생성·지침 설정에서 옵션 생략 시 사용할 수 있는 TUI 제공
- `agentic setup` 단독 실행 시 scope별 Core 선택과 지침별 TUI 설정 제공
- `agt`를 `agentic` CLI의 짧은 별칭으로 제공
- TUI에 선택 설명·입력 검증·취소·최종 승인 단계를 추가
- 확인 절차가 있는 Core 삭제와 적용 프로젝트 보존 제공
- 에이전트별 지침 산출물의 Agentic 관리 영역과 사용자 영역 분리
- 프로젝트 적용·동기화 전 변경 계획을 확인하는 `--dry-run` 제공
- 프로젝트 `AGENTS.md`의 Core 영역과 에이전트 산출물 관리 블록의 수동 변경 감지, 파일 단위 원자적 교체 제공
- 손상된 Core·프로젝트 metadata와 디렉터리가 아닌 적용 대상을 명확한 오류로 거부
- 적용 전 모든 대상 파일의 심볼릭 링크 여부를 검사해 알려진 위험에서 부분 변경을 방지

### Removed

- 대상 프로젝트에 검증 실행기·`doctor`·콜드 스타트 테스트를 주입하던 이전 하네스 기능

## [0.1.0] - 2026-09-12

### Added

- 크로스 에이전트 지침 동기화와 프로젝트 검증 도구의 초기 공개 버전
