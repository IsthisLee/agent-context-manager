# Verification Contract

**상태:** Proposed

## 제안 요약

### 핵심 정보

| 항목 | 내용 |
| --- | --- |
| 대상 계층 | Agentic 패키지의 생성 도구·CLI, 대상 프로젝트의 `package.json`·검증 명령, AI 에이전트 완료 보고 |
| 제안 목표 | 대상 프로젝트의 실제 검증 게이트를 보존하면서 완료 결과와 증거의 범위를 명확하고 기계 판독 가능하게 만든다. |
| 제안 이유 | 기존 `check`를 안전하게 보존하는 경우 Agentic 증거가 남지 않을 수 있어, 검증 실행과 증거 기록의 관계가 불명확하다. |
| 결정할 것 | 기존 검증 연결 방식·증거 schema·성공·실패·경고 기준·미연결 진단·Verifier 완료 조건 |
| 중요도 | Critical — 실제 프로젝트 게이트를 우회하지 않고 검증 증거의 범위를 명확히 해야 함 |

### 제안 관계

| 항목 | 내용 |
| --- | --- |
| 선행 작업 | 없음; 기존 `check` 스크립트 보존 계약을 유지 |
| 선행 제안 | 없음 — 기존 검증 보존 경계 위에서 독립적으로 확정 가능 |
| 후속 제안 | [Sync and Artifact Contracts](sync-and-artifacts.md), [Operations and Release Contracts](operations-and-release.md) |
| 연관 제안 | [Adaptive Harness](adaptive-harness.md), [Core Management and Application](core-management-and-application.md), [Ecosystem Comparison Follow-ups](ecosystem-follow-ups.md) |

### 추진 계획

| 항목 | 내용 |
| --- | --- |
| 후속 작업 | `doctor` 증거 진단, manifest·`sync --check`, Verifier 역할 계약 |
| 권장 다음 작업 | 기존 `npm run check`를 보존하면서 증거를 연결하는 opt-in 방식과 실패 모드를 eval로 비교 |

## 목차

1. 현재 검증과 콜드 스타트 경계
2. 기존 `check` 스크립트의 증거 경로 공백
3. 증거 형식과 완료 조건
4. 구현 전 검증 기준

현재 `check.mjs`는 기본 `npm test`를 실행하고 종료 코드·성공 여부·실행 시간을 기록한다. 목표는 프로젝트별 검증 명령과 증거 형식을 명확히 하는 것이다.

현재 `init`은 테스트 스크립트와 알려진 테스트 파일이 모두 없는 Node 프로젝트에만 `node --test` 기반 스모크 테스트를 추가한다. 이 파일은 검증 파이프라인의 부트스트랩이며, 테스트 수 계약이나 제품 동작 검증을 대체하지 않는다.

## 확인된 공백: 기존 `check` 스크립트의 증거 경로

`init`은 대상 프로젝트에 이미 `npm run check`가 있으면 이를 보존한다. 안전한 기본값이지만, 그 스크립트가 `tools/agentic/check.mjs`를 호출하지 않으면 `.agentic/last-check.json`은 생성되지 않는다. 따라서 현재 자동 증거 기록은 생성된 실행기를 직접 호출하거나, `check` 스크립트가 생성된 실행기로 등록된 프로젝트에서만 보장된다.

해결안은 기존 스크립트를 덮어쓰지 않는 경계를 지키면서, 사용자가 기존 검증 명령을 Agentic 실행기에 연결할 수 있는 명시적 방법을 제공해야 한다. 후보는 별도 `agentic:check` 스크립트, 명시적 설정 파일, 또는 opt-in 래핑이며, 채택 전에는 다음을 eval로 고정한다.

* 기존 `check` 스크립트와 검증 순서를 보존한다.
* 연결된 모든 경로에서 명령·종료 코드·소요 시간·성공 여부를 기록한다.
* 연결되지 않은 경로는 증거가 없다는 사실을 진단으로 명확히 알린다.
* 동기화가 사용자의 `package.json` 스크립트나 프로젝트별 검증 구성을 암묵적으로 덮어쓰지 않는다.

```json
{
  "schemaVersion": 1,
  "command": "npm test",
  "exitCode": 0,
  "success": true,
  "durationMs": 642,
  "testCount": null,
  "testCountSource": "unknown",
  "timestamp": "2026-09-12T00:00:00.000Z"
}
```

* 실제 실행 명령, 종료 코드, 성공 여부, 실행 시간을 모든 프로젝트에서 기록한다.
* 테스트 수를 신뢰성 있게 제공하는 러너만 `testCount`와 출처를 기록한다.
* 범용 stdout 정규식으로 테스트 수를 추정하지 않는다.
* 테스트 0개 실패 정책은 테스트 수를 신뢰성 있게 확인할 수 있는 프로젝트에만 강제한다.
* 완료 판정은 프로젝트가 정의한 검증 명령의 성공 종료와 증거 파일 생성을 요구한다. 기존 `check` 스크립트의 증거 연결은 위 공백을 해결한 뒤 일관되게 강제한다.

## 구현 전 검증 기준

* 기존 `check`를 덮어쓰지 않고, 연결하지 않은 프로젝트는 명확한 진단만 받는다.
* 연결된 경로의 명령·종료 코드·실행 시간·성공 여부는 결정론적으로 기록한다.
* stdout 형식 추측이나 에이전트 런타임 래퍼를 도입하지 않는다.
* 구현 후에는 대상 프로젝트의 네이티브 `npm run check`가 여전히 기본 완료 게이트인지 eval로 확인한다.

실패 시에는 재실행 가능한 명령과 실패 원인을 artifact에 남긴다. 이 계약을 구현할 때 추가·수정한 eval과 `npm run check` 증거를 구현 기록에 연결한다.
