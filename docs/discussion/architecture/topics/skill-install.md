# 에이전트 스킬을 agctx 명령으로 설치하기

<!-- agctx:generated:status:start -->
**상태:** Proposed
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
| 후속 작업 | 구현 전에 세 에이전트의 전역 스킬 위치를 확인해 `docs/references.md`에 기록한다. 결정은 [ADR 0019](../../../adr/0019-explain-verify-and-agent-skills.md)의 결정 3을 대체하는 새 ADR로 남긴다. |
| 권장 다음 작업 | [구현 전에 확인할 것](#구현-전에-확인할-것)의 세 가지를 확인하고, [평가 계획](#평가-계획)의 평가를 먼저 쓴다. |

## 목차

- [현재 동작](#현재-동작)
- [제안](#제안)
- [결정](#결정)
- [검토한 대안](#검토한-대안)
- [구현 전에 확인할 것](#구현-전에-확인할-것)
- [평가 계획](#평가-계획)
- [비범위](#비범위)

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
- 같은 절의 전역 설치 실험에는 `~/.agents/skills`와 `~/.claude/skills`만 나온다. 반면 Antigravity의 전역 스킬 위치는 공식 문서에서 `~/.gemini/config/skills/`다([전역 지침 파일 공유 근거](../../../references.md#전역-지침-파일-공유-근거)). 지금 안내하는 명령이 Antigravity에 전역으로 닿는지는 확인하지 않았다.

## 제안

설치는 CLI 패키지 하나에서 끝난다. 아래는 제안 예시이며 아직 구현하지 않았다.

```text
$ npm install -g agent-context-manager
$ agctx install
  claude       ~/.claude/skills/agctx, agctx-author   installed
  codex        <Codex 전역 위치>/agctx, agctx-author   installed
  antigravity  ~/.gemini 없음                          skipped
```

1. **패키지:** `package.json`의 `files`에 `skills/`를 더해, 게시한 CLI와 같은 버전의 스킬이 함께 설치되게 한다.
2. **`agctx install [--agent <claude|codex|antigravity>]... [--force] [--dry-run]`:**
   - 이 컴퓨터에 설치된 에이전트를 찾아, 패키지 안의 스킬 두 개를 각 에이전트의 전역 스킬 폴더에 복사한다.
   - 에이전트를 찾는 기준은 설정 폴더가 있는지다. Claude Code는 `CLAUDE_CONFIG_DIR`(없으면 `~/.claude`), Codex는 `CODEX_HOME`(없으면 `~/.codex`), Antigravity는 `~/.gemini`를 본다. `verify`가 세션 기록을 찾을 때 쓰는 변수와 같다. 건너뛴 에이전트는 출력에 적는다.
   - `--agent`로 고르면 설정 폴더가 없어도 그 에이전트에 설치한다. 하나도 찾지 못하면 확인한 폴더와 `--agent`를 안내하고 멈춘다.
   - 자기 스킬 폴더만 쓰므로 확인 질문을 하지 않는다. `profile create`와 같은 방식이다. `--dry-run`은 계획만 출력한다.
3. **설치 기록과 교체:**
   - 스킬 폴더마다 설치 기록 `.agctx-install.json`(CLI 버전과 파일별 해시)을 둔다.
   - 다시 실행했을 때 기록이 있고 파일이 기록과 같으면, 묻지 않고 새 버전으로 바꾼다.
   - 기록이 없거나(skills CLI로 설치했거나, 사람이 만들었거나, 심볼릭 링크인 경우) 파일이 기록과 다르면 바꾸지 않는다. 무엇이 다른지 보여 주고 멈추며, `--force`로 바꿀 수 있다고 안내한다. 프로젝트 파일의 관리 영역을 해시로 지키는 지금 방식과 같다.
4. **오래된 스킬 알림:**
   - 모든 명령이 실행될 때 설치 기록의 버전을 CLI 버전과 비교한다. 다르면 「스킬이 CLI와 버전이 다르다, `agctx install`을 실행하라」를 stderr에 한 줄로 출력한다.
   - `--json`이면 출력하지 않고 `warnings`에 담고, TUI는 첫 화면에 보여 준다. 스킬을 설치하지 않았으면 알리지 않는다.
5. **`agctx uninstall [--agent ...]`:** 설치 기록이 있는 스킬 폴더만 지운다. 기록이 없는 폴더는 남기고 그 경로를 알린다.
6. **CLI·TUI·에이전트:** 등록부에 두 명령을 전역 명령으로 등록하고, TUI 첫 화면에 「에이전트 스킬 설치」를 더한다. 에이전트가 자기 스킬 폴더를 바꾸면 안 되므로 에이전트 정책은 `never`다.
7. **문서:**
   - README와 빠른 시작의 기본 설치를 두 줄(`npm install -g agent-context-manager`, `agctx install`)로 바꾸고 `npx skills add` 안내를 뺀다.
   - [에이전트에게 agctx를 맡기기](../../../guides/agent-skills.md)에는 「전에 `npx skills add`로 설치했다면 한 번 `agctx install --force`」만 남긴다.

## 결정

2026-09-22 제품 소유자와 정했다.

1. **업데이트 방식:** 링크가 아니라 복사한다. CLI를 업데이트한 뒤에는 `agctx install`을 다시 실행해야 하고, 그 전까지는 알림이 그 사실을 알린다.
2. **알림 위치:** 모든 명령에서 알린다. 스킬과 CLI가 어긋난 채 에이전트가 없는 명령을 실행하는 것이 이 기능이 막으려는 문제라서, 어느 경로로 실행하든 보여야 한다.
3. **이미 있는 폴더:** 설치 기록과 같은 폴더만 교체하고, 그 밖의 폴더는 `--force` 없이는 바꾸지 않는다.
4. **대상 에이전트:** 설정 폴더가 있는 에이전트에만 설치하고, `--agent`로 고를 수 있다.
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

1. **에이전트별 전역 스킬 위치:** 공식 문서와 실측으로 확인해 `docs/references.md`에 기록한다.
   - Claude Code: 저장소의 근거에는 프로젝트 위치(`.claude/skills/`)만 공식 문서로 인용되어 있다. 사용자 위치 `~/.claude/skills/`는 skills CLI 실험에서 본 것이므로 공식 문서로 확인한다.
   - Codex: 사용자 전역 위치의 근거가 저장소에 없다.
   - Antigravity: 공식 문서의 `~/.gemini/config/skills/`에 두면 스킬 목록에 나오는지 실측한다.
2. **지금 안내가 Antigravity에 닿는지:** `npx skills add ... -g -a antigravity`가 `~/.gemini/config/skills/`에 설치하는지 확인한다. 닿지 않으면 지금 문서의 결함이므로 이 주제와 별도로 고친다.
3. **알림의 비용과 예외:** 모든 명령이 설치 기록 몇 개를 읽는 비용을 잰다. `--help`와 `install`·`uninstall` 자신은 알리지 않을지 정한다.

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
