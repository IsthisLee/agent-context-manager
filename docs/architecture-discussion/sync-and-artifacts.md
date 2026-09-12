# Sync and Artifact Contracts

**상태:** Proposed expansion

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
