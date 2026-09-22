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

| 상황                                    | 가이드                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| 명령 대신 메뉴로 쓰기                   | [TUI로 쓰기](guides/tui.md)                                                   |
| 에이전트에게 맡기기                     | [에이전트에게 agctx를 맡기기](guides/agent-skills.md)                         |
| 성격이 다른 저장소 여럿, 컴퓨터 여러 대 | [성격이 다른 저장소 여럿에 프로필 나눠 쓰기](guides/multi-repo-individual.md) |
| 고객사가 여럿                           | [고객사 여러 곳의 규칙 따로 쓰기](guides/multi-client.md)                     |
| 팀 프로필 공유                          | [팀과 Git으로 공유하기](guides/team-sharing.md)                               |
| 이미 있는 규칙 저장소를 프로필로 받기   | [기존 저장소를 프로필로 쓰기](guides/team-sharing.md#기존-저장소를-프로필로-쓰기) |
| 모노레포                                | [모노레포에서 쓰기](guides/monorepo.md)                                       |
| 고정 여부와 예약 봇                     | [갱신 방식 고르기: 고정과 예약 봇](guides/update-policies.md)                 |
| CI와 스크립트                           | [CI와 자동화에서 쓰기](guides/ci.md)                                          |
| Microsoft APM과 함께                    | [APM과 함께 쓰기](guides/apm-coexistence.md)                                  |

### 개념

- [agctx를 쓰는 이유와 책임 경계](concepts/why-agctx.md)
- [프로필과 적용](concepts/profiles.md)
- [관리 영역과 확장 영역](concepts/managed-and-extension-areas.md)
- [에이전트가 읽는 지침 파일](concepts/agent-loading.md)
- [전달 확인과 검증의 범위](concepts/verification.md)

### 레퍼런스

- [CLI Reference](reference/cli.md)
- [지침 카탈로그](reference/guidance-catalog.md): `profile setup`의 열 개 항목이 넣는 문장과 그 근거
- [종료 코드](reference/exit-codes.md)
- [파일 형식과 저장 위치](reference/file-formats.md)
- [지원 에이전트](reference/supported-agents.md)
- [문제 해결](reference/troubleshooting.md)
- [자주 묻는 질문](faq.md)

## 기여자 문서

- [제품 방향](contributing/product-direction.md): 목표·범위·용어·단계별 완료 기준
- [현재 아키텍처](contributing/architecture.md): 현재 구현된 구조와 소유권
  - [기능 구현 메커니즘](contributing/implementation-mechanics.md): 기능마다 어느 파일의 어느 이름에 구현됐고 왜 그런지 가리키는 안내도
- [구현 원리](contributing/implementation-principles.md): npm·Node.js·CLI 원리와 구현의 연결
- [테스트와 품질 게이트](contributing/testing.md)
- [릴리스와 저장소 운영](contributing/releasing.md)
- [문서 게이트](contributing/doc-gate.md)
- [문서 작성 형식](contributing/doc-style.md)
- [새 에이전트 지원하기](contributing/adapters.md)
- [아키텍처 구현 계획](discussion/architecture/): 단계별 계약과 미구현 기능
- [저장소 운영 논의](discussion/repository/): 문서 게이트·CI·PR 리뷰처럼 저장소 자체의 운영 주제
- [외부 참고 문헌](references.md): 연구·사례·비교 도구

## 문서별 책임

각 문서가 무엇의 정본인지 정리한 표다. 새 내용을 어느 문서에 둘지 판정하는 기준은 루트 [`AGENTS.md`](../AGENTS.md)의 문서 배치 표에 있다.

| 문서                                             | 책임                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                      | 외부 사용자를 위한 한 페이지 패키지 소개: 핵심 문제·기능·구조·빠른 시작·문서 링크                                                     |
| `docs/README.md`                                 | 문서 입구: 사용 흐름 요약, 사용자·기여자 문서 목차, ADR 색인                                                                          |
| `docs/getting-started/`                          | 설치와 첫 적용·확인까지의 최소 흐름                                                                                                   |
| `docs/guides/`                                   | 상황별 사용 절차: 여러 저장소·고객사·팀 공유·모노레포·갱신 방식·CI·스킬·APM                                                           |
| `docs/concepts/`                                 | 동작 원리와 이유: 책임 경계·프로필·관리 영역·에이전트 로드·전달 확인                                                                  |
| `docs/reference/`                                | CLI 명령·옵션·종료 코드·파일 형식·지원 에이전트·배포 지침 목록·문제 해결의 정확한 사양                                                |
| `docs/faq.md`                                    | 자주 묻는 질문의 짧은 답과 정본 링크                                                                                                  |
| `docs/contributing/product-direction.md`         | 패키지의 목적, 책임 경계, 장기 방향의 정본                                                                                            |
| `docs/contributing/architecture.md`              | 현재 채택되어 실제로 동작하는 구조와 소유권. 기능별 구현 위치 안내는 `implementation-mechanics.md`, 배포 지침 목록은 `docs/reference/guidance-catalog.md` |
| `docs/contributing/implementation-principles.md` | npm·Node.js·CLI 일반 원리와 이 패키지 구현의 연결 해설                                                                                |
| `docs/contributing/testing.md`                   | 품질 게이트와 평가 작성 방법                                                                                                          |
| `docs/contributing/releasing.md`                 | 공개 저장소 릴리스·보안·기여 운영 계약                                                                                                |
| `docs/contributing/doc-gate.md`                  | 문서 소스 해시 게이트와 문서 근거 게이트                                                                                              |
| `docs/contributing/doc-style.md`                 | 문서의 그림·예시 형식과 작성 규칙                                                                                                     |
| `docs/contributing/adapters.md`                  | 새 에이전트를 지원하는 절차                                                                                                           |
| `docs/discussion/architecture/`                  | 패키지 기능의 구현 단계별 논의와 계약: 아직 채택되지 않았거나 구현·검증 중인 주제                                                     |
| `docs/discussion/repository/`                    | 저장소 운영(문서 게이트·CI·PR 리뷰·기여 절차)의 논의와 계약                                                                           |
| `docs/discussion/topics.json`                    | 논의 주제의 상태·중요도·선행 단계·핵심 결과의 정본. 주제 문서의 상태 줄, 색인 표, README 상태 목록은 여기서 생성                      |
| `docs/adr/`                                      | 되돌리기 어렵거나 장기 영향을 주는 결정의 이력                                                                                        |
| `docs/references.md`                             | 외부 근거와 참고 자료                                                                                                                 |
| `CHANGELOG.md`                                   | 사용자 영향 변경과 릴리스 버전 이력                                                                                                   |

## 결정 기록

- [결정 기록](adr/): 확정된 장기 결정
  - [ADR 0001: 제품 범위](adr/0001-product-scope.md) (일부 대체: ADR 0019, ADR 0021)
  - [ADR 0002: 로케일(ko/en) 국제화](adr/0002-locale-i18n.md) (일부 대체: ADR 0014)
  - [ADR 0003: Core를 Guidance Profile로 개명하고 apply/sync 분리](adr/0003-rename-core-to-guidance-profile.md) (일부 대체: ADR 0013)
  - [ADR 0004: Antigravity 규칙 파일을 `.agents/rules/`로 생성](adr/0004-antigravity-rules-path.md) (일부 정정: ADR 0009, 일부 대체: ADR 0013)
  - [ADR 0005: 지침 적용 수준의 뜻을 정의로 노출](adr/0005-guidance-level-semantics.md) (대체: ADR 0028)
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
  - [ADR 0019: 에이전트가 지침을 받는지 설명·검증하고 에이전트용 스킬을 배포](adr/0019-explain-verify-and-agent-skills.md) (일부 정정: ADR 0035, ADR 0038)
  - [ADR 0020: APM이 다시 만드는 파일에는 쓰지 않고, 하위 AGENTS.md마다 Claude Code 연결 파일을 만듦](adr/0020-apm-coexistence-and-monorepo-links.md)
  - [ADR 0021: 프로필이 담을 대상을 규칙·스킬·MCP·subagents로 정함](adr/0021-profile-scope-skills-mcp-subagents.md) (일부 대체: ADR 0022, ADR 0027)
  - [ADR 0022: 프로필이 담을 대상에 hooks를 더함](adr/0022-profile-scope-hooks.md)
  - [ADR 0023: 기존 저장소에서 프로필을 만들 때 초안은 사용자의 에이전트가 agctx 스킬 안내로 만듦](adr/0023-profile-drafting-through-agent-skill.md)
  - [ADR 0024: 기본 지침 문장은 공식 문서·표준 근거가 있어야 하고 분량 예산 안에 머묾](adr/0024-guidance-evidence-and-budget.md)
  - [ADR 0025: 모든 명령은 CLI와 TUI에서 실행할 수 있어야 함](adr/0025-every-command-in-cli-and-tui.md) (확장: ADR 0029)
  - [ADR 0026: 지침 항목을 열 개로 나누고 근거 등급을 세 단계로 넓힘](adr/0026-guidance-items-and-evidence-tiers.md)
  - [ADR 0027: 출력 스타일은 프로필이 담지 않음](adr/0027-no-output-styles.md)
  - [ADR 0028: 지침 항목은 켜고 끄는 두 값만 받음](adr/0028-guidance-on-off.md)
  - [ADR 0029: 에이전트를 CLI·TUI와 같은 계약 아래 둠](adr/0029-agent-surface-contract.md)
  - [ADR 0030: 에이전트용 스킬은 한국어로 씀](adr/0030-korean-skills.md)
  - [ADR 0031: 공개 운영 파일을 줄이고 라이선스를 MIT로 바꿈](adr/0031-drop-open-source-process-files.md)
  - [ADR 0032: 문서는 코드를 파일과 이름으로 가리킴](adr/0032-cite-code-by-name.md)
  - [ADR 0033: 인용한 코드의 지문으로 변경을 검출](adr/0033-fingerprint-cited-code.md)
  - [ADR 0034: AGENTS.md의 관리 영역 경계를 마커로 표시](adr/0034-managed-end-marker-in-agents-md.md)
  - [ADR 0035: Claude Code가 AGENTS.md를 직접 읽는 조건을 explain 판정에 반영](adr/0035-claude-code-reads-agents-md.md)
  - [ADR 0036: profile.json이 프로필의 규칙 파일을 가리킨다](adr/0036-profile-json-names-rules-file.md)
  - [ADR 0037: 이미 있는 규칙 저장소 폴더를 포인터로 보관함에 잇는다](adr/0037-link-existing-folder-as-profile.md)
  - [ADR 0038: 에이전트 스킬을 CLI 패키지에 넣고 agctx install로 설치](adr/0038-install-agent-skills-from-cli-package.md)
  - [ADR 0039: 코드·JSON·YAML의 서식을 Prettier로 맞추고 Markdown은 뺀다](adr/0039-format-code-with-prettier.md)
  - [ADR 0040: ESLint로 린트하고, typescript-eslint에는 TypeScript 6 호환 패키지를 준다](adr/0040-lint-with-eslint-and-typescript6-compat.md)
  - [ADR 0041: 프로젝트 `AGENTS.md`가 200줄을 넘거나 24 KiB 이상이면 적용할 때 경고만 한다](adr/0041-warn-on-long-project-agents-md.md)
  - [ADR 0042: 저장소마다 파일을 받을 에이전트를 골라 `agctx.project.json`에 기록한다](adr/0042-choose-agents-per-repository.md)
  - [ADR 0043: agctx 표지가 없는 기존 파일은 `--adopt` 없이 쓰지 않는다](adr/0043-stop-on-unmanaged-files.md)

저장소 공개 운영 파일: [`SECURITY.md`](../SECURITY.md) · [PR 템플릿](../.github/PULL_REQUEST_TEMPLATE.md)

문서 변경 시 루트 [`AGENTS.md`](../AGENTS.md)와 [`구현 계약`](discussion/architecture/topics/implementation-contracts.md)의 규칙을 따른다. 논의 문서의 계약을 구현하면 같은 변경에서 그 문서에 [구현 기록](discussion/architecture/topics/implementation-contracts.md#구현-기록)을 남긴다.
