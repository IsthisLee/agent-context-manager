# 기능 구현 메커니즘

**문서 유형:** 안내도 (유지보수자용). 기능마다 **어느 파일의 어느 이름에 구현돼 있고, 왜 그렇게 정했으며, 무엇이 그 동작을 지키는지**를 알려 준다. 동작을 문장으로 다시 설명하지 않는다. 코드가 무엇을 하는지는 코드와 그 옆 주석이 정본이고, 왜 그렇게 하는지는 ADR이 정본이다.

npm·Node.js·CLI의 일반 원리는 [구현 원리](implementation-principles.md)에, 현재 구조·소유권의 정본은 [현재 아키텍처](architecture.md)에 있다.

## 읽는 법

- 이 문서는 코드를 복사하지 않는다. 줄 번호와 코드 발췌를 두지 않고 파일과 이름으로 가리킨다. 이유와 측정은 [문서가 코드를 인용하는 방식](../discussion/repository/topics/code-citation-style.md)에 있다.
- 이름은 편집기의 심볼 찾기나 `rg -n "export function planProject" src`처럼 찾는다.
- 각 절은 기능 하나를 맡고, 절 번호는 다른 문서가 링크로 가리키므로 바뀌지 않는다.
- 다루지 않는 것: 사용자 관점의 명령·옵션·종료 코드([CLI Reference](../reference/cli.md)), 사용 흐름([문서 입구](../README.md)), 검증의 범위와 한계([현재 아키텍처](architecture.md), [문서 게이트](doc-gate.md)).

## 모듈 지도

`src/`의 폴더는 역할별로 나뉜다. `commands/`는 명령 등록부·옵션 검사·처리기·출력·도움말, `profile/`은 프로필 명령과 Git 프로필, `project/`는 적용 엔진과 APM·모노레포 판정, `check.ts`는 저장소 검사, `explain.ts`는 에이전트별 지침 로드 판정, `verify/`는 세션 기록 판독과 probe, `repos/`는 여러 저장소 다루기, `skills/`는 에이전트 스킬 설치와 버전 알림, `i18n/`은 로케일과 메시지, `tui/`는 대화형 화면, `shared/`는 프로필 홈·안전한 쓰기·git 실행·숨은 문자 검사·종료 코드·공용 타입이다.

```mermaid
flowchart LR
  entry["src/agctx.ts<br/>진입점: run() 호출"] --> cli["commands/cli.ts<br/>로케일·명령 찾기·결과 출력"]
  cli --> registry["commands/registry.ts<br/>명령 등록부"]
  cli --> options["commands/options.ts<br/>옵션 검사·확인"]
  cli --> handlers["commands/handlers.ts<br/>명령별 처리기"]
  handlers --> tui["tui/<br/>메인·프로필 화면"]
  tui --> handlers
  handlers --> store["profile/store.ts · setup.ts<br/>프로필 저장소·지침 설정"]
  handlers --> apply["profile/apply.ts<br/>버전 결정·계획"]
  handlers --> resolve["profile/resolve.ts<br/>resolve"]
  handlers --> gitprofile["profile/git-profile.ts<br/>clone·status·pull·push·connect"]
  handlers --> link["profile/link.ts<br/>폴더를 프로필로 연결"]
  link --> store
  handlers --> check["check.ts<br/>저장소 검사"]
  handlers --> repos["repos/<br/>목록·상태·동기화·PR"]
  handlers --> explain["explain.ts<br/>에이전트별 로드 판정"]
  handlers --> verify["verify/<br/>세션 기록 판독·probe"]
  handlers --> skillsmod["skills/<br/>스킬 설치·버전 알림"]
  verify --> explain
  explain --> apply
  verify --> gitrun
  repos --> check
  repos --> apply
  check --> apply
  resolve --> apply
  apply --> plan["project/plan.ts<br/>변경 계획·충돌 수집·쓰기"]
  apply --> gitrun["shared/git.ts<br/>git 실행"]
  gitprofile --> gitrun
  apply --> hidden["shared/hidden-chars.ts<br/>숨은 문자 검사"]
  gitprofile --> hidden
  check --> hidden
  resolve --> merge["project/merge-editor.ts<br/>VS Code 3-way merge"]
  resolve --> conflicts["project/conflicts.ts<br/>편집 추출·재배치·diff·base 경로"]
  plan --> analyzer["project/analyzer.ts<br/>관리 영역 병합·hash"]
  plan --> apm["project/apm.ts<br/>APM 생성 표시 판정"]
  plan --> links["project/links.ts<br/>하위 AGENTS.md 찾기·연결 확인"]
  links --> scan["shared/scan.ts<br/>폴더 탐색"]
  explain --> scan
  plan --> conflicts
  plan --> fsutils["shared/fs-utils.ts<br/>안전한 원자적 쓰기"]
  store --> home["shared/home.ts<br/>프로필 홈·설정"]
  cli --> i18n["i18n/<br/>로케일·메시지·지침 문구"]
  conflicts --> jsdiff["diff 패키지<br/>diffLines · createTwoFilesPatch"]
```

그림에 없는 `commands/output.ts`(stdout·stderr 분리)와 `shared/errors.ts`(종료 코드와 `CliError`)는 거의 모든 모듈이 쓴다. `shared/types.ts`는 공용 타입만 정의하고 `import type`으로만 쓰이므로 컴파일하면 사라진다.

## 1. 진입점과 명령 분기

설치본과 저장소가 같은 경로로 명령을 찾도록, 진입점은 실행만 맡고 명령 해석은 한 곳에 모은다.

- 진입점: `src/agctx.ts`. 설치본에서는 컴파일한 `dist/agctx.js`가 같은 일을 한다.
- 전역 옵션 분리와 명령 찾기: `src/commands/cli.ts`의 `main`<!--s:31d0505f3375-->·`run`<!--s:2ba71c9bbb82-->, `src/commands/args.ts`의 `stripFlag`<!--s:3a20e16f337b-->
- 명령 조회와 오타 제안: `src/commands/registry.ts`의 `findCommand`<!--s:f564c4c5c891-->·`suggestCommands`<!--s:0a3290b4e6ca-->·`usageLine`<!--s:1e6aea3c47c2-->, `src/commands/cli.ts`의 `unknownCommand`<!--s:d9a9924eeab0-->

## 2. 로케일 해석과 저장

같은 명령이 사람에게는 고른 언어로, 자동화에는 예측 가능한 언어로 보이도록 우선순위를 한 함수에 고정한다.

- 우선순위 판정: `src/i18n/index.ts`의 `resolveLocale`<!--s:b5b4fc884ca1-->
- 실행 시 해석과 저장: `src/commands/cli.ts`의 `resolveActiveLocale`<!--s:3baa14739a52-->, `src/shared/home.ts`의 `saveLocale`<!--s:4f6c7f18d7d7-->(`config.json`)
- 이유: [ADR 0002](../adr/0002-locale-i18n.md), 기본 영어는 [ADR 0014](../adr/0014-default-locale-english.md)
- 지키는 평가: `evals/i18n.test.ts`, `evals/messages.test.ts`

## 3. 프로필 저장소 모델

프로필은 사용자 홈의 보관함에 있고 프로젝트 파일과 섞이지 않는다. 테스트와 스모크는 `AGCTX_HOME`으로 보관함을 옮겨 실제 홈을 건드리지 않는다.

- 보관함 경로: `src/shared/home.ts`의 `agctxHome`<!--s:e54fff59419c-->·`profileHome`<!--s:6a22b8ad5c16-->
- 읽기·검증: `src/profile/store.ts`의 `getProfiles`<!--s:5d1ae329164c-->·`readProfile`<!--s:1674cbf36d97-->·`validateProfileName`<!--s:51371845ea3a-->·`isValidProfileMetadata`<!--s:c3bf5c60f82f-->
- 연결한 프로필: 보관함 폴더의 `link.json`을 따라간다. 보관함 항목(사본, 포인터, 운영체제 링크)마다 프로필 파일이 있는 폴더와 쓸 수 있는지는 `src/profile/store.ts`의 `profileLocation`<!--s:db62a3ef2844-->이 한 곳에서 정하고, 보관함 전체는 `src/profile/store.ts`의 `readStore`<!--s:e6650e618cc1-->가 한 번 읽어 나눈다. 위의 읽기 함수와 `src/check.ts`·`src/repos/status.ts`·`src/repos/pr.ts`·TUI가 그 결과를 쓴다. 포인터 읽기, 끊긴 링크를 되살리는 안내, 막기는 `src/profile/store.ts`의 `profileLink`<!--s:298a17fe2eb3-->·`brokenLinkHint`<!--s:b0a05a87fcdd-->·`relinkCommand`<!--s:ea9e1ec9bb5a-->·`assertNotLinked`<!--s:ddec723cad95-->, 연결하기는 `src/profile/link.ts`의 `planLink`<!--s:8e2fbb4cbe01-->·`writeLink`<!--s:3ffc7047c4e0-->·`instructionCandidates`<!--s:327abb8897a3-->·`checkLinkFolder`<!--s:0cc22a3d49ac-->. 이유는 [ADR 0037](../adr/0037-link-existing-folder-as-profile.md), 평가는 `evals/profile-link.test.ts`와 `evals/tui-link.test.ts`
- 규칙 파일 경로: `profile.json`의 `instructions`, 없으면 `AGENTS.md`. `src/profile/store.ts`의 `instructionsFile`<!--s:c0ded7cce71a-->·`isInstructionsPath`<!--s:1865487d2906-->·`assertInstructionsPath`<!--s:74f95039ed1d-->, 원격에서 받은 파일의 링크 검사는 `regularFileInside`
- 이유: [ADR 0007](../adr/0007-profile-home-layout.md), 이름 변경은 [ADR 0013](../adr/0013-rename-agent-context-manager.md), 규칙 파일 경로는 [ADR 0036](../adr/0036-profile-json-names-rules-file.md)
- 지키는 평가: `evals/profile-instructions.test.ts`

## 4. profile create

빈 프로필을 만들고 지침 템플릿을 넣는다. CLI와 TUI가 같은 함수를 쓴다.

- 생성: `src/profile/store.ts`의 `createProfile`<!--s:a908d869e3ef-->
- TUI 흐름: `src/tui/profile.ts`의 `createProfileTui`<!--s:f7004d40fe9b-->
- 지키는 평가: `evals/profile.test.ts`

## 5. profile setup: 지침 블록 기록

지침 항목을 켜고 끈 결과를 프로필의 규칙 파일(`AGENTS.md`, 또는 `instructions`가 가리킨 파일) 안 표지 사이에만 기록한다. 사람이 쓴 부분은 건드리지 않는다.

- 항목 정의와 기록: `src/profile/setup.ts`의 `guidanceDefaults`<!--s:b4d095fe641d-->·`setupProfile`<!--s:abc05cb69cde-->·`GUIDANCE_KEYS`<!--s:0dc6917d6bee-->
- 이유: 항목과 근거 등급은 [ADR 0026](../adr/0026-guidance-items-and-evidence-tiers.md), 값을 켜고 끄는 둘로 줄인 것은 [ADR 0028](../adr/0028-guidance-on-off.md)
- 지키는 평가: `evals/guidance-levels.test.ts`, `evals/guidance-budget.test.ts`

## 6. profile apply: 변경 계획과 적용

`apply`는 프로젝트에 쓸 프로필을 정하고, `sync`는 이미 정해진 프로필을 다시 적용한다. 둘 다 무엇을 바꿀지 계획으로 먼저 보여 준다.

- 공통 처리기: `src/commands/handlers.ts`의 `applyOrSync`<!--s:5902bdf3e7ca-->
- 계획 수립: `src/profile/apply.ts`의 `planFor`<!--s:f91c505687bf-->, `src/project/plan.ts`의 `planProject`<!--s:6e0253cfa38e-->
- 계획 출력: `src/profile/apply.ts`의 `printPlan`<!--s:d9c078cea294-->
- 이유: 지원 에이전트 범위는 [ADR 0011](../adr/0011-supported-agents.md)
- 지키는 평가: `evals/profile.test.ts`, `evals/sync-merge.test.ts`

## 7. 관리 영역 병합과 hash

한 파일 안에서 agctx가 소유한 영역과 사용자가 쓴 영역을 나눠, 관리 영역만 다시 쓰고 사용자 영역은 보존한다. 관리 영역의 hash를 `agctx.project.json`에 기록해 사람이 고쳤는지 판정한다.

- 영역 분리: `src/project/analyzer.ts`의 `extractAgentsManagedDocument`<!--s:0700d9cc618e-->와 `extractManagedDocument`<!--s:99daceed8803-->. `AGENTS.md`의 경계는 마커이고, 마커가 없는 옛 파일만 `EXTENSION_HEADER`로 찾는다([ADR 0034](../adr/0034-managed-end-marker-in-agents-md.md))
- 포매터 대응: `src/project/analyzer.ts`의 `formatterUnstableLines`<!--s:ea6d2494f3c9-->가 다시 쓰일 형태를 찾고, `formatterNormalized`가 표현 차이를 사람의 편집과 가른다
- 병합·hash 기록: `src/project/plan.ts`의 `managedRegion`<!--s:31135cae2bb1-->·`regionHash`<!--s:7232f157aa03-->
- 줄 끝 정규화: `src/shared/fs-utils.ts`의 `toLf`<!--s:ef4ef3119fe3-->
- 이유: 규칙 파일 머리말은 [ADR 0009](../adr/0009-agent-rule-frontmatter.md), 편집 병합이 관리 영역을 다시 만드는 계약은 [ADR 0010](../adr/0010-edit-merge-regenerates-managed-area.md)
- 지키는 평가: `evals/sync-merge.test.ts`, `evals/conflicts.test.ts`, `evals/formatter-stability.test.ts`

## 8. profile sync

`sync`는 프로젝트에 기록된 프로필만 다시 적용하고 프로필을 바꾸지 않는다. 프로필 전환은 `apply`의 몫이다.

- 기록된 프로필 읽기: `src/profile/apply.ts`의 `boundProfile`<!--s:4a7d617ed27c-->
- 처리기: `src/commands/handlers.ts`의 `applyOrSync`<!--s:5902bdf3e7ca-->
- 지키는 평가: `evals/profile.test.ts`

## 9. 안전한 파일 쓰기

프로젝트 파일을 바꿀 때 심볼릭 링크와 비정규 파일을 거부하고, 같은 폴더의 임시 파일을 거쳐 원자적으로 교체한다. 기존 파일이 CRLF면 CRLF로 다시 쓴다. 이 검사들이 던지는 오류는 `CliError`가 아니므로 종료 코드 70으로 끝난다.

- 대상·부모 경로 검사: `src/shared/fs-utils.ts`의 `assertSafeTextTarget`<!--s:bb1c1caae2da-->
- 원자적 교체와 줄 끝 보존: 같은 파일의 `writeTextAtomic`·`toLf`
- 지키는 평가: `evals/file-safety.test.ts`

## 10. dry-run · 로그 · 종료 코드

무엇이 바뀔지 먼저 보고 멈출 수 있어야 하고, 자동화는 종료 코드로 판단할 수 있어야 한다.

- 계획 출력: `src/profile/apply.ts`의 `printPlan`<!--s:d9c078cea294-->
- 사람용·기계용 출력 분리: `src/commands/output.ts`의 `say`<!--s:b99734f31558-->·`warn`<!--s:971ab0d30f97-->
- 종료 코드: `src/shared/errors.ts`의 `EXIT`<!--s:88a0b0937cc7-->·`worstExitCode`<!--s:fdecbb48af6f-->·`CliError`<!--s:879c3666a193-->
- 이유: [ADR 0016](../adr/0016-command-contract.md)
- 지키는 평가: `evals/command-contract.test.ts`

## 11. TUI 흐름 배선

TUI는 CLI와 다른 경로가 아니라 같은 명령을 부르는 화면이다. 취소는 모든 화면에서 같은 함수로 처리한다.

- 메인 화면: `src/tui/main.ts`의 `mainTui`<!--s:1666baf9d9f1-->·`MAIN_MENU_ENTRIES`<!--s:7c0e1b1e5cb4-->·`MAIN_ACTIONS`<!--s:3189aceb6ee4-->
- 폴더 연결 화면: `src/tui/profile.ts`의 `linkProfileTui`<!--s:a6f75602106f-->
- 프로필 화면: `src/tui/profile.ts`의 `runTuiStep`<!--s:f2d08b8be72f-->·`PROFILE_MENU_COMMANDS`<!--s:d96467fbd07b-->·`MENU_ACTIONS`<!--s:25635427e433-->·`pinPrompt`<!--s:8cb0fc3f19da-->·`withConflictRecovery`<!--s:be04af9dc7f0-->
- 저장소 화면: `src/tui/repository.ts`의 `REPOS_MENU_COMMANDS`<!--s:f58f2199bf19-->
- 명령 실행: `src/tui/commands.ts`의 `commandTokens`<!--s:b9863ab66014-->·`runFromTui`<!--s:0ea9d22b8fae-->
- 취소 처리: `src/tui/cancel.ts`의 `cancelled`<!--s:d632c458039e-->
- 이유: [ADR 0025](../adr/0025-every-command-in-cli-and-tui.md)
- 지키는 평가: `evals/tui-commands.test.ts`, `evals/tui-pin.test.ts`

## 12. 기능 인터페이스 동등성 계약

명령의 정본은 등록부 하나다. 등록부에 적은 표면과 항목에 따라 CLI·TUI·에이전트가 같은 명령을 같은 계약으로 쓴다.

- 등록부와 항목 형식: `src/commands/registry.ts`의 `COMMANDS`<!--s:3a38e5a1415d-->·`CommandSpec`<!--s:f7e50b3c5590-->·`agentPolicy`<!--s:2a17e53b8c57-->
- 옵션·인자 검사: `src/commands/options.ts`의 `checkArguments`<!--s:46951ac06a3e-->
- 이유: [ADR 0016](../adr/0016-command-contract.md), [ADR 0025](../adr/0025-every-command-in-cli-and-tui.md), 에이전트 표면은 [ADR 0029](../adr/0029-agent-surface-contract.md)
- 지키는 평가: `evals/interface-parity.test.ts`, `evals/tui-commands.test.ts`, `evals/messages.test.ts`, `evals/agent-surface.test.ts`

## 13. 검증 하네스와의 대응

각 기능은 대응하는 평가로 강제된다. 검증의 목적·증거 범위·한계의 정본은 [현재 아키텍처](architecture.md)와 [문서 게이트](doc-gate.md)다.

| 기능 | 대응 평가 |
| --- | --- |
| 안전한 파일 쓰기([9절](#9-안전한-파일-쓰기)) | `evals/file-safety.test.ts` |
| 관리 영역 병합·hash([7절](#7-관리-영역-병합과-hash)) | `evals/sync-merge.test.ts` |
| 명령 등록부와 세 경로 동등성([12절](#12-기능-인터페이스-동등성-계약)) | `evals/interface-parity.test.ts`, `evals/messages.test.ts`, `evals/agent-surface.test.ts` |
| 종료 코드·`--json`·`--yes`·`--help`([10절](#10-dry-run-로그-종료-코드)·[12절](#12-기능-인터페이스-동등성-계약)) | `evals/command-contract.test.ts` |
| 프로필 생성·설정·apply/sync | `evals/profile.test.ts` |
| Git 프로필·버전 기록·고정([15절](#15-git-프로필-명령)·[16절](#16-적용-버전-기록과-고정)) | `evals/git-profile.test.ts` |
| check([17절](#17-check)) | `evals/command-contract.test.ts`, `evals/git-profile.test.ts`, `evals/repos.test.ts` |
| 여러 저장소 목록·상태·동기화·PR([19절](#19-여러-저장소-목록과-repos-명령)) | `evals/repos.test.ts` |
| 숨은 문자([18절](#18-숨은-문자-검사)) | `evals/hidden-chars.test.ts`, `evals/git-profile.test.ts` |
| 충돌 표시·base·resolve([14절](#14-관리-영역-충돌-표시와-profile-resolve)) | `evals/conflict-resolve.test.ts`, `evals/conflicts.test.ts` |
| 로케일 해석([2절](#2-로케일-해석과-저장)) | `evals/i18n.test.ts` |
| explain·verify([20절](#20-explain-에이전트별-지침-로드-판정)·[21절](#21-verify-세션-기록-판독과-probe)) | `evals/explain.test.ts`, `evals/verify.test.ts` |
| skills·subagents·hooks([25절](#25-프로필의-skillssubagentshooks)) | `evals/profile-artifacts.test.ts` |
| 배포 파일 경계 | `evals/package-contents.test.ts` |
| 문서 계약·저장소 운영 | `evals/docs-check.test.ts`, `evals/repository-operations.test.ts` |

## 14. 관리 영역 충돌: 표시와 profile resolve

사람이 관리 영역을 고쳤으면 덮어쓰지 않고 멈춘다. 마지막 적용본을 `.agctx/base/`에 남겨 두어 3-way 병합으로 복구한다. 다만 현재 관리 영역이 이번에 쓸 내용과 같으면 잃을 것이 없으므로 멈추지 않는다.

- 충돌 수집과 base 판정: `src/project/plan.ts`의 `planProject`<!--s:6e0253cfa38e-->, `src/project/base.ts`의 `knownBase`<!--s:25ec18c72425-->
- 충돌 표시: `src/profile/apply.ts`의 `conflictError`<!--s:67eff4ced41f-->·`printConflicts`<!--s:51d931dd55c1-->, `src/project/conflicts.ts`의 `formatDiff`<!--s:46e8e209a1fb-->·`baseFilePath`<!--s:4a36f8b8ecfd-->
- 복구 명령: `src/profile/resolve.ts`의 `resolveProject`<!--s:22ec452a95f1-->·`mergeWithEditor`<!--s:757a38979834-->·`withBaseRegion`<!--s:e1ff5455598d-->, `src/project/merge-editor.ts`의 `mergeInVsCode`<!--s:3b347041fbc3-->
- TUI 복구: `src/tui/profile.ts`의 `resolveProjectTui`<!--s:398fc4fe566d-->
- 이유: [ADR 0008](../adr/0008-managed-conflict-recovery.md), 편집 병합 계약은 [ADR 0010](../adr/0010-edit-merge-regenerates-managed-area.md)
- 지키는 평가: `evals/conflict-resolve.test.ts`, `evals/conflicts.test.ts`, `evals/formatter-stability.test.ts`

## 15. Git 프로필 명령

프로필 폴더 자체가 Git 작업 트리인 프로필을 다룬다. 원격 URL과 추적 브랜치는 `.git/config`가 정본이고 `profile.json`에 적지 않는다.

- git 실행: `src/shared/git.ts`의 `git`<!--s:5cd6cbd8922b-->·`isGitRoot`<!--s:82d5ec0e1ce5-->·`isRemoteFailure`<!--s:59e32fcf9095-->·`resolveRemoteLocation`<!--s:7de80492b458-->·`sanitizeRemoteUrl`<!--s:6198db3b36d0-->·`committedFile`<!--s:57e01f0132f4-->
- 명령: `src/profile/git-profile.ts`의 `profileGitState`<!--s:e8dfa159cb9a-->·`cloneProfile`<!--s:f7ab313e7a05-->·`pullProfile`<!--s:2dad3e4466c7-->·`planPush`<!--s:497fc3b3b02a-->·`pushProfile`<!--s:e8578cc53181-->·`connectProfile`<!--s:3ec6e5e3dc1b-->
- 커밋 안의 프로필 읽기: `src/profile/git-profile.ts`의 `committedProfile`<!--s:6781660c390f-->. 그 커밋의 `profile.json`에서 규칙 파일 경로를 읽으므로, `pull`이 들어올 커밋을 검사할 때와 고정한 프로젝트를 다시 만들 때 모두 그 커밋의 경로를 쓴다.
- 이유: [ADR 0017](../adr/0017-git-profile-sharing.md), 규칙 파일 경로는 [ADR 0036](../adr/0036-profile-json-names-rules-file.md)
- 지키는 평가: `evals/git-profile.test.ts`, `evals/profile-instructions.test.ts`

## 16. 적용 버전 기록과 고정

저장소가 프로필의 어느 버전을 쓰고 있는지 기록한다. 고정한 저장소는 기록한 버전에 머물고 PR로만 올라간다.

- 버전 결정과 기록: `src/profile/apply.ts`의 `profileVersion`<!--s:0e955674ad5f-->. 고정한 프로젝트는 기록한 커밋의 규칙 파일·`mcp.json`·skills·subagents·hooks 파일로 다시 만들고, 커밋하지 않은 수정은 `profile.json`, 규칙 파일, `mcp.json`, `src/artifacts/profile-files.ts`의 `PROFILE_ARTIFACT_PATHS`<!--s:91785faa453a-->가 가리키는 경로를 보고 판정한다.
- 기록 위치: 프로젝트의 `agctx.project.json`
- 이유: [ADR 0017](../adr/0017-git-profile-sharing.md), [ADR 0018](../adr/0018-multi-repository-sync.md), [ADR 0036](../adr/0036-profile-json-names-rules-file.md)
- 지키는 평가: `evals/git-profile.test.ts`, `evals/profile-instructions.test.ts`

## 17. check

파일을 바꾸지 않고 저장소가 기록한 버전·관리 영역과 맞는지 판정한다.

- 판정: `src/check.ts`의 `checkProject`<!--s:747e5b1df120-->·`CheckReport`<!--s:a295dda2a352-->
- 처리기: `src/commands/handlers.ts`의 check 처리기
- 지키는 평가: `evals/command-contract.test.ts`, `evals/git-profile.test.ts`, `evals/repos.test.ts`

## 18. 숨은 문자 검사

보이지 않는 문자가 지침에 섞여 에이전트에게 다른 내용이 전달되는 것을 막는다. 파일 맨 앞의 BOM은 허용한다.

- 검출과 설명: `src/shared/hidden-chars.ts`의 `findHiddenCharacters`<!--s:5f84af97e1dd-->·`describeHiddenCharacters`<!--s:1c6d888af488-->
- 검사 지점: `src/profile/git-profile.ts`의 `assertNoHiddenCharacters`<!--s:204be46441f5-->, `src/profile/apply.ts`의 `planFor`<!--s:f91c505687bf-->, `src/check.ts`의 `checkProject`<!--s:747e5b1df120-->
- 지키는 평가: `evals/hidden-chars.test.ts`, `evals/git-profile.test.ts`

## 19. 여러 저장소 목록과 repos 명령

이 컴퓨터에서 프로필을 적용한 저장소들을 한 번에 다룬다. 사용자 폴더와 로컬 브랜치를 건드리지 않고, PR은 임시 작업 트리에서 만든다.

- 목록: `src/repos/registry.ts`의 `recordRepo`<!--s:d0ebe8e035c2-->·`readRepos`<!--s:5facc20de242-->·`pruneRepos`<!--s:bc7f4adae753-->·`repoKey`<!--s:3c27b00aca40-->(`$AGCTX_HOME/repos.json`)
- 상태: `src/repos/status.ts`의 `reposStatus`<!--s:641cd1a7b5c8-->
- 동기화: `src/repos/sync.ts`의 `planReposSync`<!--s:0d403cb43510-->·`uncommittedManagedFiles`<!--s:9cd82e6f8bbd-->·`applyReposSync`<!--s:c8d9a59abc6f-->
- PR: `src/repos/pr.ts`의 `prepareReposPrs`<!--s:ab855d0ab68a-->·`openPullRequests`<!--s:b5c124b67d9b-->·`worktreeFor`<!--s:ad2bec600d96-->·`cloneFor`<!--s:650a5c8784a4-->·`planTarget`<!--s:aabcef61d880-->·`gh`<!--s:ae30b932fe83-->
- 이유: [ADR 0018](../adr/0018-multi-repository-sync.md)
- 지키는 평가: `evals/repos.test.ts`

## 20. explain: 에이전트별 지침 로드 판정

에이전트마다 어떤 파일을 읽는지가 달라서, 적용한 지침이 실제로 그 에이전트에게 닿는지 판정해 보여 준다.

- 판정: `src/explain.ts`의 `explainPath`<!--s:cc7f0e0a7855-->·`chain`<!--s:36d1abe799a8-->·`claudeImports`<!--s:4f3b3e2f3420-->·`frontmatter`<!--s:4c013ce172d1-->·`UNSUPPORTED`<!--s:54713c04db31-->
- 폴더 탐색: `src/shared/scan.ts`의 `filesBelow`<!--s:896ffb39ffb1-->
- 이유: [ADR 0019](../adr/0019-explain-verify-and-agent-skills.md), 지원 에이전트는 [ADR 0011](../adr/0011-supported-agents.md)
- 지키는 평가: `evals/explain.test.ts`

## 21. verify: 세션 기록 판독과 probe

판정에 그치지 않고 실제 세션 기록이나 probe 실행으로 지침이 전달됐는지 확인한다.

- 확인: `src/verify/index.ts`의 `verifyPath`<!--s:e8b9cd4d65a6-->·`judged`<!--s:8e8923f080fd-->·`fromSessionLog`<!--s:892c8f0afe91-->
- 증거 판독: `src/verify/evidence.ts`의 `codexReceived`<!--s:9119337ada2d-->
- probe 실행: `src/verify/probe.ts`의 `probeAgent`<!--s:fabd2abcb739-->·`commandFor`<!--s:ee309b774ac6-->·`run`<!--s:e4ea41d7ec27-->
- 이유: [ADR 0019](../adr/0019-explain-verify-and-agent-skills.md)
- 지키는 평가: `evals/verify.test.ts`

## 22. 에이전트용 스킬 생성

스킬 파일의 본문은 사람이 쓰고, 명령 목록은 명령 등록부에서 생성한다. 어느 명령이 어느 스킬에 들어가는지는 명령의 에이전트 정책이 정한다.

- 스킬 목록과 생성: `tools/generate-skills.ts`의 `SKILLS`<!--s:0b8fca08bfb8-->·`commandList`<!--s:2a9ce3ff077f-->·`renderSkill`<!--s:0458b04cffbb-->
- 대상 파일: `skills/agctx/SKILL.md`, `skills/agctx-author/SKILL.md`의 `<!-- agctx:commands:start -->` 표지 사이
- 설치 확인: `tools/skills-smoke.ts`
- 이유: [ADR 0019](../adr/0019-explain-verify-and-agent-skills.md), 정책 기반 선택은 [ADR 0029](../adr/0029-agent-surface-contract.md), 한국어 스킬은 [ADR 0030](../adr/0030-korean-skills.md)
- 지키는 평가: `evals/skills.test.ts`

## 23. APM 생성 파일과 모노레포 연결 파일

다른 도구가 생성한 파일을 덮어쓰지 않고, 하위 폴더의 `AGENTS.md`에는 Claude Code가 읽을 연결 파일을 만든다. 두 판정 모두 계획 단계에서 이뤄지므로 `apply`·`sync`·`resolve`·`check`·`repos sync`·`repos pr`이 같은 결과를 받는다.

- APM 판정: `src/project/apm.ts`의 `apmRegenerates`<!--s:094241ddc410-->
- 연결 파일: `src/project/links.ts`의 `nestedAgentsFiles`<!--s:8aa5635f000a-->·`gitListed`<!--s:24fef030ad3d-->·`personLink`<!--s:d4c5f5340948-->·`linksTo`<!--s:004d73831ac4-->
- 폴더 탐색: `src/shared/scan.ts`의 `filesBelow`<!--s:896ffb39ffb1-->
- 이유: [ADR 0020](../adr/0020-apm-coexistence-and-monorepo-links.md)
- 지키는 평가: `evals/apm-coexistence.test.ts`, `evals/monorepo-links.test.ts`

## 24. 에이전트 스킬 설치

패키지에 든 스킬을 에이전트의 사용자 전역 스킬 폴더에 복사하고, 자기가 둔 폴더만 바꾸거나 지운다.

- 대상과 판정: `src/skills/install.ts`의 `skillTargets`<!--s:d78bdc4f8da0-->·`planInstall`<!--s:32bd2c1d333d-->·`planUninstall`<!--s:0612b36435ed-->
- 쓰기와 지우기: `src/skills/install.ts`의 `applyInstall`<!--s:85c182654efd-->·`applyUninstall`<!--s:68352b1b01f0-->
- 버전 알림: `src/skills/install.ts`의 `skillNotice`<!--s:96e35bb59bbd-->, 명령마다 붙이는 곳은 `src/commands/cli.ts`의 `run`<!--s:2ba71c9bbb82-->, TUI 첫 화면은 `src/tui/main.ts`의 `mainTui`<!--s:1666baf9d9f1-->
- 이유: [ADR 0038](../adr/0038-install-agent-skills-from-cli-package.md)
- 지키는 평가: `evals/skill-install.test.ts`, 설치한 패키지로 실행하는 확인은 `tools/package-smoke.ts`

## 25. 프로필의 skills·subagents·hooks

프로필의 `skills/<이름>/`, `subagents/<이름>.md`, `hooks.json`을 에이전트마다 다른 위치와 형식으로 저장소에 쓴다. skills·subagents 파일은 파일째 소유하고, hooks는 사람과 나눠 쓰는 설정 파일 안의 묶음만 소유한다. 사용 절차는 [팀 skills·subagents·hooks 나눠 쓰기](../guides/skills-subagents-hooks.md)에 있다.

- 프로필 파일 읽기: `src/artifacts/profile-files.ts`의 `workingArtifactFiles`<!--s:3e6e9f9bf1e4-->·`committedArtifactFiles`<!--s:f01af1e02d73-->. 심볼릭 링크와 텍스트가 아닌 파일은 거부하고, Git 프로필은 `.gitignore`를 따른다.
- 정의 검사: `src/artifacts/definitions.ts`의 `parseProfileArtifacts`<!--s:32c68e98acb5-->·`HOOK_EVENTS`<!--s:eb138d3b276e-->
- 에이전트별 위치와 형식: `src/artifacts/targets.ts`의 `SKILL_ROOTS`<!--s:a17f7ad11104-->·`SUBAGENT_TARGETS`<!--s:76263bc9767f-->·`HOOK_TARGETS`<!--s:73db9d115065-->·`UNVERIFIED_AGENTS`<!--s:80ddaff67869-->
- 계획: `src/project/artifact-plan.ts`의 `planArtifactFiles`<!--s:c403f51e0f8f-->. 사람이 둔 파일과 자리가 겹치면 `src/project/plan.ts`의 `planProject`<!--s:6e0253cfa38e-->가 `project.artifact-taken`으로 멈춘다.
- hooks 병합과 소유 키: `src/artifacts/hooks-merge.ts`의 `mergeHooks`<!--s:6707d7dce7eb-->·`hooksOwnership`<!--s:fbe335da0b8a-->
- 실행될 명령 보여 주기: `src/profile/apply.ts`의 `printArtifacts`<!--s:cb9e8e472f2b-->. `repos sync`는 hooks가 바뀌는 저장소를 `src/repos/sync.ts`의 `planReposSync`<!--s:0d403cb43510-->에서 `review`로 두고 넘긴다.
- 이유: [ADR 0046](../adr/0046-skills-subagents-hooks-in-profiles.md), 대상 범위는 [ADR 0021](../adr/0021-profile-scope-skills-mcp-subagents.md)·[ADR 0022](../adr/0022-profile-scope-hooks.md)
- 지키는 평가: `evals/profile-artifacts.test.ts`

## 관련 문서

- [구현 원리](implementation-principles.md): npm·Node.js·CLI 일반 원리와 이 패키지의 연결
- [현재 아키텍처](architecture.md): 현재 구현된 구조·소유권·검증 경계의 정본
- [CLI Reference](../reference/cli.md): 명령·옵션·종료 코드의 사양
