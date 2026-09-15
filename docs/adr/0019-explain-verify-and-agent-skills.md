# 0019. 에이전트가 지침을 받는지 설명·검증하고 에이전트용 스킬을 배포한다

* **상태:** 채택됨 (Accepted)
* **일자:** 2026-09-15
* **결정자:** 제품 소유자
* **근거:** [에이전트 지침 로드와 전달 확인 근거](../references.md#에이전트-지침-로드와-전달-확인-근거), [에이전트 규칙 파일 로드 근거](../references.md#에이전트-규칙-파일-로드-근거)
* **관련:** [ADR 0001](0001-product-scope.md)이 두지 않기로 한 "에이전트 실행·평가 기능"의 범위를 고친다. 종료 코드 4는 [ADR 0016](0016-command-contract.md)이 예약한 뜻을 따른다. Antigravity 규칙의 `trigger: always_on`은 [ADR 0009](0009-agent-rule-frontmatter.md)의 실측에 기댄다.

## 배경 (Context)

- 지침 파일을 만들어도 에이전트가 읽지 않는 경우가 있다. Codex는 프로젝트 루트부터 실행 폴더까지의 `AGENTS.md`만 읽어 루트에서 시작하면 하위 폴더 파일을 읽지 않는다. Claude Code는 `AGENTS.md`를 직접 읽지 않고 `CLAUDE.md`의 가져오기로만 받는다. Antigravity는 `trigger: glob` 규칙을 세션 시작에 받지 않았다(실측).
- 사용자는 어떤 파일이 어느 에이전트에 들어가는지 알 방법이 없었고, agctx도 파일을 만든 것까지만 알렸다.
- ADR 0001은 에이전트 런타임을 실행·평가하지 않는다고 정했다. 전달을 증명하려면 에이전트가 남긴 기록을 읽거나 에이전트를 한 번 실행해 봐야 한다.
- 사용자가 에이전트에게 말로 agctx를 쓰게 하려면, 에이전트가 명령과 안전 규칙을 알아야 한다([자연어 요청을 통한 agctx 사용](../discussion/architecture/topics/agent-mediated-usage.md)).

## 검토한 대안 (Options)

| 항목 | 대안 | 판단 |
| --- | --- | --- |
| 전달 판정 | 파일이 생겼는지만 본다 | 위 세 가지 누락을 잡지 못한다 |
| | 에이전트별 문서 규칙과 실측으로 정적으로 판정한다(`explain`) | **채택.** 에이전트를 실행하지 않고 CI에서도 쓸 수 있다 |
| | 에이전트 세션 기록을 읽는다(`verify`) | **채택.** 실제로 들어간 파일을 비용 없이 확인한다 |
| | 에이전트를 실행해 묻는다(`verify --probe`) | **채택(선택).** 기록이 없는 에이전트를 확인하되 사용자가 요청할 때만 |
| probe 방식 | 실제 저장소 파일에 표지를 넣는다 | 사용자 파일이 바뀐다 |
| | 에이전트에게 받은 규칙을 요약하게 한다 | 같은 파일의 규칙도 빠뜨린 적이 있다(실측) |
| | 임시 사본의 파일마다 고유한 표지 줄을 넣고 표지를 되묻는다 | **채택.** 파일 단위로 기계적으로 판정한다 |
| 스킬 | 스킬 하나로 진단·게시를 모두 맡긴다 | push·PR 같은 게시 동작이 자동으로 시작될 수 있다 |
| | 진단용과 게시용 두 스킬로 나누고 게시용은 이름으로 부를 때만 쓴다 | **채택** |
| 스킬의 명령 목록 | 손으로 쓴다 | CLI와 어긋난다 |
| | 명령 등록부에서 생성하고 평가로 최신 여부를 검사한다 | **채택** |

## 결정 (Decision)

1. **explain:** `agctx explain [--agent <codex|claude|antigravity|all>] [<path>]`는 그 폴더에서 시작한 에이전트마다 읽는 파일(`read`), 필요할 때 읽는 파일(`on-demand`·`conditional`), 가려진 파일(`shadowed`), 읽지 않는 파일(`not-read`)을 이유와 함께 보여 준다. 에이전트에 닿지 않는 프로젝트 지침 파일(`missing`)이 있으면 종료 코드 4로 끝난다. 실행 위치나 한 번의 승인에 따라 달라지는 경우는 경고로만 알린다. 루트에서 시작한 Codex가 하위 폴더 파일을 건너뛰는 경우와, 하위 폴더에서 시작한 Claude Code가 루트 `CLAUDE.md`의 `@AGENTS.md`를 외부 가져오기로 보고 승인 전에는 읽지 않는 경우(`conditional`), 실측에서 Antigravity가 세션 시작에 받지 않은 하위 폴더 `AGENTS.md`(`conditional`)가 여기에 속한다. Codex·Claude Code·Antigravity가 읽지 않는 다른 도구의 규칙 파일도 목록으로 보여 준다. 파일은 바꾸지 않는다.
2. **verify:** `agctx verify [--agent …] [--probe] [--yes] [<path>]`는 `explain`이 읽는다고 판정한 프로젝트 지침 파일을 기대값으로 삼는다.
   - Codex는 `$CODEX_HOME/sessions`에서 실행 폴더가 같은 가장 새 세션을 찾아, 가장 최근에 주입한 지침 본문에 파일 내용이 들어 있는지 대조한다.
   - Claude Code는 `$CLAUDE_CONFIG_DIR/projects`의 기록에서 가장 최근의 `instructions` 첨부와 이후 `nested_memory`에 적힌 경로를 대조한다.
   - Antigravity는 판정할 기록이 없으므로 `no-evidence`다.
   - 기록이 없거나, 지침을 불러온 뒤에 파일이 바뀌었으면 `no-evidence`로 표시하고 종료 코드는 바꾸지 않는다.
   - `conditional`·`on-demand` 파일은 기대값에 넣지 않지만, 들어온 증거가 있으면 `delivered`에 함께 적는다.
   - `--probe`는 확인을 받은 뒤, 프로젝트 지침 파일을 임시 저장소에 복사해 파일마다 표지 줄을 붙이고 `codex exec --sandbox read-only --ephemeral`, `claude -p --tools "" --no-session-persistence`, `agy -p --add-dir`를 한 번씩 실행해 표지를 되묻는다. CLI가 없거나 실패하면 69다.
   - 받지 못한 파일이 있으면 4로 끝낸다. 결과에는 증거 종류(`session-log`·`probe`)와 출처를 적는다.
3. **스킬:** 저장소의 `skills/agctx/SKILL.md`(진단·갱신, 자동 발동 허용)와 `skills/agctx-author/SKILL.md`(프로필 게시·PR, Claude Code `disable-model-invocation: true`, Codex `agents/openai.yaml`의 `allow_implicit_invocation: false`)를 둔다. 두 스킬은 쓰기 명령 앞에 `--dry-run` 결과를 보여 주고 사용자가 승인한 뒤에만 `--yes`를 붙이라고 지시한다. 명령 목록은 `tools/generate-skills.ts`가 등록부에서 만들고 `evals/skills.test.ts`가 최신인지 검사한다. 사용자는 skills CLI로 설치하며, npm 패키지에는 넣지 않는다.
4. **범위:** agctx는 여전히 에이전트 세션을 감싸거나 대화에 끼어들지 않는다. 에이전트 기록은 읽기만 하고, 에이전트 실행은 사용자가 `verify --probe`로 요청했을 때 도구를 끈 단발 실행으로 한정한다. 이 점에서 ADR 0001의 "에이전트 실행·평가 기능을 두지 않는다"를 고친다.

## 결과 및 영향 (Consequences)

- 파일이 생겼는데 에이전트가 읽지 않는 경우를 `explain`으로 CI에서 잡고, 실제 전달은 `verify`로 확인한다. 에이전트는 스킬로 이 명령들을 안전 규칙과 함께 쓴다.
- 평가: `evals/explain.test.ts` 4개(에이전트별 판정과 Claude 연결 파일·Antigravity glob 누락, 루트 실행 Codex 경고, 모두 닿을 때 0, 사용자 수준 파일과 frontmatter 없는 규칙), `evals/verify.test.ts` 6개(세션 기록 판독과 4, 오래된 기록, 가짜 에이전트 CLI로 한 probe와 저장소 보존, CLI 실패 69, 압축 뒤 다시 불러온 Claude 기록, 기록이 없을 때의 다음 단계 안내), `evals/skills.test.ts` 3개. skills CLI 설치 위치는 `tools/skills-smoke.ts`로 확인한다.
- 한계:
  - 에이전트 세션 기록 형식은 공개 계약이 아니다. Claude Code 문서도 기록 항목 형식이 내부용이며 버전마다 바뀐다고 적는다. 형식이 바뀌면 `no-evidence`가 늘 수 있으며, 그때는 판독기와 평가 fixture를 고친다. Claude Code 기록 폴더는 문서의 이름 규칙(영숫자가 아닌 문자를 `-`로 바꿈)으로 찾고, 없으면 마지막 경로 조각이 같은 폴더를 본다. 200자를 넘어 해시가 붙은 폴더와 `CLAUDE_CODE_PROJECT_DIR_NAME`으로 이름을 정한 폴더는 찾지 못할 수 있다.
  - 모노레포 하위 폴더에서 시작한 Claude Code는 루트 `CLAUDE.md`의 `@AGENTS.md`를 프로젝트마다 한 번 승인해야 읽는다. 실제 probe에서도 새 사본에서는 받지 못했다. 승인 없이 전달하는 방법은 모노레포 연결 파일 논의에서 정한다.
  - `explain`은 Codex의 `project_doc_fallback_filenames`와 `project_doc_max_bytes` 설정, Claude Code의 `claudeMdExcludes`·`--add-dir` 추가 폴더·관리 설정의 `claudeMd`를 반영하지 않는다. Antigravity CLI는 실측에서 하위 폴더 `AGENTS.md`와 `trigger: model_decision` 규칙을 세션 시작에 받지 않았다. 작업 중에 읽는지는 확인하지 못해 `conditional`과 경고로 둔다.
  - probe는 에이전트 요금제나 API 사용량이 들고 로그인이 필요하다. 에이전트가 표지 줄을 되풀이하지 못하면 누락으로 판정되므로 결과에 증거 종류를 함께 적는다.
  - 여러 경로로 같은 규칙이 들어가는 중복 경고는 이 결정에 포함하지 않는다.
