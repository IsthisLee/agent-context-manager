# Sync and Artifact Contracts

**상태:** Proposed

## 제안 요약

### 핵심 정보

| 항목 | 내용 |
| --- | --- |
| 대상 계층 | Agentic 패키지 CLI·템플릿, 대상 프로젝트의 생성 파일·`.agentic/` artifact |
| 제안 목표 | 생성 파일의 변경을 투명하고 되돌릴 수 있게 동기화하며, 필요한 작업에만 재사용 가능한 실행 artifact를 남긴다. |
| 제안 이유 | 현재 동기화에는 manifest·사전 diff·검사 계약이 없고, 역할 분업 시 필요한 handoff 증거의 형식도 정해져 있지 않다. |
| 결정할 것 | manifest schema·관리 파일 경계·dry-run 무변경 보장·롤백 방식·artifact 보존·handoff 완료 조건 |
| 중요도 | High — 안전한 동기화·롤백과 선택적 handoff의 기반 계약 |

### 제안 관계

| 항목 | 내용 |
| --- | --- |
| 선행 작업 | 현재 `AGENTS.md` 확장 영역 보존 계약과 Git diff 검토 흐름 유지 |
| 선행 제안 | [Verification Contract](verification.md) — 검증 증거·완료 조건과 manifest의 연결 기준 확정 |
| 후속 제안 | [Core Management and Application](core-management-and-application.md), [Operations and Release Contracts](operations-and-release.md) |
| 연관 제안 | [Adaptive Harness](adaptive-harness.md), [Ecosystem Comparison Follow-ups](ecosystem-follow-ups.md) |

### 추진 계획

| 항목 | 내용 |
| --- | --- |
| 후속 작업 | manifest, `sync --dry-run`, `sync --check`, 사용자·조직 규칙 프로필, 역할별 artifact |
| 권장 다음 작업 | 생성 파일 manifest와 dry-run의 파일 변경 없음 계약을 eval로 먼저 고정 |

## 목차

1. 선택적 작업 artifact
2. sync·버전·롤백 계약
3. 가상 팀 완료 조건
4. 구현 순서와 검증

## Artifact

역할 분업이 필요할 때만 실행 단위별 artifact를 만든다.

```text
.agentic/runs/<run-id>/
├── manifest.json
├── profile.json
├── plan.md
├── review.md
└── last-check.json
```

`manifest.json`에는 `schemaVersion`, `runId`, `task`, `mode`, `roles`, `createdAt`, artifact 상태를 기록한다. 기본 `SOLO` 작업에는 `plan.md`와 `review.md`를 강제하지 않는다.

`.agentic/runs/`는 비밀 가능 실행 artifact이므로 Git에 커밋하지 않는다. 장기 보존할 계획이나 결정은 검토 후 `docs/` 또는 ADR로 승격한다.

## Sync, version, rollback

| 대상 | `sync` 동작 |
|---|---|
| `AGENTS.md` 공통 템플릿 영역 | 최신 템플릿으로 갱신 |
| `AGENTS.md` 프로젝트 규칙 확장 영역 | 보존 |
| 에이전트 포인터 파일 | 최신 템플릿으로 재생성 |
| `tools/agentic/` | 최신 검증 도구로 갱신 |
| `.agentic/runs/` | 갱신 대상 아님 |

생성 결과에는 Core·템플릿 버전을 기록하는 manifest를 추가한다. 동기화 전후는 Git diff로 검토할 수 있어야 하며, 이전 Core 버전으로 다시 `sync`하거나 Git으로 생성 파일 변경을 되돌려 롤백한다. 자동 Git hook은 기본값으로 사용하지 않고 필요하면 CI의 읽기 전용 `sync --check`를 사용한다.

## Virtual team completion

가상 팀은 모든 할당 작업이 완료되고, 차단 검토 이슈가 해소되며, 최종 `npm run check` 증거가 생성될 때 종료한다. Agentic은 런타임을 실행하지 않고 artifact 계약만 정의한다.

## 구현 순서와 검증

1. 생성 파일·템플릿 버전·해시를 담는 manifest schema를 정의한다.
2. `sync --dry-run`이 파일을 쓰지 않는지, `sync --check`가 CI에서 drift를 식별하는지 eval로 고정한다.
3. 그 다음에만 profile·plan·review artifact의 관리 영역과 롤백 계약을 확장한다.
4. 자동 Git hook·원격 동기화·에이전트 런타임 실행은 이 제안의 범위에 넣지 않는다.
