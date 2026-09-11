# 공식 문서와 설계 채택 근거

확인일: 2026-09-12. 검색 결과의 문구만 사용하지 않고 아래 공식 페이지를 직접 열어 내용을 확인했다. 날짜는 게시일이 확인되는 글에만 적었다. 제품 문서는 수시 변경되므로 설치/구현 시 CLI 버전과 다시 대조한다.

이 설계의 디렉터리 이름, CLI 계약, 상태 스키마, 테스트 행렬, 예산·보존 기간은 **범용 설계 제안이며 프로젝트별 Adapter에서 구체화할 값**이다. 모든 문서가 하나의 표준 환경을 권고한다고 주장하지 않는다. 특히 특정 조직의 장기 에이전트 실험을 보편적 성능 보장으로 해석하지 않았다.

## 우선 읽을 문서

| 순서 | 문서 | 핵심과 이번 적용 |
|---|---|---|
| 1 | [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) | 에이전트가 직접 검사할 수 있는 피드백을 제공한다. 프로젝트 유형에 맞는 로컬 검사 우선 |
| 2 | [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) · 2025-11-26 | 점진적 작업과 다음 세션에 넘길 구조화된 산출물. task/checkpoint/evidence 설계 |
| 3 | [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) · 2026-03-24 | 생성과 평가 분리 및 Harness 복잡도 재검토. 선택적 독립 리뷰와 평가 기반 단순화 |
| 4 | [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) · 2026-01-09 | 평가집·실제 관측·사람 검토를 결합. 제품 테스트와 Harness eval 구분 |
| 5 | [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) | 지침 발견 순서와 범위. 짧은 진입 지침과 상세 정본 연결 |

## 주제별 참고 자료

### 컨텍스트와 도구 구성

- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) · 2025-09-29: 필요한 정보를 선별하고 긴 작업의 상태를 유지한다. 프로젝트별 파일 인덱스/요약을 우선 채택하고 전체 이력을 상시 주입하지 않는다.
- [Build skills — OpenAI](https://learn.chatgpt.com/docs/build-skills): 작업별 지침·자원·스크립트를 Skills로 묶고 필요할 때 로드한다. 실제 파일 로딩/설정은 provider마다 검증한다.
- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) · 2024-12-19: 단순한 구성부터 출발하고 필요한 복잡도만 추가한다. 상시 멀티에이전트나 자체 프레임워크를 초기 필수로 두지 않는다.

### 권한·격리·CI

- [Agent approvals & security — OpenAI](https://learn.chatgpt.com/docs/agent-approvals-security): 승인과 sandbox의 역할, 네트워크·권한 설정을 확인한다. 본 설계의 공통 정책 JSON이 자동 집행된다고 가정하지 않는다.
- [MCP Security Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices): 토큰 audience, 잘못된 토큰 전달과 confused deputy 등 도구 연결의 경계를 다룬다. 프로젝트별 인증/도구 범위를 명시한다.
- [Secure use reference — GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use): 최소 권한, 비신뢰 코드와 secret의 분리, action 고정. CI에 개인 Core 전체 권한을 넘기지 않는 운영으로 연결한다.

### 작업 공간과 검증

- [git-worktree](https://git-scm.com/docs/git-worktree): 동일 저장소에서 여러 작업 트리를 관리하는 공식 명령. 독립 작업 공간으로 사용하되 보안 격리로 취급하지 않는다.
- [Playwright Best Practices](https://playwright.dev/docs/best-practices): 사용자에게 보이는 동작·테스트 격리·안정적인 locator. 웹 프로젝트의 합성 DOM 테스트와 별도 실환경 계약 검사를 구분한다.

### 소유권 논의의 제한된 참고

- [법제처 찾기쉬운 생활법령 — 저작자](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=1&cciNo=1&cnpClsNo=2&csmSeq=695): 업무상저작물과 계약 등 요건을 확인하기 위한 공식 안내. 개인 시간·Git 위치만으로 소유권을 확정하는 결론을 피한다.

첨부 대화에 계약서·원래 발주 범위·실제 판결번호가 없으므로 프리랜서의 구체적 권리 귀속은 판정하지 않았다. 권리 경계 문서는 법률 결론 대신 자산·사용 허락·개선물 처리의 확인 상태를 기록한다.

## 채택·유보 결정

| 방법 | 결정 | 이유 |
|---|---|---|
| Core/Adapter 분리 | 즉시 채택 | 재사용과 프로젝트 경계 설명에 유용 |
| 실행 기록 분리 | 즉시 채택 | 소스 외 데이터의 누출/혼입을 막는 데 필요 |
| 단일 agent + 실제 검증 | 즉시 채택 | 각 프로젝트의 테스트 공백부터 해소 |
| 짧은 지침 + 필요한 문서 읽기 | 즉시 채택 | 긴 과거 문서의 충돌을 줄임 |
| 독립 리뷰 | 복잡한 작업부터 | 자기평가 편향 보완; 항상 여러 모델을 호출하지 않음 |
| worktree 병렬화 | 단일 루프 안정화 후 | 공유 파일의 동시 수정·통합 충돌을 확인한 뒤 확장 |
| SQLite 상태 저장 | 동시 writer 필요 시 | 초기 파일 기반 단일 writer로 충분한지 먼저 검증 |
| 중앙 벡터 DB·전역 메모리 | 유보 | 작은 저장소에서 비용/기밀 혼입 복잡도를 정당화할 근거 없음 |
| 자체 agent 추론 엔진 | 유보 | 기존 런타임 활용으로 검증/경계에 집중 |
| 무제한 재시도·자가 정책 수정 | 미채택 | 비용과 완료 판정이 통제되지 않음 |
| agent의 회사 코드 자동 Core 승격 | 미채택 | 범용성과 반출/재사용 권리는 다른 문제 |

## 최신성의 범위

2026-03-24의 Harness 설계 사례와 열람 시점의 공식 제품 문서, MCP의 2026-07-28 버전 문서를 포함했다. ‘가장 최신인 모든 연구를 빠짐없이 조사했다’는 의미는 아니다. 실험 결과는 해당 모델/환경에 종속될 수 있어 구현 시 capability 진단과 자체 eval을 필수로 두었다.

OpenAI Docs 스킬은 Codex 기능을 공식 문서에서 확인하고, 실제 로딩/권한과 자체 설계 규약을 구분하는 데 사용했다. 다른 제공사의 설계 근거는 각 제공사의 공식 원문에서 따로 확인했다.
