# Agent Context Manager 문서

## 사용 흐름

1. **설치와 첫 적용**: [빠른 시작](getting-started/quick-start.md)(설치 → `profile create` → `profile setup` → `profile apply` → `check`). 명령 대신 메뉴로 하려면 [TUI로 쓰기](guides/tui.md)
2. **개발**: 평소 쓰는 에이전트에 작업을 맡긴다. 에이전트가 읽는 파일은 [에이전트가 읽는 지침 파일](concepts/agent-loading.md)에 있다
3. **갱신**: 프로필을 고친 뒤 `profile sync` 또는 `repos sync`, 고정한 저장소는 `repos pr`([갱신 방식 고르기](guides/update-policies.md))
4. **팀 공유와 CI**: `profile connect`·`push`·`clone`·`pull`([팀과 Git으로 공유하기](guides/team-sharing.md)), CI의 `check`([CI와 자동화에서 쓰기](guides/ci.md))
5. **전달 확인과 스킬**: `explain`·`verify`([전달 확인과 검증의 범위](concepts/verification.md)), 에이전트용 스킬([에이전트에게 agctx를 맡기기](guides/agent-skills.md))
6. **문제가 생기면**: [문제 해결](reference/troubleshooting.md)

## 사용자 문서

### 처음 시작

- [빠른 시작](getting-started/quick-start.md)

### 목적별 가이드

| 상황 | 가이드 |
| --- | --- |
| 명령 대신 메뉴로 쓰기 | [TUI로 쓰기](guides/tui.md) |
| 성격이 다른 저장소 여럿, 컴퓨터 여러 대 | [성격이 다른 저장소 여럿에 프로필 나눠 쓰기](guides/multi-repo-individual.md) |
| 고객사가 여럿 | [고객사 여러 곳의 규칙 따로 쓰기](guides/multi-client.md) |
| 팀 프로필 공유 | [팀과 Git으로 공유하기](guides/team-sharing.md) |
| 모노레포 | [모노레포에서 쓰기](guides/monorepo.md) |
| 고정 여부와 예약 봇 | [갱신 방식 고르기: 고정과 예약 봇](guides/update-policies.md) |
| CI와 스크립트 | [CI와 자동화에서 쓰기](guides/ci.md) |
| 에이전트에게 맡기기 | [에이전트에게 agctx를 맡기기](guides/agent-skills.md) |
| Microsoft APM과 함께 | [APM과 함께 쓰기](guides/apm-coexistence.md) |

### 개념

- [agctx를 쓰는 이유와 책임 경계](concepts/why-agctx.md)
- [프로필과 적용](concepts/profiles.md)
- [관리 영역과 확장 영역](concepts/managed-and-extension-areas.md)
- [에이전트가 읽는 지침 파일](concepts/agent-loading.md)
- [전달 확인과 검증의 범위](concepts/verification.md)

### 레퍼런스

- [CLI Reference](reference/cli.md)
- [종료 코드](reference/exit-codes.md)
- [파일 형식과 저장 위치](reference/file-formats.md)
- [지원 에이전트](reference/supported-agents.md)
- [문제 해결](reference/troubleshooting.md)
- [자주 묻는 질문](faq.md)

## 기여자 문서

- [제품 방향](contributing/product-direction.md): 목표·범위·용어·단계별 완료 기준
- [현재 아키텍처](contributing/architecture.md): 현재 구현된 구조와 소유권
  - [기능 구현 메커니즘](contributing/implementation-mechanics.md): 각 기능의 내부 코드 로직
  - [지침 카탈로그](contributing/guidance-catalog.md): 프로필에 배포되는 공통 지침 6개
- [구현 원리](contributing/implementation-principles.md): npm·Node.js·CLI 원리와 구현의 연결
- [테스트와 품질 게이트](contributing/testing.md)
- [릴리스와 저장소 운영](contributing/releasing.md)
- [문서 게이트](contributing/doc-gate.md)
- [새 에이전트 지원하기](contributing/adapters.md)
- [아키텍처 구현 계획](discussion/architecture/): 단계별 계약과 미구현 기능
- [외부 참고 문헌](references.md): 연구·사례·비교 도구

## 결정 기록

- [결정 기록](adr/): 확정된 장기 결정
    - [ADR 0001: 제품 범위](adr/0001-product-scope.md) (일부 대체: ADR 0019, ADR 0021)
    - [ADR 0002: 로케일(ko/en) 국제화](adr/0002-locale-i18n.md) (일부 대체: ADR 0014)
    - [ADR 0003: Core를 Guidance Profile로 개명하고 apply/sync 분리](adr/0003-rename-core-to-guidance-profile.md) (일부 대체: ADR 0013)
    - [ADR 0004: Antigravity 규칙 파일을 `.agents/rules/`로 생성](adr/0004-antigravity-rules-path.md) (일부 정정: ADR 0009, 일부 대체: ADR 0013)
    - [ADR 0005: 지침 적용 수준의 뜻을 정의로 노출](adr/0005-guidance-level-semantics.md)
    - [ADR 0006: 코드베이스 분석 기반 지침 생성을 구현하지 않음](adr/0006-no-codebase-analysis-guidance.md)
    - [ADR 0007: 프로필 저장소를 `~/.agentic/` 아래로 모음](adr/0007-profile-home-layout.md) (일부 대체: ADR 0013)
    - [ADR 0008: 관리 영역 충돌을 보여 주고 마지막 적용본으로 복구](adr/0008-managed-conflict-recovery.md) (일부 대체: ADR 0010, ADR 0016)
    - [ADR 0009: 에이전트 규칙 파일의 frontmatter를 파일 맨 앞에 두고 Antigravity 규칙을 항상 적용](adr/0009-agent-rule-frontmatter.md) (일부 대체: ADR 0011)
    - [ADR 0010: resolve --edit은 merge 결과에서 관리 영역 밖만 적용](adr/0010-edit-merge-regenerates-managed-area.md)
    - [ADR 0011: 지원 에이전트를 Codex·Claude Code·Antigravity로 좁힘](adr/0011-supported-agents.md)
    - [ADR 0012: 소스를 TypeScript로 쓰고 컴파일한 JavaScript로 배포](adr/0012-typescript-source.md)
    - [ADR 0013: 이름을 Agent Context Manager(agctx)로 바꾸고 호환 계층을 두지 않음](adr/0013-rename-agent-context-manager.md)
    - [ADR 0014: 패키지 기본 로케일을 영어로 바꿈](adr/0014-default-locale-english.md)
    - [ADR 0015: 지원 Node.js 하한을 22로 낮춤](adr/0015-node-22-support.md)
    - [ADR 0016: 명령 등록부와 종료 코드·JSON 출력·변경 확인 계약](adr/0016-command-contract.md) (일부 대체: ADR 0025)
    - [ADR 0017: 프로필을 Git 원격으로 공유하고 적용한 버전을 기록](adr/0017-git-profile-sharing.md)
    - [ADR 0018: 적용한 저장소를 목록으로 관리하고 동기화·PR을 한 번에 확인한 뒤 실행](adr/0018-multi-repository-sync.md) (일부 대체: ADR 0025)
    - [ADR 0019: 에이전트가 지침을 받는지 설명·검증하고 에이전트용 스킬을 배포](adr/0019-explain-verify-and-agent-skills.md)
    - [ADR 0020: APM이 다시 만드는 파일에는 쓰지 않고, 하위 AGENTS.md마다 Claude Code 연결 파일을 만듦](adr/0020-apm-coexistence-and-monorepo-links.md)
    - [ADR 0021: 프로필이 담을 대상을 규칙·스킬·MCP·subagents로 정함](adr/0021-profile-scope-skills-mcp-subagents.md)
    - [ADR 0022: 프로필이 담을 대상에 hooks를 더함](adr/0022-profile-scope-hooks.md)
    - [ADR 0023: 기존 저장소에서 프로필을 만들 때 초안은 사용자의 에이전트가 agctx 스킬 안내로 만듦](adr/0023-profile-drafting-through-agent-skill.md)
    - [ADR 0024: 기본 지침 문장은 공식 문서·표준 근거가 있어야 하고 분량 예산 안에 머묾](adr/0024-guidance-evidence-and-budget.md)
    - [ADR 0025: 모든 명령은 CLI와 TUI에서 실행할 수 있어야 함](adr/0025-every-command-in-cli-and-tui.md)

저장소 공개 운영 파일: [`CONTRIBUTING.md`](../CONTRIBUTING.md) · [`SECURITY.md`](../SECURITY.md) · [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) · [이슈 템플릿](../.github/ISSUE_TEMPLATE/)

문서 변경 시 루트 [`AGENTS.md`](../AGENTS.md)와 [`구현 계약`](discussion/architecture/topics/implementation-contracts.md)의 규칙을 따른다. 논의 문서의 계약을 구현하면 같은 변경에서 그 문서에 [구현 기록](discussion/architecture/topics/implementation-contracts.md#구현-기록)을 남긴다.
