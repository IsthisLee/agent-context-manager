# Core Management and Application

**상태:** Proposed

## 제안 요약

### 핵심 정보

| 항목 | 내용 |
| --- | --- |
| 대상 계층 | 사용자·조직, 전역 Agentic CLI, 독립 Core 폴더, 대상 프로젝트의 최종 `AGENTS.md`·manifest |
| 제안 목표 | 개인·조직이 공통 규칙을 독립 Core로 소유·공유하고, 프로젝트 고유 규칙을 보존하며 같은 개발 환경을 재현한다. |
| 제안 이유 | 현재 내장 템플릿과 프로젝트별 확장 규칙만으로는 여러 프로젝트의 공통 정책·조직 공유·안전한 업데이트를 관리할 수 없다. |
| 결정할 것 | Core 형식·레지스트리·manifest 식별자·개인 Core 3-way 업데이트·조직 Git·CI 적용 경계 |
| 중요도 | Critical — Core의 소유·배포 단위를 정해야 여러 프로젝트·조직이 같은 개발 환경을 재현할 수 있음 |

### 제안 관계

| 항목 | 내용 |
| --- | --- |
| 선행 작업 | Core 형식·등록 정보·대상 프로젝트 manifest·`sync` 관리 영역의 최소 계약 확정 |
| 선행 제안 | [Sync and Artifact Contracts](sync-and-artifacts.md), [Verification Contract](verification.md) |
| 후속 제안 | 없음 — 채택 뒤 ADR와 구현·운영 문서로 승격 |
| 연관 제안 | [Operations and Release Contracts](operations-and-release.md), [Adaptive Harness](adaptive-harness.md), [Ecosystem Comparison Follow-ups](ecosystem-follow-ups.md) |

### 추진 계획

| 항목 | 내용 |
| --- | --- |
| 후속 작업 | 전역 CLI 명령, Core 생성·등록·선택·업데이트, Git 기반 Core 식별, init/sync/migration eval, ADR·아키텍처·워크플로 갱신 |
| 권장 다음 작업 | 개인 Core와 조직 공유 Core의 형식, 전역 설치의 책임, Core 업데이트·프로젝트 동기화의 충돌·승인 정책을 검토로 확정 |

## 목차

1. 문제와 목표
2. Core의 소유권과 두 사용 방식
3. 전역 CLI와 Core 레지스트리
4. 대상 프로젝트 적용·동기화 계약
5. 개인 Core 업데이트와 충돌 처리
6. 버전·재현성·조직 공유
7. 에이전트의 안전한 운영 흐름
8. 경계와 제외 범위
9. 검토한 대안
10. 구현 전 확정할 사항
11. 구현·검증 초안

## 1. 문제와 목표

현재 Agentic은 내장 `templates/AGENTS.md`를 대상 프로젝트의 `AGENTS.md`로 렌더링하고, 대상 프로젝트의 `## 4. 프로젝트 규칙 확장 (SSOT)`만 보존한다. 이 구조만으로는 개인이 여러 프로젝트에 적용할 공통 정책을 소유하거나, 조직 구성원이 동일한 Agentic 개발 환경을 버전 단위로 공유할 수 없다.

목표는 다음과 같다.

* 개인은 자신의 공통 TDD·Git·보안·문서화 규칙을 Core로 관리한다.
* 조직은 Git으로 관리하는 하나의 Core를 구성원에게 공유한다.
* 대상 프로젝트는 선택한 Core와 프로젝트 고유 규칙을 합친 최종 `AGENTS.md`를 에이전트용 SSOT로 가진다.
* Core·프로젝트 규칙·생성 도구의 소유권과 갱신 경로를 분리해, 업데이트가 사용자 규칙을 조용히 덮어쓰지 않게 한다.

## 2. Core의 소유권과 두 사용 방식

Core는 전역 npm 설치본의 `node_modules`가 아니라, 사용자 또는 조직이 소유하는 독립 폴더다.

```text
전역 Agentic CLI
├── 개인 Core: ~/.agentic-cores/personal/
├── 개인 Core: ~/.agentic-cores/<another-name>/
└── 조직 Core 등록: ~/work/company-agentic-core/  # 조직 Git 저장소 작업 사본
```

### 2.1 개인 Core

개인은 전역 CLI의 초기 설정에서 이름을 선택한다. CLI는 사용자 소유 위치에 Core 폴더를 만들고 기본 Core로 지정한다.

```bash
npm install -g @isthis/agentic
agentic setup
# Core 이름 입력: personal
# → ~/.agentic-cores/personal/ 생성 및 기본 Core 지정
```

개인은 해당 폴더의 `AGENTS.md`와 연결 문서를 수정해 자신의 공통 규칙을 관리한다. 추가 Core도 만들 수 있다.

```bash
agentic core create consulting
agentic core use consulting
```

### 2.2 조직 공유 Core

조직 Core는 별도 Git 저장소로 관리한다. 구성원은 일반 Git 절차로 저장소를 clone·pull하고, 전역 CLI에 작업 사본 경로를 등록한다.

```bash
git clone <company-core-repository> ~/work/company-agentic-core
agentic core register company ~/work/company-agentic-core
agentic init . --core company
```

CLI가 조직 Git URL을 임의로 내려받거나 인증을 처리하지 않는다. 조직의 기존 Git 권한·PR·리뷰·릴리즈 절차가 Core 변경을 통제한다.

## 3. 전역 CLI와 Core 레지스트리

전역 설치는 모델 런타임이 아니라 **Core를 만들고, 등록하고, 선택해 대상 프로젝트에 적용하는 관리 CLI**다. 기본 사용자 흐름은 전역 CLI를 기준으로 한다. 전역 설치가 어려운 환경에서는 `npx @isthis/agentic`을 보조 실행 방식으로 제공할 수 있으나, Core의 소유권 모델은 같다.

| 명령 | 제안된 동작 |
| --- | --- |
| `agentic setup` | 이름을 받아 개인 Core를 만들고 기본 Core로 지정 |
| `agentic core create <name>` | `~/.agentic-cores/<name>/`에 추가 개인 Core 생성 |
| `agentic core register <name> <path>` | 기존 개인·조직 Core 폴더를 이름으로 등록 |
| `agentic core list` | 등록된 Core와 기본 Core 표시 |
| `agentic core use <name>` | 기본 Core 변경 |
| `agentic core update <name> --dry-run` | 개인 Core의 새 기본 규칙 적용 결과·충돌·영향 프로젝트를 쓰기 없이 표시 |
| `agentic core update <name> --apply` | 사용자가 검토·승인한 충돌 없는 개인 Core 업데이트를 적용 |
| `agentic init <project> [--core <name>]` | 기본 또는 지정 Core를 대상 프로젝트에 적용 |
| `agentic sync <project>` | 대상 프로젝트 manifest가 기록한 Core를 기준으로 갱신 |

Core 레지스트리는 이름·정규화된 로컬 경로·Core 식별자·마지막 확인 상태만 사용자 설정에 저장한다. 비밀값·토큰·Core의 전체 본문은 기록하거나 출력하지 않는다.

## 4. 대상 프로젝트 적용·동기화 계약

```text
Core의 공통 규칙                    Core 소유
          +
대상 프로젝트의 고유 규칙            프로젝트 소유
          ↓
대상 프로젝트 AGENTS.md             에이전트가 읽는 최종 SSOT
```

`init`은 선택한 Core에서 기본 규칙·포인터 템플릿·생성 도구를 읽고 대상 프로젝트에 렌더링한다. 대상 프로젝트의 `AGENTS.md`는 최종 단일 정본이지만, 생성 원본의 소유권은 Core와 프로젝트로 나뉜다.

| 영역 | 소유자 | `sync` 동작 |
| --- | --- | --- |
| Core 공통 규칙 영역 | 선택한 Core | 선택한 Core 기준으로 갱신 |
| 프로젝트 규칙 확장 영역 | 대상 프로젝트 | 보존 |
| 도구별 포인터·`tools/agentic/` | Core 템플릿 | 생성·갱신 |
| 제품 코드·실제 테스트·기존 검증 게이트 | 대상 프로젝트 | 임의로 덮어쓰지 않음 |

AI 에이전트는 프로젝트 고유 규칙의 초안을 제안할 수 있으나, 생성 도구·포인터·Core 공통 규칙을 직접 수정하는 주체가 아니다. 사용자는 규칙 변경과 `sync` 결과를 diff로 검토한다.

`sync <project>`는 기본 Core가 나중에 바뀌어도 대상 프로젝트가 이미 적용한 Core를 manifest에서 읽는다. 다른 Core로 바꾸려면 `sync <project> --core <name>` 같은 명시적 전환 명령과 사전 diff가 필요하다.

## 5. 개인 Core 업데이트와 충돌 처리

전역 패키지의 업데이트와 사용자가 소유한 개인 Core의 업데이트는 별개다. `npm update -g @isthis/agentic`은 Core 폴더·레지스트리·대상 프로젝트를 수정하지 않는다. 개인 Core에 새 Agentic 기본 규칙을 반영하려면 별도의 명시적 명령과 검토가 필요하다.

```bash
agentic core update personal --dry-run
# 기본 규칙 변경, 사용자 수정, 충돌 경로, 영향을 받을 대상 프로젝트를 출력한다.

agentic core update personal --apply
# 사용자가 검토·승인한 뒤에만 충돌 없는 변경을 적용한다.
```

업데이트는 다음 세 입력을 비교하는 3-way 병합 계약을 가져야 한다.

1. Core를 만들거나 직전 업데이트할 때 기록한 기본 규칙 기준본
2. 사용자가 현재 수정한 개인 Core
3. 새 Agentic 버전이 제공하는 기본 규칙 후보

따라서 개인이 수정하지 않은 영역은 새 기본 규칙으로 갱신할 수 있고, 사용자가 수정한 영역은 보존한다. 같은 영역을 양쪽이 바꾼 경우에는 충돌로 보고한다. 충돌이 있으면 `--apply`도 어떤 Core 파일도 부분적으로 쓰지 않고 실패하며, 사용자가 해결한 뒤 다시 dry-run을 실행한다. 기준본을 어디에 어떤 형식으로 보관할지는 구현 전 확정한다.

조직 Core는 이 명령으로 Agentic 기본 템플릿과 병합하지 않는다. 조직의 Git 저장소에서 PR·리뷰·merge·checkout으로 업데이트하고, 이후 영향받는 대상 프로젝트에 명시적으로 `sync`한다. 이렇게 개인 Core의 편의 업데이트와 조직의 변경 통제를 섞지 않는다.

## 6. 버전·재현성·조직 공유

대상 프로젝트의 `.agentic/manifest.json`에는 최소한 다음을 기록하는 방안을 제안한다.

```json
{
  "schemaVersion": 1,
  "core": {
    "name": "company",
    "identity": "company-agentic-core",
    "revision": "git:abc1234",
    "contentHash": "sha256:..."
  },
  "managedFiles": ["AGENTS.md", "CLAUDE.md", "tools/agentic/check.mjs"]
}
```

* 조직 Git Core는 적용 시점의 커밋 해시와 콘텐츠 해시를 기록한다.
* 개인 Core는 콘텐츠 해시와 선택적으로 사용자 지정 버전을 기록한다.
* 대상 프로젝트 manifest에는 사용자의 절대 경로나 인증 정보, Git 원격 URL을 기본적으로 기록하지 않는다.
* `doctor`는 등록 Core 누락·변경·관리 영역 불일치를 읽기 전용으로 보고한다.
* 조직 구성원은 같은 Core 커밋을 checkout한 뒤 `agentic sync <project>`를 실행해 같은 환경을 재현한다.

CI의 재현은 전역 사용자 설정에 의존하지 않는다. CI는 조직 Core 저장소의 특정 커밋을 checkout하고, 명시 경로 또는 패키지화된 Core 식별자로 적용하는 별도 계약이 필요하다. 이 CI 흐름은 구현 전 확정할 항목이다.

## 7. 에이전트의 안전한 운영 흐름

에이전트는 Core나 대상 프로젝트의 상태를 읽고, 개인 Core 업데이트의 `--dry-run`을 실행해 변경·충돌·영향 범위를 분석할 수 있다. 적용 단계는 다음 순서를 따른다.

1. 에이전트가 dry-run 결과와 영향받는 Core·대상 프로젝트·충돌 여부를 사용자에게 설명한다.
2. 사용자가 명시적으로 승인한 경우에만 에이전트가 `core update --apply` 또는 대상 프로젝트 `sync`를 실행한다.
3. 적용 뒤 에이전트는 영향받는 각 대상 프로젝트의 네이티브 검증 명령(예: `npm run check`)을 실행하고 결과를 보고한다.

에이전트는 Core 업데이트를 자동 적용하거나, 조직 Core의 `git pull`·commit·push·충돌 해결을 사용자 승인 없이 수행하지 않는다. Core는 공유 정책 자산이므로, 에이전트의 역할은 초안·분석·검증 보조이며 최종 변경 통제는 사용자 또는 조직 절차에 둔다.

## 8. 경계와 제외 범위

* Agentic은 Codex·Claude Code 등의 CLI를 감싸거나, 모델 인증·세션·stdout 형식을 관리하지 않는다.
* Core는 지침·템플릿·검증 계약을 제공할 뿐, 대상 프로젝트의 비즈니스 코드·실제 데이터·제품 테스트를 소유하지 않는다.
* 자동 Git clone, 원격 Core 레지스트리, Git 인증 처리는 기본 범위에 넣지 않는다.
* 전역 `node_modules` 또는 설치된 패키지 파일을 사용자가 직접 수정하는 방식은 지원하지 않는다.
* 전역 패키지 업데이트가 개인·조직 Core를 자동으로 변경하는 방식은 지원하지 않는다.
* Core 동기화가 대상 프로젝트의 기존 `check` 스크립트·테스트 설정을 추측해 덮어쓰지 않는다.

## 9. 검토한 대안

| 대안 | 장점 | 제외 또는 보류 이유 |
| --- | --- | --- |
| 설치된 패키지의 `AGENTS.md` 직접 수정 | 가장 직관적으로 보임 | 업데이트·재설치 시 유실되고 사용자 자산이 아님 |
| 대상 프로젝트마다 규칙을 복사·수정 | 구현이 단순함 | 프로젝트 간 드리프트·동기화 부담이 다시 생김 |
| 전역 Core 하나만 강제 | 시작이 단순함 | 조직·고객·규제 환경을 분리할 수 없음 |
| 모든 Core를 전역 CLI가 복사·관리 | 온보딩이 간단함 | 조직 Core의 Git 이력·PR·리뷰와 분리되어 drift가 생김 |
| 패키지 업데이트 때 개인 Core 자동 갱신 | 최신 규칙을 즉시 받음 | 사용자 규칙을 조용히 덮어쓰거나 충돌을 숨길 수 있음 |
| **여러 독립 Core + 전역 CLI 등록·선택** | 개인 편의와 조직 공유·버전 관리 모두 충족 | manifest·전환·CI 계약을 추가로 설계해야 함 |

## 10. 구현 전 확정할 사항

1. Core의 최소 디렉터리 구조와 `core.json` schema를 확정한다.
2. `agentic setup`의 비대화·자동화 모드와 기본 Core 미설정 시 UX를 확정한다.
3. 개인 Core의 위치와 플랫폼별 경로 정책을 확정한다.
4. `core register`가 허용할 로컬 경로·Git 작업 사본 검증 기준과 삭제·이동 시 오류 UX를 확정한다.
5. manifest의 Core identity·revision·content hash·관리 파일 목록, 프로젝트 이동과 Core 이름 변경 정책을 확정한다.
6. `sync --core` 전환의 dry-run·충돌·롤백 계약을 확정한다.
7. CI에서 Core를 재현할 명시 경로·checkout·권한 경계를 확정한다.
8. 기존 `templates/AGENTS.md` 기반 프로젝트를 Core 기반 구조로 옮기는 마이그레이션과 보존 규칙을 확정한다.
9. 개인 Core 업데이트에 사용할 기준본의 저장 위치·보존 기간·무결성 검증과 3-way 병합 단위를 확정한다.
10. `core update --dry-run`의 출력 형식, 충돌 시 무변경 보장, `--apply`의 원자성·복구 정책을 확정한다.
11. 조직 Core의 Git 업데이트와 대상 프로젝트 `sync` 사이의 승인·검증 책임을 조직 운영 절차와 맞춘다.

## 11. 구현·검증 초안

구현을 승인하기 전에는 현재 CLI·README·아키텍처 문서가 이 기능을 제공하는 것처럼 변경하지 않는다. 승인 뒤에는 다음 Red-Green-Refactor eval을 먼저 추가한다.

1. `setup`과 `core create`가 사용자 소유 위치에 편집 가능한 Core와 기본 Core 설정을 만든다.
2. `core register`가 유효한 로컬 Core만 등록하고, 이동·누락·잘못된 형식을 안전하게 진단한다.
3. `init --core`가 Core 규칙과 프로젝트 확장 규칙을 최종 `AGENTS.md`에 렌더링한다.
4. 반복 `sync`가 manifest가 가리키는 Core를 사용하고 프로젝트 규칙을 보존한다.
5. 기본 Core 변경이 이미 초기화된 프로젝트의 Core를 암묵적으로 바꾸지 않는다.
6. `sync --core`가 사전 diff와 명시적 전환 없이 Core를 바꾸지 않는다.
7. 조직 Git Core의 revision·콘텐츠 해시가 manifest에 기록되고, `doctor`가 불일치를 비밀값 없이 보고한다.
8. 기존 프로젝트의 `check`·테스트 설정·비즈니스 코드를 보존한다.
9. 전역 패키지 업데이트만으로는 개인·조직 Core, 레지스트리, 대상 프로젝트가 변경되지 않는다.
10. `core update --dry-run`은 기준본·현재 개인 Core·새 기본 규칙의 diff와 충돌을 보고하되 파일이나 manifest를 수정하지 않는다.
11. 충돌 없는 `core update --apply`는 사용자 수정 영역을 보존하고, 충돌이 있으면 어떤 Core 파일도 부분 수정하지 않는다.
12. 에이전트가 제안한 업데이트는 명시적 사용자 승인 전에는 apply·조직 Git 변경·대상 프로젝트 sync를 수행하지 않는다.
13. 적용이 승인된 뒤에는 영향받는 프로젝트를 명시적으로 sync하고, 각 프로젝트의 네이티브 검증 명령을 실행한다.

채택 시 장기적인 Core 소유권·전환·마이그레이션 결정은 ADR로 기록하고, 실제 구조는 `docs/architecture/`, 사용자 흐름은 `docs/workflow.md`에 승격한다.
