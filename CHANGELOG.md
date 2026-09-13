# Changelog

이 프로젝트의 사용자 영향 변경을 기록한다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)을 따르며, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따른다.

## [Unreleased]

### Added

- 로케일(ko/en) 국제화: `--lang`·`AGENTIC_LANG`·저장된 선택·첫 실행 대화형 선택으로 TUI와 생성 지침 언어를 고르는 `config lang` 명령. 기본은 한국어, 영어는 opt-in
- 용도별 프로필 생성·목록과 선택적 개발 지침 설정
- 선택한 프로필의 프로젝트 적용과 에이전트별 지침 산출물 동기화
- 공개 저장소 운영 문서와 기여·보안·행동규범 안내
- Node.js 24 LTS·26 Current CI, npm tarball 검사, Dependabot 설정, provenance 배포 workflow
- OpenSSF Scorecard workflow와 README의 자동 계산 점수 뱃지
- 배포되는 공통 지침 6개의 정본 목록을 [지침 카탈로그](docs/architecture/guidance-catalog.md)로 정리. 프로필 `AGENTS.md`를 직접 편집해 지침을 채우는 경로를 워크플로 문서에 명시

### Changed

- **호환성 파괴:** `Core` 개념을 `Guidance Profile`(개발 지침 프로필, 짧게 프로필)로 개명. 모든 명령을 `profile` 하위로 통일(`profile create/list/view/remove/setup/apply/sync`)하고 `--core` 플래그 제거. `init`은 이름을 필수로 받는 `profile apply <name> <project>`로, `sync`는 이름을 받지 않고 기록된 프로필만 새로고침하는 `profile sync <project>`로 분리(이름·`--profile`/`--core`를 주면 거부). 저장 위치는 `~/.agentic-cores`→`~/.agentic-profiles`, 메타데이터 `agentic-core.json`→`agentic-profile.json`으로 바뀌며 최초 실행 때 자동 이관. 자세한 근거는 [ADR 0003](docs/adr/0003-rename-core-to-guidance-profile.md)
- 패키지 소개를 “사람과 AI 에이전트가 함께 따르는 개발 기준”으로 정렬하고, 프로필의 공통 지침과 프로젝트 도메인 지침의 소유 경계를 명확히 설명
- 실행 영수증을 테스트 실행 사실로 한정하고, 규칙 준수·제품 품질 평가와 구분
- 문서 정본·제품 범위·프로필 소유권을 명확히 정리
- 저장소 개발·CI 패키지 관리자를 고정된 pnpm 환경으로 전환하고 npm 배포·사용 호환성은 유지
- 지원 런타임을 Node.js 24 LTS 이상으로 상향하고 CI·배포 workflow·기여 문서를 동일하게 정렬
- Windows 경로 구분자·`npm.cmd`·설치된 `.cmd` shim 차이를 평가에서 처리하고, GitHub Actions를 Node 24 호환 버전으로 갱신
- 프로필 생성·지침 설정에서 옵션 생략 시 사용할 수 있는 TUI 제공
- `agentic profile setup` 단독 실행 시 scope별 프로필 선택과 지침별 TUI 설정 제공
- `agt`를 `agentic` CLI의 짧은 별칭으로 제공
- TUI에 선택 설명·입력 검증·취소·최종 승인 단계를 추가
- 확인 절차가 있는 프로필 삭제와 적용 프로젝트 보존 제공
- 에이전트별 지침 산출물의 Agentic 관리 영역과 사용자 영역 분리
- 프로젝트 적용·동기화 전 변경 계획을 확인하는 `--dry-run` 제공
- 프로젝트 `AGENTS.md`의 프로필 영역과 에이전트 산출물 관리 블록의 수동 변경 감지, 파일 단위 원자적 교체 제공
- 손상된 프로필·프로젝트 metadata와 디렉터리가 아닌 적용 대상을 명확한 오류로 거부
- 적용 전 모든 대상 파일의 심볼릭 링크 여부를 검사해 알려진 위험에서 부분 변경을 방지
- Antigravity 지침 산출물 경로를 `.gemini/rules/agentic.md`에서 `.agents/rules/agentic.md`(Antigravity 공식 워크스페이스 규칙 폴더)로 정정. 이전에 적용한 프로젝트에 남은 `.gemini/rules/agentic.md`는 자동 삭제하지 않으므로 수동으로 지운다. 근거는 [ADR 0004](docs/adr/0004-antigravity-rules-path.md)

### Removed

- 대상 프로젝트에 검증 실행기·`doctor`·콜드 스타트 테스트를 주입하던 이전 하네스 기능

## [0.1.0] - 2026-09-12

### Added

- 크로스 에이전트 지침 동기화와 프로젝트 검증 도구의 초기 공개 버전
