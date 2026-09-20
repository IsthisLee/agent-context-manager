# 프로필과 적용

<!-- agctx-doc-sources: src/profile/store.ts, src/profile/setup.ts, src/profile/apply.ts, src/shared/home.ts, src/i18n/index.ts, templates/CLAUDE.md, templates/antigravity-rules -->
<!-- agctx-doc-sources-sha256: 516e9c43ac9f3e3ff01d6c4c17e3665ada50d43eae7879ceb4115e79ec02a878 -->

agctx는 개발 지침을 **프로필**로 모아 두고, 그 프로필을 여러 프로젝트와 여러 AI 에이전트에 **적용·동기화**하는 도구다. 코드를 대신 쓰지 않는다. 지침을 만들고 배포하며, 그 지침이 에이전트에 닿는지 확인한다. 확인하려고 에이전트를 실행하는 것은 사용자가 `verify --probe`로 요청할 때뿐이다.

핵심 개념 네 가지:

- **프로필**: 공통 개발 지침을 담는 폴더. `~/.agctx/profiles/<이름>` 아래에 지침 `AGENTS.md`와 메타데이터가 있다. scope(`personal`·`company`·`team`·`workspace`)로 용도를 나눈다.
- **적용(apply)**: 프로필의 지침을 대상 프로젝트에 복사해 `AGENTS.md`와 에이전트별 포인터 파일을 만든다. 포인터 파일은 `AGENTS.md`를 직접 읽지 않는 에이전트에게 `AGENTS.md`를 읽으라고 알려 주는 짧은 파일이다. Claude Code용 `CLAUDE.md`는 `@AGENTS.md`로 그 파일을 가져오고, Antigravity용 `.agents/rules/agctx.md`는 작업을 시작할 때 `AGENTS.md`를 읽으라고 지시한다.
- **관리 영역**: 적용된 파일에서 `apply`·`sync`가 다시 만드는 부분. 사용자가 직접 쓰는 부분과 분리돼 있어서, 동기화해도 사용자가 쓴 내용은 그대로 남는다.
- **동기화(sync)**: 프로필을 고친 뒤 그 변경을 이미 적용한 프로젝트에 다시 반영한다. 관리 영역만 갱신한다.

## 프로필 보관함

프로필은 `~/.agctx/profiles/<이름>` 폴더다(`AGCTX_HOME`을 설정하면 `$AGCTX_HOME/profiles/<이름>`). 폴더에는 메타데이터 `profile.json`과 지침 `AGENTS.md`가 있고, 팀과 공유하는 프로필이면 `.git`도 있다. 필드는 [파일 형식](../reference/file-formats.md)에 있다.

## 지침 항목 켜고 끄기

`profile setup`은 작업 흐름·맥락 관리·TDD·변경 검토·검증·지침 파일·문서화·보안·믿을 수 없는 입력·응답 언어 10개 항목을 골라 프로필 `AGENTS.md`의 `<!-- agctx:guidance:start -->` 블록에 쓴다. 항목마다 값은 둘뿐이다(`src/profile/setup.ts`의 `guidanceDefaults`).

| 값 | 뜻 |
| --- | --- |
| `on` | 이 지침을 프로필에 넣는다. 응답 언어를 뺀 나머지 항목의 기본값이다. |
| `off` | 넣지 않는다. `AGENTS.md`에 해당 항목이 나오지 않는다. |

지침은 지켜지기를 원해서 넣는 것이므로 예외를 허용하는 중간 값을 두지 않는다. 지침을 얼마나 강하게 지킬지는 각 항목의 문장이 정하고, 강제는 프로젝트 하네스의 몫이다([ADR 0028](../adr/0028-guidance-on-off.md)).

`setup`이 쓰는 것은 항목마다 짧은 기본 문장뿐이다. 팀 규칙을 더 넣으려면 프로필 폴더의 `AGENTS.md`에서 `<!-- agctx:guidance:start -->` 블록 밖에 직접 쓴다. 블록 안은 `setup`을 다시 실행할 때 새로 만들어진다. 항목별 문장의 정본은 [지침 카탈로그](../reference/guidance-catalog.md)에 있다.

## 적용과 동기화

- `profile apply <이름> <프로젝트>`는 프로젝트가 쓸 프로필을 정하거나 다른 프로필로 바꾼다.
- `profile sync <프로젝트>`는 `agctx.project.json`에 기록된 프로필을 다시 적용한다. 다른 프로필로 바꾸지는 않는다.
- 두 명령 모두 `agctx.project.json`에 적용한 프로필과 버전(Git 프로필이면 원격·브랜치·커밋)을 기록한다.
- `apply`에 `--pin`을 붙이면 그 커밋에 고정된다. 고정한 프로젝트는 프로필에 새 커밋이 생겨도 `sync`가 기록한 커밋의 내용을 그대로 다시 쓰고, `apply --pin`을 다시 실행해야 새 커밋으로 옮겨 간다. 실제 차이는 [갱신 방식 고르기](../guides/update-policies.md#두-방식의-차이-확인하기)에 있다.

## 프로필 삭제

```bash
agctx profile remove company --yes
```

삭제되는 것은 프로필 보관함의 그 프로필 폴더뿐이다. 이미 프로젝트에 적용해 둔 `AGENTS.md` 같은 파일은 그대로 남는다. TUI에서는 목록에서 프로필을 고른 뒤 확인 질문에 답해 삭제하므로 이름과 `--yes`를 적지 않는다.
