# 에이전트 스킬을 agctx 명령으로 설치하기

<!-- agctx:generated:status:start -->
**상태:** Implemented
<!-- agctx:generated:status:end -->

## 제안 요약

### 목적과 이유

| 항목 | 내용 |
| --- | --- |
| 제안 목표 | npm으로 받은 CLI 패키지에 에이전트 스킬을 함께 넣고, `agctx install` 한 번으로 이 컴퓨터에 설치된 에이전트의 스킬 폴더에 복사한다. 기본 설치 안내는 `npm install -g agent-context-manager`와 `agctx install` 두 줄이 된다. |
| 제안 이유 | 지금은 CLI를 npm에서 게시한 버전으로 받고, 스킬은 외부 도구(skills CLI)로 GitHub `main`에서 받는다. 스킬 안의 명령 목록은 명령 등록부에서 생성되므로, 옛 CLI를 쓰는 사람의 에이전트가 그 CLI에 없는 명령을 스킬에서 보고 실행할 수 있다. 사용자는 `-g`와 에이전트별 `-a` 옵션을 외워야 하고, 외부 도구는 환경 변수로 끄지 않으면 사용 통계를 보낸다. |

### 범위와 우선순위

| 항목 | 내용 |
| --- | --- |
| 대상 계층 | npm 패키지 구성(`package.json`의 `files`), agctx CLI·TUI(`install`·`uninstall`과 모든 명령의 버전 알림), 사용자 홈의 에이전트 스킬 폴더, 사용자 문서 |
| 결정할 것 | 업데이트 방식, 알림 위치, 이미 있는 폴더의 처리, 대상 에이전트, 되돌리는 명령. 다섯 가지 모두 [결정](#결정)에서 정했다. 에이전트별 전역 스킬 위치는 [구현 전에 확인할 것](#구현-전에-확인할-것)에서 확인한다. |
| 중요도 | High: 처음 쓰는 사람이 거치는 기본 설치 경로이고, 스킬과 CLI의 버전이 어긋나면 에이전트가 없는 명령을 실행한다. |

### 의존성과 실행 순서

| 항목 | 내용 |
| --- | --- |
| 선행 작업 | 스킬 두 개(`skills/agctx`, `skills/agctx-author`)와 등록부에서 명령 목록을 만드는 `tools/generate-skills.ts` |
| 선행 제안 | [자연어 요청을 통한 agctx 사용](agent-mediated-usage.md)(스킬 배포) |
| 후속 제안 | 없음 |
| 연관 제안 | [구현 계약 및 문서 규칙](implementation-contracts.md)의 인터페이스 동등성 |
| 후속 작업 | 없음. 결정은 [ADR 0038](../../../adr/0038-install-agent-skills-from-cli-package.md)에, 사용 절차는 [에이전트에게 agctx를 맡기기](../../../guides/agent-skills.md)에, 명령과 파일 형식은 [CLI Reference](../../../reference/cli.md#install)와 [파일 형식](../../../reference/file-formats.md#agctx-installjson)에 옮겼다. |
| 권장 다음 작업 | 없음. 이 주제의 계약은 [구현 기록](#구현-기록)대로 모두 구현했다. |

## 목차

- [현재 동작](#현재-동작)
- [제안](#제안)
- [결정](#결정)
- [검토한 대안](#검토한-대안)
- [구현 전에 확인할 것](#구현-전에-확인할-것)
- [평가 계획](#평가-계획)
- [비범위](#비범위)
- [구현 기록](#구현-기록)

## 현재 동작

설치는 도구 두 개로 나뉜다.

```text
npm install -g agent-context-manager        ← CLI: npm에 게시한 버전
npx skills add IsthisLee/agent-context-manager -g -a claude-code -a codex -a antigravity
                                            ← 스킬: skills CLI가 GitHub main에서
```

- [ADR 0019](../../../adr/0019-explain-verify-and-agent-skills.md)의 결정 3이 「사용자는 skills CLI로 설치하며, npm 패키지에는 넣지 않는다」로 정했다. 그래서 `package.json`의 `files`에는 `skills/`가 없다.
- 스킬의 명령 목록은 `tools/generate-skills.ts`가 명령 등록부에서 만든다. CLI와 스킬을 서로 다른 곳에서 받으므로 두 버전이 맞는다는 보장이 없다.
- skills CLI의 옵션, 설치 위치, 사용 통계 전송은 [에이전트 지침 로드와 전달 확인 근거](../../../references.md#에이전트-지침-로드와-전달-확인-근거)에 있다. 거기 적힌 실험에 따르면, `-a` 없이 전역 설치하면 에이전트 폴더 70곳 넘게 설치된다.
- **지금 안내는 Antigravity의 전역 위치에 닿지 않는다.** Antigravity의 전역 스킬 위치는 공식 문서에서 앱·IDE는 `~/.gemini/config/skills/`, CLI는 `~/.gemini/antigravity-cli/skills/`다. 그런데 skills CLI 1.7.0에 `-g -a antigravity`를 주고 실측하니 `~/.agents/skills/`에만 설치하고 `~/.gemini`는 만들지 않았다. Antigravity가 `~/.agents/skills/`도 읽는지는 문서에 없고 확인하지 않았다. 근거는 [에이전트 지침 로드와 전달 확인 근거](../../../references.md#에이전트-지침-로드와-전달-확인-근거)의 2026-09-22 항목에 있다. 이 결함은 이 제안이 기본 설치를 바꾸면서 함께 없어진다.

## 제안

설치는 CLI 패키지 하나에서 끝난다. 아래는 제안 예시이며 아직 구현하지 않았다.

```text
$ npm install -g agent-context-manager
$ agctx install
  claude           ~/.claude/skills                  installed agctx, agctx-author
  codex            ~/.agents/skills                  installed agctx, agctx-author
  antigravity      ~/.gemini/config/skills           installed agctx, agctx-author
  antigravity-cli  ~/.gemini/antigravity-cli 없음     skipped
```

1. **패키지:** `package.json`의 `files`에 `skills/`를 더해, 게시한 CLI와 같은 버전의 스킬이 함께 설치되게 한다.
2. **`agctx install [--agent <claude|codex|antigravity|all>] [--force] [--dry-run]`:**
   - 이 컴퓨터에 설치된 에이전트를 찾아, 패키지 안의 스킬 두 개를 각 에이전트의 전역 스킬 폴더에 복사한다.
   - 설치할 곳과 에이전트를 찾는 기준은 아래와 같다. 설치할 곳은 각 에이전트의 공식 문서가 드는 사용자 전역 위치다. 찾는 기준은 그 에이전트의 설정 폴더가 있는지다. 건너뛴 곳은 출력에 적는다.

     | 대상 | 설치할 곳 | 찾는 기준 |
     | --- | --- | --- |
     | Claude Code | `~/.claude/skills/` | `~/.claude`가 있다 |
     | Codex | `~/.agents/skills/` | `CODEX_HOME`(없으면 `~/.codex`)이 있다 |
     | Antigravity 앱·IDE | `~/.gemini/config/skills/` | `~/.gemini/config`가 있다 |
     | Antigravity CLI | `~/.gemini/antigravity-cli/skills/` | `~/.gemini/antigravity-cli`가 있다 |

   - `--agent`로 고르면 설정 폴더가 없어도 그 에이전트에 설치한다. 값은 `explain`·`verify`의 `--agent`처럼 하나만 받고 `claude`·`codex`·`antigravity`·`all` 가운데 고른다. `antigravity`는 앱·IDE와 CLI 두 곳에, `all`은 네 곳 모두에 둔다. 하나도 찾지 못하면 확인한 폴더와 `--agent`를 안내하고 멈춘다.
   - 자기 스킬 폴더만 쓰므로 확인 질문을 하지 않는다. `profile create`와 같은 방식이다. `--dry-run`은 계획만 출력한다.
3. **설치 기록과 교체:**
   - 스킬 폴더마다 설치 기록 `.agctx-install.json`(CLI 버전과 파일별 해시)을 둔다.
   - 다시 실행했을 때 기록이 있고 파일이 기록과 같으면, 묻지 않고 새 버전으로 바꾼다.
   - 기록이 없거나(skills CLI로 설치했거나, 사람이 만들었거나, 심볼릭 링크인 경우) 파일이 기록과 다르면 바꾸지 않는다. 무엇이 다른지 보여 주고 멈추며, `--force`로 바꿀 수 있다고 안내한다. 프로젝트 파일의 관리 영역을 해시로 지키는 지금 방식과 같다.
4. **오래된 스킬 알림:**
   - 모든 명령이 실행될 때 설치 기록의 버전을 CLI 버전과 비교한다. 다르면 「스킬이 CLI와 버전이 다르다, `agctx install`을 실행하라」를 stderr에 한 줄로 출력한다.
   - `--json`이면 출력하지 않고 `warnings`에 담고, TUI는 첫 화면에 보여 준다. 스킬을 설치하지 않았으면 알리지 않는다.
5. **`agctx uninstall [--agent <claude|codex|antigravity|all>] [--dry-run]`:** 설치 기록이 있는 스킬 폴더만 지운다. 기록이 없는 폴더는 남기고 그 경로를 알린다.
6. **CLI·TUI·에이전트:** 등록부에 두 명령을 전역 명령으로 등록하고, TUI 첫 화면에 「에이전트 스킬 설치」를 더한다. 에이전트가 자기 스킬 폴더를 바꾸면 안 되므로 에이전트 정책은 `never`다.
7. **문서:**
   - README와 빠른 시작의 기본 설치를 두 줄(`npm install -g agent-context-manager`, `agctx install`)로 바꾸고 `npx skills add` 안내를 뺀다.
   - [에이전트에게 agctx를 맡기기](../../../guides/agent-skills.md)에는 「전에 `npx skills add`로 설치했다면 한 번 `agctx install --force`」만 남긴다.

## 결정

2026-09-22 제품 소유자와 정했다.

1. **업데이트 방식:** 링크가 아니라 복사한다. CLI를 업데이트한 뒤에는 `agctx install`을 다시 실행해야 하고, 그 전까지는 알림이 그 사실을 알린다.
2. **알림 위치:** 모든 명령에서 알린다. 스킬과 CLI가 어긋난 채 에이전트가 없는 명령을 실행하는 것이 이 기능이 막으려는 문제라서, 어느 경로로 실행하든 보여야 한다.
3. **이미 있는 폴더:** 설치 기록과 같은 폴더만 교체하고, 그 밖의 폴더는 `--force` 없이는 바꾸지 않는다.
4. **대상 에이전트:** 설정 폴더가 있는 에이전트에만 설치하고, `--agent`로 고를 수 있다. 설치할 곳은 [제안](#제안)의 표대로 각 공식 문서의 사용자 전역 위치다.
5. **되돌리기:** `agctx uninstall`을 함께 둔다. 설치 위치를 agctx가 관리하므로, 지우는 수단이 없으면 사용자가 폴더를 찾아 지워야 한다.

## 검토한 대안

| 항목 | 대안 | 판단 |
| --- | --- | --- |
| 업데이트 방식 | 복사하고 오래되면 알림 | **채택.** Node 버전 관리 도구로 Node를 바꾸거나 패키지를 지워도 스킬이 깨지지 않고, 운영체제마다 같게 동작한다 |
| | npm 전역 설치 폴더를 가리키는 심볼릭 링크 | `npm update -g`만으로 따라가지만, Node 버전을 바꾸거나 패키지를 지우면 링크가 끊겨 에이전트가 경고 없이 스킬을 잃는다. Windows는 링크 권한 때문에 복사로 대체해야 한다 |
| | npm 설치 스크립트(`postinstall`)로 자동 등록 | 설치 스크립트를 끄는 환경(`--ignore-scripts`)에서 조용히 빠지고, 설치 중에 사용자 홈에 쓰는 방식은 보안상 꺼린다. `npm uninstall`로 지워지지도 않는다 |
| 알림 위치 | 모든 명령 | **채택** |
| | 점검 명령(`check`·`explain`·`verify`)과 TUI 첫 화면 | 점검 명령을 실행하지 않으면 어긋난 채로 쓰게 된다 |
| | `agctx install`을 실행했을 때만 | 업데이트 뒤 잊으면 알 방법이 없다 |
| 이미 있는 폴더 | 설치 기록과 같을 때만 교체 | **채택** |
| | 항상 덮어씀 | 사람이 고친 스킬이나 이름이 같은 다른 스킬을 알리지 않고 지운다 |
| | 있으면 항상 멈춤 | 업데이트할 때마다 `--force`가 필요해 알림의 안내가 그대로는 통하지 않는다 |
| 대상 에이전트 | 설정 폴더가 있는 에이전트만 | **채택.** 쓰지 않는 에이전트의 폴더를 만들지 않는다. 폴더로 설치 여부를 판단하므로, 에이전트를 나중에 설치하면 다시 실행해야 한다 |
| | 항상 세 에이전트 | 컴퓨터마다 결과가 같지만 쓰지 않는 에이전트의 폴더가 생긴다 |
| | 매번 물어봄 | 명령 하나로 끝나지 않고 자동화에서는 옵션을 외워야 한다 |
| 설치 도구 | skills CLI를 계속 쓴다 | 버전이 어긋나는 문제와 옵션 부담이 그대로 남는다 |

## 구현 전에 확인할 것

1. **에이전트별 전역 스킬 위치:** 2026-09-22에 공식 문서로 확인해 [제안](#제안)의 표에 반영했다. 근거는 [에이전트 지침 로드와 전달 확인 근거](../../../references.md#에이전트-지침-로드와-전달-확인-근거)에 있다.
2. **지금 안내가 Antigravity에 닿는지:** 같은 날 실측했고, 닿지 않는다([현재 동작](#현재-동작)).
3. **`CLAUDE_CONFIG_DIR`:** Claude Code 문서는 개인 스킬 위치를 `~/.claude/skills/`로만 든다. 이 변수를 설정한 사람의 스킬 위치가 바뀌는지는 확인하지 못했으므로, 문서대로 `~/.claude/skills/`에 둔다. 이 변수만 쓰고 `~/.claude`가 없는 사람은 `--agent claude`로 설치한다.
4. **알림의 비용과 예외:** 모든 명령이 설치 기록 몇 개를 읽는 비용을 잰다. `--help`와 `install`·`uninstall` 자신은 알리지 않을지 정한다.

## 평가 계획

평가는 임시 `HOME`과 임시 에이전트 설정 폴더에서 돌린다. 모두 구현보다 먼저 쓰고 실패를 확인한다.

- 설정 폴더가 있는 에이전트에만 설치하고, 건너뛴 에이전트를 출력에 적는다. `--agent`는 폴더가 없어도 설치한다. 하나도 없으면 멈춘다.
- 설치한 스킬 파일이 패키지의 `skills/`와 같고, 설치 기록에 CLI 버전과 해시가 있다.
- 다시 실행하면 기록과 같은 폴더를 교체한다. 파일을 고친 폴더, 기록이 없는 폴더, 심볼릭 링크는 바꾸지 않고 멈추며 `--force`로만 바꾼다.
- 설치 기록의 버전이 CLI와 다르면 모든 명령이 stderr에 한 줄을 출력한다. `--json`이면 `warnings`에 담는다. 스킬을 설치하지 않았으면 출력이 없다.
- `uninstall`은 기록이 있는 폴더만 지운다.
- CLI·TUI 동등성: 등록부와 TUI 첫 화면 항목, 에이전트 정책 `never`를 확인한다.
- `tools/package-smoke.ts`로 만든 패키지에 `skills/`가 들어 있고, 설치한 패키지의 `agctx install`이 동작한다.

## 비범위

- 저장소 안(`.agents/skills`, `.claude/skills`)에 스킬을 두는 프로젝트 설치는 다루지 않는다. 전역 설치만 한다.
- 세 에이전트 밖의 에이전트는 다루지 않는다.
- 저장소의 `skills/` 폴더는 그대로 두므로, skills CLI로 GitHub에서 받는 길은 막지 않는다. 문서에서 안내하지 않을 뿐이다.

## 구현 기록

#### 구현 기록: agctx install과 uninstall, 버전 알림

* **결정:** [ADR 0038](../../../adr/0038-install-agent-skills-from-cli-package.md). [결정](#결정)의 다섯 항목대로 구현했다.
* **구현:**
  - `src/skills/install.ts`가 네 곳의 대상과 에이전트 찾기(`skillTargets`), 설치 계획(`planInstall`), 복사와 설치 기록(`applyInstall`), 제거(`planUninstall`·`applyUninstall`), 버전 알림(`skillNotice`)을 맡는다. 기록이 없거나 파일이 기록과 다른 폴더와 심볼릭 링크는 막고, 하나라도 막히면 아무것도 쓰지 않는다.
  - 명령 등록부에 전역 명령 `install`·`uninstall`(변경 분류 `agent-skills`, 에이전트 정책 `never`)을, TUI 첫 화면에 「에이전트 스킬 설치」·「제거」를 더했다.
  - `src/commands/cli.ts`의 `run`이 성공과 실패 두 경로 모두에서 알림을 붙이고, TUI 첫 화면도 같은 알림을 보여 준다.
  - `package.json`의 `files`에 `skills`를 더했고, 설치 스모크(`tools/package-smoke.ts`)가 tarball로 설치한 agctx로 임시 `HOME`에서 `agctx install`을 실행한다.
  - README 두 개, 빠른 시작, 에이전트 스킬 가이드의 기본 설치를 `agctx install`로 바꿨다.
* **평가:**
  - `evals/skill-install.test.ts` 17개가 통과한다. 명령 등록부의 전체 목록 평가(`evals/interface-parity.test.ts`)와 패키지 구성 평가(`evals/package-contents.test.ts`)도 고쳤다. 모두 구현보다 먼저 쓰고 실패를 확인했다.
  - 검사를 하나씩 빼는 변이 12개를 돌렸다. 11개는 해당 평가가 실패했다. 남은 1개(심볼릭 링크 검사)는 `lstat`이 링크를 폴더로 보고하지 않아 바로 뒤의 조건과 겹치는 코드였으므로, 겹치는 조건을 지웠다.
  - `pnpm run package:smoke`가 통과했다. TUI는 가상 터미널로 띄워, 기록이 오래됐을 때 첫 화면에 알림이 나오고 「에이전트 스킬 설치」를 고르면 `update`·`unchanged`·`skipped` 줄과 함께 기록이 새 버전으로 바뀌는 것을 확인했다.
* **계획과 달라진 점:**
  - `--agent`는 옵션 파서가 같은 옵션을 여러 번 받지 못해, `explain`처럼 값 하나에 `all`을 더한 형태로 바꿨다.
  - 다시 실행해 바뀐 폴더가 없으면 「이미 최신」이라고 알린다. 실제 출력을 문서에 옮기다가, 바뀐 것이 없을 때도 설치했다고 말하는 것을 발견해 고쳤다.
* **제약:**
  - `CLAUDE_CONFIG_DIR`로 Claude Code의 스킬 위치가 바뀌는지, Antigravity가 `~/.agents/skills/`도 읽는지는 확인하지 못했다.
  - 공용 평가 도우미(`evals/support/git-workspace.ts`의 `makeWorkspace`)는 `HOME`을 바꾸지 않는다. 그래서 개발자 컴퓨터에 설치된 스킬이 CLI와 버전이 다르면, 그 평가들의 stderr에도 알림 한 줄이 붙는다. 지금은 stderr가 비어 있기를 기대하는 평가가 없다.
* **다음 단계:** 없음.
