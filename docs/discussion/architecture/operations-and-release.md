# Operations and Release Contracts

**상태:** Proposed

이 문서는 현재 CLI 운영 계약의 공백과 개선 방향을 기록한다. 현재 동작과 목표 동작을 구분하며, 구현·eval·ADR 채택 전에는 목표 동작을 확정 아키텍처로 취급하지 않는다.

## 현재 동작과 공백

| 영역 | 현재 동작 | 공백 |
|---|---|---|
| `doctor` | Git, 지침 파일 존재, `AGENTS.md` 크기, `node_modules` 존재를 확인 | 스크립트·도구·템플릿 버전·검증 증거는 확인하지 않음 |
| `sync` | `AGENTS.md` 확장 영역을 보존하고 포인터·도구 파일을 덮어씀 | 사전 diff, 덮어쓸 파일 목록, 버전 manifest가 없음 |
| `check` | 기본 `npm test` 실행과 종료 코드 기록 | 프로젝트별 검증 명령과 테스트 수 계약이 제한적 |
| 릴리즈 문서 | npm 배포 명령을 안내 | 배포 전 검증·태그·변경 내역 확인 계약이 없음 |

## Doctor 강화

향후 `doctor`는 다음을 읽기 전용으로 확인한다.

* `package.json`의 `test`·`check` 스크립트 존재와 실행 대상
* `tools/agentic/doctor.mjs`, `check.mjs` 존재 여부
* `.agentic/last-check.json`의 schema와 최근 검증 상태
* 생성 파일의 Core·템플릿 버전 manifest
* 실제 의존성이 있을 때만 설치 상태를 경고하는 정책

`doctor`는 비밀값을 읽거나 테스트를 실행하지 않는다. 진단 실패와 경고를 명확히 구분하고, 가능한 경우 재현 가능한 수정 명령을 출력한다.

## Sync 안전성

향후 `sync`는 다음 계약을 제공한다.

* `sync --dry-run`: 파일을 쓰지 않고 생성·변경·덮어쓰기 대상을 보고한다.
* `sync --check`: 대상 파일이 현재 Core 템플릿과 다른지 CI에서 검사한다.
* manifest: 생성된 파일, Core 버전, 템플릿 버전, 마지막 동기화 시각을 기록한다.
* 포인터·도구 파일을 덮어쓰기 전에 명시적으로 보고하고, `AGENTS.md`의 프로젝트 규칙 확장 영역은 계속 보존한다.
* 롤백은 이전 Core 버전으로 재동기화하거나 Git diff를 되돌리는 방식으로 지원한다.

자동 Git hook이나 사용자 파일 자동 백업은 기본값으로 두지 않는다. Git이 이미 변경 이력과 복구 수단을 제공하므로, Agentic은 변경 내용을 투명하게 보여 주는 데 집중한다.

## Workflow와 릴리즈 문서

현재 `docs/workflow.md`는 구현된 `init`, `sync`, `doctor`, `check`만 안내한다. `analyze`, `plan`, 가상 팀 artifact는 구현과 eval이 완료된 뒤에만 실전 워크플로에 추가한다.

릴리즈 전에는 다음을 확인한다.

1. `npm run check` 성공
2. 배포 대상 파일과 `package.json` 버전 확인
3. 변경 내역과 ADR·사용자 문서 갱신 확인
4. `npm version`으로 태그 생성 후 `npm publish --access public`
5. 태그와 커밋을 원격 저장소에 푸시
