# Changelog

이 프로젝트의 사용자 영향 변경을 기록한다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)을 따르며, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따른다.

## [Unreleased]

### Changed

- 프로젝트 `AGENTS.md`의 관리 영역 경계를 `<!-- agctx:managed:end -->` 마커로 표시한다. 파일 처음부터 그 줄까지가 agctx 것이고 아래는 전부 사용자 것이다. 지금까지는 확장 섹션 제목(`## 4. 프로젝트 규칙 확장 (SSOT)`)의 생김새로 경계를 알아맞혔기 때문에, 파일을 열어도 어디까지가 agctx 영역인지 보이지 않았고 제목을 바꾸면 파일 전체가 관리 영역이 되어 충돌했다. 이제 제목과 그 아래 안내 한 줄은 사용자 것이므로 자기 말로 바꾸거나 지워도 된다. 처음 적용할 때 쓸 자리를 알려 주려고 한 번 써 줄 뿐이다. 기존 저장소는 `agctx profile sync` 한 번이면 마커가 들어가고, 마커가 없는 동안에는 지금까지처럼 제목으로 경계를 찾는다. 근거는 [ADR 0034](docs/adr/0034-managed-end-marker-in-agents-md.md)
- 프로젝트 `AGENTS.md`에서 프로필용 표지 `<!-- agctx:guidance:start -->`와 `<!-- agctx:guidance:end -->`를 뺀다. 그 사이의 지침 본문은 그대로 둔다. 이 표지는 `profile setup`이 프로필에서 다시 쓰는 범위를 뜻할 뿐 프로젝트에서는 의미가 없는데, 관리 영역 안에서 경계처럼 보였다
- 관리 영역이 `.agctx/base/`의 원문과 표현만 다르면 사람이 고친 것으로 보지 않는다. 목록 기호, 줄 끝 공백, 블록 사이의 빈 줄, 줄 끝 문자, 문단 안의 줄바꿈이 대상이고 낱말은 그대로 비교한다. 편집기가 저장할 때 Markdown을 다시 포맷해도 충돌하지 않게 하려는 것이며, 문단을 정해진 너비로 다시 접는 설정(Prettier의 `proseWrap: always`)까지 포함한다. 문단 안의 단일 줄바꿈이 Markdown에서 공백과 같기 때문이고, 줄바꿈에 뜻이 있는 코드 블록은 그대로 비교한다. 적용된 파일을 포맷 대상에서 뺄 필요가 없다. 낱말이나 그 차례가 바뀌면 지금까지처럼 충돌하고, 원문을 알 수 없으면 해시만 비교한다

### Fixed

- `agctx explain`이 Claude Code에 대해 틀린 판정을 내리던 문제를 고쳤다. 지금까지는 모든 `AGENTS.md`를 "읽지 않음"으로 보고 `missing`을 붙였으나, Claude Code v2.1.277 이상은 시작 폴더나 그 위에 `CLAUDE.md`·`.claude/CLAUDE.md`·`CLAUDE.local.md`가 하나도 없으면 `AGENTS.md`와 `.claude/AGENTS.md`를 직접 읽는다. **호환성:** `CLAUDE.md` 없이 `AGENTS.md`만 둔 저장소에서 종료 코드가 4에서 0으로 바뀌므로, `explain`의 4를 기대하던 CI 설정이 있으면 더 이상 걸리지 않는다. 가려진 `AGENTS.md`는 `not-read` 대신 `shadowed`로 표시하고, 커밋되지 않는 `CLAUDE.local.md`만 가리는 경우는 `missing`이 아니라 경고로 알린다. `~/.claude/settings.json`의 `instructionFiles` 설정 네 값도 판정에 반영한다. `profile apply`·`profile sync`가 만드는 `CLAUDE.md`는 그대로 둔다. 가져오기를 남겨도 같은 내용을 두 번 읽지 않고, 직접 읽기가 동작하지 않는 세션까지 덮기 때문이다. 근거는 [ADR 0035](docs/adr/0035-claude-code-reads-agents-md.md)
- 편집기가 저장할 때 Markdown을 다시 포맷하면 관리 영역이 바뀌어 충돌로 판정되던 문제를 고쳤다. agctx가 `AGENTS.md`에 쓰는 `* **Project:** <이름>` 한 줄만 목록 기호가 `*`였는데, Prettier를 비롯한 포매터는 한 문서의 목록 기호를 `-`로 통일한다. 그래서 확장 영역에만 규칙을 쓰고 저장해도 그 한 글자가 바뀌어 `check`가 충돌로 멈췄다. 이 줄과 `templates/CLAUDE.md`, `.agents/rules/agctx.md`의 목록 기호·제목 뒤 빈 줄을 포매터가 만들어 내는 형태로 맞췄고, 새 템플릿이 어긋난 채 배포되지 않도록 평가를 더했다. 이미 적용한 프로젝트는 `agctx profile sync`로 새 형태를 받는다
- 관리 영역이 이미 agctx가 쓰려는 내용과 똑같은데도 충돌로 멈추던 문제를 고쳤다. 덮어써도 잃을 것이 없는 상황이라 이제 그대로 진행한다. 옛 버전이 쓴 관리 영역을 포매터가 고쳐 놓았고 새 버전이 그 형태로 쓰는 경우가 여기에 해당하며, `resolve`로 풀면 오히려 쓸모없는 줄이 확장 영역에 남았다. 관리 영역에 다른 내용이 들어 있으면 지금까지처럼 멈춘다
- `check`와 `profile sync`가 같은 관리 영역을 두고 다른 판정을 내리던 문제를 고쳤다. `check`는 기록된 해시만 비교해 충돌(2)이라고 했고 `sync`는 통과했다. 프로필이 이 컴퓨터의 보관함에 있으면 `check`도 `sync`와 같은 기준으로 판정한다. 프로필이 없으면 비교할 기준이 해시뿐이므로 지금까지처럼 충돌로 본다
- `AGENTS.md`에서 프로젝트 확장 섹션의 제목을 찾는 조건을 넓혔다. 번호나 점이 없거나 제목 단계가 `###`로 바뀌면 경계를 찾지 못해 파일 전체를 관리 영역으로 보았고, 그래서 확장 영역에만 규칙을 써도 `check`가 계속 충돌로 판정했다.

### Changed

- 관리 영역 충돌 문구를 바꿨다. `agctx 밖에서 관리 파일을 고쳤습니다`가 `프로필이 관리하는 영역을 직접 고친 파일이 있습니다`가 되고, 안내에 프로젝트 규칙을 어디에 쓰면 되는지 한 줄을 더했다. 영어 문구도 같이 바꿨다.

## [0.4.0] - 2026-09-19

### Changed

- 라이선스를 Apache-2.0에서 **MIT**로 바꿨다. 이미 게시한 0.3.0과 0.3.1은 Apache-2.0으로 남고, MIT는 다음 게시 버전부터다. 근거는 [ADR 0031](docs/adr/0031-drop-open-source-process-files.md)
- 한 사람이 만드는 프로젝트에 맞게 공개 운영 파일 일곱 개(182줄)를 뺐다. `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `.github/CODEOWNERS`, 이슈 템플릿 세 개, OpenSSF Scorecard workflow다. 여러 사람이 상호작용할 때 값어치가 생기는 것과, 점수를 외부에 보이기만 하는 것이다. `SECURITY.md`와 `dependency-review`·`codeql`·`dependabot`처럼 막거나 알리는 것은 남겼다. 저장소를 고치는 규칙은 `AGENTS.md`와 `docs/contributing/`에 있다
- **호환성 파괴:** 지침 항목의 값을 `off`·`recommended`·`strict` 셋에서 `on`·`off` 둘로 줄였다. `--tdd strict`처럼 옛 값을 넘기던 스크립트는 사용법 오류(64)로 멈추므로 `on`으로 바꾼다. 이미 저장된 프로필의 `recommended`·`strict`는 `on`으로 읽으므로 기존 프로필은 그대로 동작한다. 산출물에서는 적용 수준 정의 범례와 항목마다 붙던 `적용 수준:` 줄이 빠지고, 항목이 블록에 있으면 켜진 것이다. 모든 항목을 켠 블록은 한국어 39줄 8,476바이트, 영어 39줄 7,680바이트다. `recommended`는 "이유를 적으면 예외를 둔다"는 뜻이라 승인·비밀값·테스트 무결성 규칙에 빠져나갈 길을 붙였고, 두 수준이 에이전트 행동을 다르게 만든다는 근거도 없었다. 근거는 [ADR 0028](docs/adr/0028-guidance-on-off.md)
- **호환성 파괴:** 배포 지침 항목을 6개에서 10개로 나누고 더했다. 작업 흐름에서 `--context`(맥락 관리)를, 보안에서 `--untrusted`(믿을 수 없는 입력)를 떼어내고, `--docs`(문서화)와 `--language`(응답 언어)를 더했다. 응답 언어만 기본값이 `off`이고 나머지는 `recommended`다. 지침 옵션 없이 표준 입력으로 수준을 넘기던 자동화는 줄이 6개에서 10개로 늘어나므로, 6줄만 주면 나머지 항목이 기본값으로 만들어진다. 기존 프로필에 저장된 6개 항목의 값은 그대로 읽는다. 근거는 [ADR 0026](docs/adr/0026-guidance-items-and-evidence-tiers.md)
- 근거 등급을 세 단계로 넓혔다. 공급사 공식 문서·표준 기관 문서(A)에 더해, 그 실천법을 만든 사람의 1차 저작과 방법을 공개한 동료 심사 연구(B)를 정의·절차의 단독 근거로 인정한다. 효과 주장은 A급만 쓴다
- 근거 문서 18건을 전문으로 다시 읽고 문장 단위로 대조해, 근거를 넘어 쓴 문장 일곱 곳을 원문 범위로 되돌렸다. 평가자 하나에 대한 문장을 서브에이전트 전반으로 넓혀 쓴 곳, 근거에 없는 횟수("두세 번")와 대상("출력"), 대응 원문이 없던 문장을 지우고, 빠뜨린 항목("예상치 못한 입력")과 조건("같은 정정을 다시 입력하게 되면")을 되살렸다
- 근거 원문을 다시 대조해 배포 지침에 조항 열둘을 더했다. 맥락 관리에 서브에이전트가 돌려준 결과의 범위 확인, TDD에 적대적 사례(잘못된 입력·만료된 토큰·형식이 깨진 payload·동시 접근), 변경 검토에 네트워크 접근·외부 리소스·셸 실행을 더하는 변경의 표시와 사람 검토를 대신하지 않는다는 단서, 검증에 관찰한 증거와 옮겨 적은 내용의 구분·건너뛴 확인의 사유·앞선 증거의 보존, 보안에 도구 인자 확인·비밀값 파일·프로덕션 자격 증명, 믿을 수 없는 입력에 숨은 문자 검사·MCP 도구 응답·읽어 들인 규칙 파일 감사가 들어갔다
- 배포 지침에서 근거가 없거나 근거를 넘어 쓴 문장을 다시 고쳤다. 믿을 수 없는 입력의 "그대로 따르지 않는다"와 보안의 "값을 출력하지 않는다"는 대응 원문이 없어 지웠고, 도구 인자 문장의 절대 금지는 원문이 요구하는 확인으로 되돌렸으며, 범위 밖 파일은 "바꿔야 하면 알린다"에서 원문대로 "고치지 말고 후속 작업으로 알린다"로 바꿨다. 맥락 관리의 작업 단계는 "탐색·계획·구현"으로, 문서화의 대상은 "공개 유틸리티의 문서"로 정정했다
- 근거를 넘어 옮긴 문장마다 그 사실을 [docs/references.md](docs/references.md)에 표기로 남겼다. 원문이 사용자나 설계자에게 한 말을 에이전트 규칙으로 옮긴 곳(대상 표기), 여러 문서를 합친 곳(합성 표기), 원문보다 넓게 적용한 곳(범위 표기), 권고를 명령형으로 옮긴 곳(서법 표기), 근거가 없어 지운 곳(뺀 것)을 구분해 적는다
- 보안 지침의 승인 목록에 커밋과 브랜치 변경을 넣었다. 근거인 OpenAI 쿡북이 "Keep commits, pushes, deployments, credentials, and external writes behind separate explicit approval"로 커밋을 함께 든다
- 모든 항목을 `strict`로 켠 guidance 블록의 분량 상한을 100줄·8 KiB에서 120줄·10 KiB로 넓혔다. 실측은 ko 56줄 9,077바이트, en 56줄 8,175바이트다

### Added

- 에이전트용 스킬 두 개를 한국어로 다시 썼다. 이 저장소의 문서 기본 언어와 맞추고, 사용자가 한국어로 요청할 때 스킬 `description`과의 대조가 한 겹 멀어지지 않게 한다. `description`에는 영어 한 줄을 함께 둔다. 생성되는 명령 목록은 `src/i18n/messages-ko.ts`에서 읽는다. CLI 출력의 기본 언어는 영어 그대로다. 근거는 [ADR 0030](docs/adr/0030-korean-skills.md)
- 에이전트를 CLI·TUI와 같은 계약 아래 두는 세 번째 표면으로 뒀다. 명령 등록부의 `agent` 정책(`auto`·`ask`·`never`)이 어느 스킬이 그 명령을 싣는지 정하고, `evals/agent-surface.test.ts`가 정책에 맞는 스킬 소속과 시나리오 덮음을 검사한다. 정책은 `changes`에서 유도되므로 새 명령이 정책 없이 존재할 수 없다. 근거는 [ADR 0029](docs/adr/0029-agent-surface-contract.md)
- TUI의 **Apply to a project**(프로젝트에 적용)가 Git 프로필이면 프로젝트를 지금 프로필 커밋에 고정할지 묻는다. Yes는 `profile apply --pin`과 같다. 이미 고정한 프로젝트는 Yes가 미리 선택되어 있어, 메뉴에서 다시 적용해도 고정이 조용히 풀리지 않는다. 지금까지는 TUI로 적용하면 항상 고정 없이 적용했다
- TUI 첫 화면에 **Check a project**(`check`·`explain`·`verify`)와 **Repositories**(`repos list`·`status`·`sync`·`pr`) 메뉴를 더했다. 이제 모든 명령을 TUI에서 실행할 수 있다. 원격 확인·에이전트·probe·프로필·없는 폴더 정리·PR 대상 파일·base 브랜치·초안·메시지는 질문으로 고른다. 답은 CLI와 같은 옵션 검사와 처리기로 실행되고, 종료 코드가 0이 아니면 결과의 뜻과 종료 코드를 보여 준다
- TUI의 **Help**에서 명령 하나를 골라 사용법·설명·종료 코드를 본다. **Clone a profile**과 **Connect to Git**은 브랜치를 묻는다(비워 두면 `--branch` 없음)
- TUI의 **Git status**는 원격에서 먼저 받을지(`--refresh`) 묻는다. 기본값은 지금까지와 같은 Yes다
- 사용 가이드 [TUI로 쓰기](docs/guides/tui.md)를 더했다. 키 조작, 확인 질문의 기본값, 취소 키, 메뉴와 CLI 명령의 대응(영어·한국어 메뉴 이름)을 실제 화면으로 보여 준다

### Changed

- TUI 첫 화면의 **Repository status**(저장소 상태)를 **Repositories**(여러 저장소) > **Status**(상태 보기)로 옮겼다
- **호환성 파괴:** `profile setup`의 지침 항목 두 개의 이름과 옵션을 바꿨다. `--harness`는 `--workflow`(작업 흐름)로, `--documentation`은 `--instructions`(지침 파일)로 바뀌었다. 옛 옵션은 남기지 않으므로 옛 이름을 쓰던 스크립트는 사용법 오류(64)로 멈춘다. 프로필에 저장된 `harness`·`documentation` 값도 읽지 않으므로 두 항목은 다시 고르기 전까지 기본값 `recommended`로 만들어진다. 근거는 [ADR 0024](docs/adr/0024-guidance-evidence-and-budget.md)
- 배포되는 기본 지침 6개 항목의 문구를 공식 문서·표준 근거에 맞춰 다시 썼다. 작업 흐름은 계획·범위·중단 기준을, TDD는 Red → Green → Refactor 각 단계와 테스트를 지키는 규칙을, 변경 검토는 새 맥락에서의 diff 검토를, 검증은 실행한 명령과 결과를 증거로 보이는 방식을, 지침 파일은 무엇을 두고 언제 고칠지를, 보안은 비밀값·권한·승인·믿을 수 없는 입력을 담는다. 문장마다 원문 인용과 확인일을 [docs/references.md](docs/references.md)에 기록했고 [지침 카탈로그](docs/reference/guidance-catalog.md)가 그 절로 링크한다. 기존 프로필은 자동으로 바뀌지 않는다. `agctx profile setup <name>`을 다시 실행하면 guidance 블록이 바뀌고 `agctx profile sync <project>`로 프로젝트에 반영되며, 블록 밖에 쓴 내용은 그대로 남는다

### Fixed

- 모델이 스스로 부를 수 있는 `agctx` 스킬이 `profile push`·`repos pr`처럼 원격을 바꾸는 명령까지 싣고 있던 것을 고쳤다. 이제 읽기만 하는 명령 일곱(`profile list`·`view`·`status`, `check`, `explain`, `verify`, `repos status`)만 싣는다. 바꾸는 명령은 사용자가 이름으로 부르는 `agctx-author` 스킬에만 있다. 지금까지는 스킬 본문의 승인 규칙에만 의존했고, 그 규칙은 지침이라 지켜진다는 보장이 없었다
- `agctx profile create`가 스킬의 명령 목록에 있으면서 에이전트가 부를 길이 없던 것을 고쳤다. 에이전트는 스킬 `description`만 보고 호출을 정하는데 생성 시나리오가 어디에도 없었다. `agctx-author` 스킬에 시나리오 일곱을 넣어 "컨텍스트 프로필 만들어줘" 같은 요청이 스킬에 닿는다. 지침 항목은 에이전트가 고르지 않고 사용자에게 묻는다
- CodeQL이 워크플로 파일을 추출만 하고 검사하지 않던 것을 고쳤다. GitHub Actions는 자기 쿼리 팩(`codeql/actions-queries`)을 가진 별도 언어인데 `languages: javascript` 하나만 주어 그 팩이 로드되지 않았다. `javascript-typescript`와 `actions`를 매트릭스로 돌린다. `${{ }}` 스크립트 인젝션과 과한 권한을 이제 검사하며, `publish.yml`이 신뢰된 게시로 `id-token: write`를 들고 있어 특히 필요하다. TypeScript 분석은 그대로다. `javascript`·`typescript`·`javascript-typescript`는 같은 추출기로 해석되고 실행 로그가 `.ts` 83개를 모두 스캔했음을 보였다
- 스킬 설치 안내가 기여자 전용 스킬까지 설치하게 하던 것을 고쳤다. `--skill '*'`는 skills CLI가 저장소 전체를 순회하므로 `.agents/skills/repo-docs`(이 저장소의 문서 작업 절차)까지 함께 설치했다. `repo-docs`에 `metadata.internal: true`를 붙여 사용자 설치에서 빠지게 하고, 안내를 `npx skills add IsthisLee/agent-context-manager -g -a claude-code -a codex -a antigravity`로 줄였다. `-g`는 전역 설치이므로 실행 위치가 상관없고 프로젝트에 파일을 만들지 않는다. `-a`는 빼면 에이전트 폴더 70개가 넘는 곳에 설치되므로 남긴다. 안내에서 `DISABLE_TELEMETRY=1`은 뺐다. 보내는 값은 저장소·스킬·에이전트 이름과 설치된 파일 목록뿐이고 끄는 방법은 가이드가 설명하므로, 끌지는 쓰는 사람이 정한다. `tools/skills-smoke.ts`가 이제 `.agents/skills`까지 복사해 `repo-docs`가 설치되지 않는지 검사한다
- `profile connect --branch <branch>`가 현재 브랜치와 다른 이름을 받으면, 현재 브랜치가 아니라 같은 이름의 로컬 브랜치에 추적 설정을 써서 `pull`은 추적 브랜치가 없다며 멈추고 `push`는 현재 브랜치 이름으로 올라갔다. 이제 현재 브랜치가 `--branch`로 준 원격 브랜치를 추적하고, `status`·`pull`·`push`가 모두 그 브랜치를 쓴다. 연결 문구와 `profile status`의 `원격 브랜치@커밋`도 추적하는 원격 브랜치를 표시하고, `--json`의 프로필 상태에 `remoteBranch`를 더했다
- 원격을 읽는 명령(`check --refresh`, `profile pull`·`push`·`clone`, `repos status`·`sync`·`pr`)이 자격 증명 실패를 기타 오류(70)가 아니라 외부 도구·인증 실패(69)로 끝낸다. 자격 증명 헬퍼나 askpass가 있는데 답하지 못해 git이 `fatal: unable to get password from user`로 끝나는 경우가 70으로 분류돼 "git ls-remote로 주소와 Git 인증을 확인하세요" 안내도 붙지 않았다

## [0.3.1] - 2026-09-16

### Fixed

- `repos pr`: GitHub CLI(`gh`)가 설치돼 있지 않아 PR을 열지 못하면, 안내 끝에 내부 오류(`spawnSync gh ENOENT`) 대신 "GitHub CLI (gh) is not installed; install it to open pull requests automatically."를 보여 준다.
- `verify`: 세션 기록이 없거나 오래됐을 때의 영어 다음 단계 안내가 에이전트 목록을 "an agent (Codex, Claude Code)"처럼 묶어 보여 준다.
- README: 뱃지를 누르면 이미지 파일 대신 해당 페이지(CI·CodeQL 워크플로, Scorecard, npm 패키지, 라이선스, Node.js 릴리스 일정, 커밋 기록, 지원 에이전트 절)로 이동한다. npm 패키지 페이지에서도 열리도록 모든 뱃지 링크를 절대 주소로 둔다.

## [0.3.0] - 2026-09-16

### Added

- 모노레포 연결 파일: `profile apply`·`sync`가 프로젝트 안의 하위 폴더 `AGENTS.md`마다 같은 폴더에 `@AGENTS.md`를 가져오는 관리 블록 `CLAUDE.md`를 만든다. Git 저장소면 `.gitignore`로 무시한 파일을 빼고, `node_modules`·`dist` 같은 폴더와 중첩 저장소는 보지 않는다. 사람이 둔 `CLAUDE.md`와 심볼릭 링크는 건드리지 않고 `AGENTS.md`를 가져오지 않으면 경고한다. `AGENTS.md`가 없어진 연결 파일은 지우지 않고 관리만 멈춘다. `repos sync`는 연결 파일의 커밋하지 않은 변경도 확인한다. 근거는 [ADR 0020](docs/adr/0020-apm-coexistence-and-monorepo-links.md)
- Microsoft APM과 함께 쓰기: APM 기본 모드가 만든 `AGENTS.md`·`CLAUDE.md`(처음 다섯 줄에 APM 생성 표시)에는 쓰지 않고 종료 코드 2로 멈추며 `managed_section`으로 전환하는 방법을 안내한다. 확장 영역에 둔 `<!-- apm:start -->`~`<!-- apm:end -->` 블록은 그대로 둔다
- `explain` 중복 경고: 규칙으로 보이는 줄을 3줄 이상 함께 담은 두 파일이 한 에이전트에 들어가면 경고한다. 사람이 둔 `CLAUDE.md`가 옆의 `AGENTS.md`를 가져오지 않으면 그 파일을 고치라고 안내한다
- `agctx explain [--agent <codex|claude|antigravity|all>] [<path>]`: 그 폴더에서 시작한 Codex·Claude Code·Antigravity가 읽는 지침 파일과 이유를 보여 주고, 어느 에이전트에도 닿지 않는 프로젝트 지침 파일이 있으면 4로 끝난다. 루트에서 시작한 Codex가 건너뛰는 하위 폴더 `AGENTS.md`와, 하위 폴더에서 시작한 Claude Code가 승인 전에는 읽지 않는 루트 `CLAUDE.md`의 `@AGENTS.md`는 경고로 알린다. 다른 도구의 규칙 파일(`.cursorrules` 등)도 목록으로 보여 준다. 근거는 [ADR 0019](docs/adr/0019-explain-verify-and-agent-skills.md)
- `agctx verify [--agent <codex|claude|antigravity|all>] [--probe] [--yes] [<path>]`: Codex·Claude Code 세션 기록에서 `explain`이 기대한 파일이 실제로 들어갔는지 확인하고, 받지 못한 파일이 있으면 4로 끝난다. 기록이 없거나 지침을 읽은 뒤 파일이 바뀌었으면 `no-evidence`로 알린다. `--probe`는 확인을 받은 뒤 파일마다 표지 줄을 붙인 임시 사본에서 에이전트 CLI를 도구 없이 한 번씩 실행하며, 저장소 파일은 바꾸지 않는다
- 에이전트용 스킬: 진단·갱신용 `agctx`와 프로필 게시·PR용 `agctx-author`(사용자가 이름으로 부를 때만 사용)를 저장소 `skills/`에 둔다. `npx skills add IsthisLee/agent-context-manager --skill '*' -a claude-code -a codex -a antigravity`로 설치한다. npm 패키지에는 들어가지 않는다
- Git 프로필 공유: `profile clone [--branch <branch>] <git-url>`, `profile status [--refresh] [<name>]`, `profile pull [--dry-run] <name>`, `profile push [--dry-run] [--yes] <name>`, `profile connect [--branch <branch>] <name> <git-url>`. 사용자의 Git 인증으로 `git`을 실행하고 프로젝트 파일은 건드리지 않는다. clone·pull은 받을 `profile.json`·`AGENTS.md`를 검증하고 숨은 문자를 검사한 뒤에만 반영하며 pull은 fast-forward만 한다. push는 이미 만든 커밋만 보낸다. TUI 메인 화면과 `profile list` 관리 메뉴에서도 실행할 수 있다. 근거는 [ADR 0017](docs/adr/0017-git-profile-sharing.md)
- 적용 버전 기록과 고정: `apply`·`sync`가 `agctx.project.json`에 `source { git, branch, commit }`와 `uncommitted`를 기록한다. `profile apply --pin`은 현재 커밋에 고정하고, 고정한 프로젝트의 `sync`는 기록한 커밋의 지침으로 다시 만든다. 고정한 프로젝트에 `--pin` 없이 적용하면 경고한다
- `agctx check [--refresh] [<project>]`: 파일을 바꾸지 않고 관리 영역 충돌(2)·숨은 문자(3)·뒤처짐(1)을 종료 코드로 알린다. 프로필 보관함이 없는 CI에서는 `--refresh`로 원천 브랜치의 최신 커밋과 비교한다
- 숨은 문자 검사: 양방향 제어 문자·폭 없는 문자·태그 문자·변형 선택자 보충을 `파일:줄:열 U+XXXX 종류`로 보고한다. 받을 프로필, 적용할 프로필, `check`의 관리 파일에 적용한다
- 여러 저장소: `repos list [--profile <name>] [--prune]`, `repos status [--profile <name>] [--refresh]`, `repos sync [--profile <name>] [--dry-run] [--yes]`, `repos pr [--profile <name>] [--targets <file>] [--base <branch>] [--draft] [--message <text>] [--dry-run] [--yes]`. `apply`·`sync`가 적용한 저장소를 `~/.agctx/repos.json`에 기록한다. `repos sync`는 고정한 저장소·관리 파일에 커밋하지 않은 변경이 있는 저장소·충돌한 저장소를 건너뛴다. `repos pr`은 임시 worktree에서 커밋해 `agctx/<프로필>-<커밋>` 브랜치로 push하고 `gh`로 PR을 열며, 열린 PR이나 같은 브랜치가 있으면 만들지 않는다. TUI 메인 메뉴에 `저장소 상태`를 더했다. 근거는 [ADR 0018](docs/adr/0018-multi-repository-sync.md)
- 모든 명령의 `--json` 결과 문서(stdout에 문서 하나, 안내는 stderr), `agctx <명령> --help`, 잘못 입력한 명령의 제안, `Error:`·`Next:` 형식의 로케일별 오류 문구. 근거는 [ADR 0016](docs/adr/0016-command-contract.md)
- `profile resolve [--dry-run] [--discard] [--edit] <project>`: 관리 영역 안에서 고친 줄을 관리 영역 밖으로 옮기고 관리 영역을 현재 프로필로 다시 만든다. 마지막 적용본을 알 수 없으면 멈추며 `--discard`는 `.agctx/backups/`에 백업한 뒤 다시 만들고, `--edit`은 자동 해결 결과로 채운 VS Code 3-way merge 편집기를 열고 결과에서 관리 영역 밖의 내용을 가져온다(관리 영역은 다시 만들므로 저장 시 포매터가 바꿔도 된다). `profile list` 관리 메뉴와 TUI의 충돌 흐름에서도 실행할 수 있다. 근거는 [ADR 0008](docs/adr/0008-managed-conflict-recovery.md)
- `apply`·`sync`가 마지막으로 쓴 관리 영역 원문을 프로젝트의 `.agctx/base/`에 기록하고 `.agctx/.gitignore`로 백업 폴더를 커밋에서 제외

### Changed

- **호환성 파괴:** 종료 코드를 나눴다. 관리 영역 충돌은 1에서 2로, 사용법 오류는 1에서 64로 바뀌고, 외부 도구·네트워크·인증 실패는 69, 그 밖의 오류는 70이다. 알 수 없는 명령은 도움말을 출력하고 0으로 끝나던 것을 비슷한 명령을 제안하고 64로 끝낸다. 근거는 [ADR 0016](docs/adr/0016-command-contract.md)
- **호환성 파괴:** 터미널이 아닌 환경이나 `--json`에서 `profile apply`·`sync`·`resolve`는 `--yes`가 있어야 파일을 쓴다. 없으면 64로 멈추고 `--yes`를 붙인 명령을 안내한다. 터미널에서는 계획을 출력한 뒤 확인을 받는다. `--dry-run`은 확인 없이 실행한다
- `agctx.project.json`을 `schemaVersion` 2로 기록한다. 1로 기록된 프로젝트도 그대로 읽는다
- `agctx.project.json`에 `AGENTS.md`에 쓴 프로젝트 이름(`projectName`)을 기록한다. `package.json`의 `name`이 없으면 폴더 이름보다 이 값을 먼저 써서, 다른 이름의 폴더로 clone한 저장소에서도 `sync`·`check`가 변경을 만들지 않는다
- 고정한 프로젝트라도 이 컴퓨터의 프로필 보관함에 기록보다 새 커밋이 있으면 `check`가 뒤처짐(1)으로 판정한다
- 기능 인터페이스 동등성 기준을 나눴다. 특정 프로필을 다루는 명령은 CLI·TUI·프로필 관리 메뉴가 모두 필요하고, 저장소를 검사하는 `check`와 전역 명령은 CLI만 필요하다
- 지침 항목 '리뷰'의 표시 이름을 '변경 검토'(영어 'Change review')로 바꿈. 항목 키와 CLI 옵션 `--review`는 그대로다. 규칙 내용이 변경 범위·위험 확인과 필요 시 독립 리뷰를 함께 다루기 때문이다. 기존 프로필은 `profile setup`을 다시 실행하면 guidance 블록의 제목이 `## 변경 검토`로 바뀌고, 이후 `profile sync`로 프로젝트에 반영된다.

- **호환성 파괴:** 이름을 Agent Context Manager로 바꿈. 패키지는 `@isthis/agentic`에서 `agent-context-manager`로, 명령은 `agentic`·`agt`에서 `agctx` 하나로 바뀐다. 프로필은 `~/.agctx/profiles/<name>/`(`profile.json`, `AGENTS.md`), 언어 설정은 `~/.agctx/config.json`에 둔다. 환경 변수는 `AGCTX_HOME`(데이터 폴더 자체를 가리킴)과 `AGCTX_LANG`이다. 프로젝트 파일은 `agctx.project.json`, `.agctx/`, `.agents/rules/agctx.md`이고 관리 표지는 `agctx:managed`다. 이전 이름의 홈과 프로젝트 파일은 읽거나 옮기지 않으므로 프로필을 다시 만들고 프로젝트에 다시 적용한다. 근거는 [ADR 0013](docs/adr/0013-rename-agent-context-manager.md)
- **호환성 파괴:** 기본 로케일을 영어(`en`)로 바꿈. 로케일을 지정하지 않은 비대화형 실행의 출력과 새 프로필·프로젝트의 지침이 영어로 나온다. 한국어는 `--lang ko`·`AGCTX_LANG=ko`·`agctx config lang ko`로 고르며, 첫 대화형 실행의 언어 선택 화면은 English를 먼저 보여 준다. 근거는 [ADR 0014](docs/adr/0014-default-locale-english.md)
- 지원 Node.js 하한을 22로 낮춤(`engines.node` `>=22.0.0`). CI는 Ubuntu Node.js 22·24·26, macOS·Windows Node.js 22에서 검증한다. 저장소 개발에는 Node.js 22.18 이상이 필요하다. 근거는 [ADR 0015](docs/adr/0015-node-22-support.md)
- 관리 영역 충돌로 `apply`·`sync`가 멈출 때 충돌 파일 전체와 차이를 볼 명령·푸는 명령을 함께 출력. `--dry-run`은 충돌이 있어도 계획을 끝까지 출력하고 충돌 파일을 `conflict`로 표시해 diff를 보여 준 뒤 종료 코드 2로 끝난다
- 런타임 의존성 `diff`(jsdiff) 추가
- 소스를 TypeScript로 옮김. 설치본은 `src/`를 컴파일한 `dist/`의 JavaScript이며 설치·실행 방법은 그대로다. 저장소 개발에는 Node.js 22.18 이상이 필요하고, `pnpm run check`가 문법 검사 대신 TypeScript 형식 검사를 실행한다. 근거는 [ADR 0012](docs/adr/0012-typescript-source.md)

### Removed

- **호환성 파괴:** Cursor(`.cursor/rules/agentic.mdc`)와 GitHub Copilot(`.github/copilot-instructions.md`) 지침 파일을 더 이상 만들거나 동기화하지 않는다. 지원 에이전트는 Codex(`AGENTS.md`)·Claude Code·Antigravity다. 이미 만든 두 파일은 지우지 않으므로 필요 없으면 직접 지운다. 근거는 [ADR 0011](docs/adr/0011-supported-agents.md)

### Fixed

- `--json`을 위치 인자 앞에 두면 바로 뒤의 인자까지 지워, `check --json <project>`가 현재 폴더를 검사하거나 `profile view --json <name>`이 사용법 오류(64)로 끝나던 문제를 고침
- 프로필이 보관함에 있어도 관리 영역 충돌이 있으면 `check`가 "보관함에 프로필이 없다"고 잘못 경고하던 문제를 고침
- `profile connect`·`profile clone`에 현재 폴더 기준 상대 경로를 주면 프로필 폴더 기준으로 해석해 원격을 찾지 못하던 문제를 고침
- Windows에서 포인터 파일의 관리 hash를 `\` 경로 키로 기록하고 `/` 경로로 조회해 수동 수정을 감지하지 못할 수 있던 문제를 고침. 이제 `/` 키로 기록한다
- 에이전트 규칙 파일의 frontmatter가 관리 마커 뒤에 놓여 파일 첫 줄에서 시작하지 않던 문제를 고침. 이제 템플릿 frontmatter를 관리 블록 밖 파일 맨 앞에 두고, 파일 맨 앞에 이미 있는 frontmatter는 보존한다. 이전 버전이 만든 파일은 다음 `sync`에서 충돌 없이 고쳐진다. 근거는 [ADR 0009](docs/adr/0009-agent-rule-frontmatter.md)
- Antigravity가 규칙 파일(`.agents/rules/agctx.md`)을 로드하지 않던 문제를 고침. 템플릿에 `trigger: always_on` frontmatter를 추가했다. 근거는 [ADR 0009](docs/adr/0009-agent-rule-frontmatter.md)

## [0.2.0] - 2026-09-14

### Added

- 로케일(ko/en) 국제화: `--lang`·`AGENTIC_LANG`·저장된 선택·첫 실행 대화형 선택으로 TUI와 생성 지침 언어를 고르는 `config lang` 명령. 기본은 한국어, 영어는 opt-in
- 용도별 프로필 생성·목록과 선택적 개발 지침 설정
- 선택한 프로필의 프로젝트 적용과 에이전트별 지침 산출물 동기화
- 공개 저장소 운영 문서와 기여·보안·행동규범 안내
- Node.js 24 LTS·26 Current CI, npm tarball 검사, Dependabot 설정, provenance 배포 workflow
- OpenSSF Scorecard workflow와 README의 자동 계산 점수 뱃지
- 배포되는 공통 지침 6개의 정본 목록을 [지침 카탈로그](docs/reference/guidance-catalog.md)로 정리. 프로필 `AGENTS.md`를 직접 편집해 지침을 채우는 경로를 사용 가이드와 지침 카탈로그에 명시
- `setup` 산출물에 `recommended`/`strict`의 뜻을 정의하는 "적용 수준 정의" 범례를 추가하고 setup TUI 힌트와 같은 문구를 공유. 배포되는 6개 지침을 근거 기반으로 다시 씀(하네스는 "작게 유지·선택적 확장" 반영). 근거는 [ADR 0005](docs/adr/0005-guidance-level-semantics.md)

### Changed

- **호환성 파괴:** `Core` 개념을 `Guidance Profile`(개발 지침 프로필, 짧게 프로필)로 개명. 모든 명령을 `profile` 하위로 통일(`profile create/list/view/remove/setup/apply/sync`)하고 `--core` 플래그 제거. `init`은 이름을 필수로 받는 `profile apply <name> <project>`로, `sync`는 이름을 받지 않고 기록된 프로필만 새로고침하는 `profile sync <project>`로 분리(이름·`--profile`/`--core`를 주면 거부). 저장 위치는 `~/.agentic-cores`→`~/.agentic-profiles`, 메타데이터 `agentic-core.json`→`agentic-profile.json`으로 바뀌며 최초 실행 때 자동 이관. 자세한 근거는 [ADR 0003](docs/adr/0003-rename-core-to-guidance-profile.md)
- 패키지 소개를 “사람과 AI 에이전트가 함께 따르는 개발 기준”으로 정렬하고, 프로필의 공통 지침과 프로젝트 도메인 지침의 소유 경계를 명확히 설명
- 실행 영수증을 테스트 실행 사실로 한정하고, 규칙 준수·제품 품질 평가와 구분
- 문서 정본·제품 범위·프로필 소유권을 명확히 정리
- 코드베이스를 분석해 프로젝트 지침을 자동 작성하는 기능은 지원하지 않는다는 점과 그 근거를 README·제품 방향에 명시. 초안은 각 에이전트의 `/init`으로 만들고 `AGENTS.md` 확장 영역이나 `CLAUDE.md` 관리 블록 밖에 두도록 안내. 근거는 [ADR 0006](docs/adr/0006-no-codebase-analysis-guidance.md)
- 저장소 개발·CI 패키지 관리자를 고정된 pnpm 환경으로 전환하고 npm 배포·사용 호환성은 유지
- 지원 런타임을 Node.js 24 LTS 이상으로 상향하고 CI·배포 workflow·기여 문서를 동일하게 정렬
- Windows 경로 구분자·`npm.cmd`·설치된 `.cmd` shim 차이를 평가에서 처리하고, GitHub Actions를 Node 24 호환 버전으로 갱신
- 프로필 생성·지침 설정에서 옵션 생략 시 사용할 수 있는 TUI 제공
- `agentic profile setup` 단독 실행 시 scope별 프로필 선택과 지침별 TUI 설정 제공
- `agt`를 `agentic` CLI의 짧은 별칭으로 제공
- TUI에 선택 설명·입력 검증·취소·최종 승인 단계를 추가
- 확인 절차가 있는 프로필 삭제와 적용 프로젝트 보존 제공
- 에이전트별 지침 산출물의 Agentic 관리 영역과 사용자 영역 분리
- 프로젝트 적용·동기화 전 변경 계획을 확인하는 `--dry-run` 제공
- 프로젝트 `AGENTS.md`의 프로필 영역과 에이전트 산출물 관리 블록의 수동 변경 감지, 파일 단위 원자적 교체 제공
- 손상된 프로필·프로젝트 metadata와 디렉터리가 아닌 적용 대상을 명확한 오류로 거부
- 적용 전 모든 대상 파일의 심볼릭 링크 여부를 검사해 알려진 위험에서 부분 변경을 방지
- Antigravity 지침 산출물 경로를 `.gemini/rules/agentic.md`에서 `.agents/rules/agentic.md`(Antigravity 공식 워크스페이스 규칙 폴더)로 정정. 이전에 적용한 프로젝트에 남은 `.gemini/rules/agentic.md`는 자동 삭제하지 않으므로 수동으로 지운다. 근거는 [ADR 0004](docs/adr/0004-antigravity-rules-path.md)

### Removed

- 대상 프로젝트에 검증 실행기·`doctor`·콜드 스타트 테스트를 주입하던 이전 하네스 기능

### Fixed

- 영어 로케일(`--lang en`·`AGENTIC_LANG=en`)로 적용한 프로젝트에서 `AGENTS.md`의 `## 4. Project rule extensions (SSOT)` 아래에 도메인 규칙을 추가하면 다음 `profile sync`·`profile apply`가 `Managed file changed outside Agentic`으로 멈추던 문제를 고침. 확장 섹션 제목을 한국어로만 인식하던 탓이며 이제 두 로케일의 제목과 안내 문구를 모두 인식한다.
- 사용 가이드의 관리 영역 충돌 복구 안내를 실제로 동작하는 절차로 정정. 같은 프로필로 `apply`를 다시 실행하는 것으로는 풀리지 않으며 관리 영역 수정을 되돌리거나 `agentic.project.json`을 치운 뒤 `apply`해야 한다.

## [0.1.0] - 2026-09-12

### Added

- 크로스 에이전트 지침 동기화와 프로젝트 검증 도구의 초기 공개 버전
