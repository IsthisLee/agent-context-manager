# Verification Contract

**상태:** Proposed expansion

현재 `check.mjs`는 기본 `npm test`를 실행하고 종료 코드·성공 여부·실행 시간을 기록한다. 목표는 프로젝트별 검증 명령과 증거 형식을 명확히 하는 것이다.

현재 `init`은 테스트 스크립트와 알려진 테스트 파일이 모두 없는 Node 프로젝트에만 `node --test` 기반 스모크 테스트를 추가한다. 이 파일은 검증 파이프라인의 부트스트랩이며, 테스트 수 계약이나 제품 동작 검증을 대체하지 않는다.

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
* 완료 판정은 프로젝트가 정의한 검증 명령의 성공 종료와 증거 파일 생성을 요구한다.

실패 시에는 재실행 가능한 명령과 실패 원인을 artifact에 남긴다. 이 계약을 구현할 때 추가·수정한 eval과 `npm run check` 증거를 구현 기록에 연결한다.
