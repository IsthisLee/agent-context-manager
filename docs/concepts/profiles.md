# 프로필과 적용

<!-- agctx-doc-sources: src/profile/store.ts, src/profile/setup.ts, src/profile/apply.ts, src/shared/home.ts -->
<!-- agctx-doc-sources-sha256: 80b0eb3a3dae641625b08a828ce8cebfa3ab9762022a01fe594ade1d36010f09 -->

agctx는 개발 지침을 **프로필**로 모아 두고, 그 프로필을 여러 프로젝트와 여러 AI 에이전트에 **적용·동기화**하는 도구다. 코드를 대신 쓰지 않는다. 지침을 만들고 배포하며, 그 지침이 에이전트에 닿는지 확인한다. 확인하려고 에이전트를 실행하는 것은 사용자가 `verify --probe`로 요청할 때뿐이다.

핵심 개념 네 가지:

- **프로필**: 공통 개발 지침을 담는 폴더. `~/.agctx/profiles/<이름>` 아래에 지침 `AGENTS.md`와 메타데이터가 있다. scope(`personal`·`company`·`team`·`workspace`)로 용도를 나눈다.
- **적용(apply)**: 프로필의 지침을 대상 프로젝트에 복사해 `AGENTS.md`와 에이전트별 포인터 파일을 만든다.
- **관리 영역**: 적용된 파일에서 agctx가 관리하는 부분. 사용자가 직접 쓴 부분과 분리돼 있어 동기화 때 사용자 내용은 보존된다.
- **동기화(sync)**: 프로필을 고친 뒤 그 변경을 이미 적용한 프로젝트에 다시 반영한다. 관리 영역만 갱신한다.

## 프로필 보관함

프로필은 `~/.agctx/profiles/<이름>` 폴더다(`AGCTX_HOME`을 설정하면 `$AGCTX_HOME/profiles/<이름>`). 폴더에는 메타데이터 `profile.json`과 지침 `AGENTS.md`가 있고, 팀과 공유하는 프로필이면 `.git`도 있다. 필드는 [파일 형식](../reference/file-formats.md)에 있다.

## 지침 수준

`profile setup`은 하네스 동작·TDD·변경 검토·검증·문서화·보안 6개 항목의 수준(`off`·`recommended`·`strict`)을 골라 프로필 `AGENTS.md`의 `<!-- agctx:guidance:start -->` 블록에 쓴다. 블록 밖은 사람이 직접 편집한다. 항목별 문장의 정본은 [지침 카탈로그](../contributing/guidance-catalog.md)에 있다.

## 적용과 동기화

- `profile apply <이름> <프로젝트>`는 프로젝트가 쓸 프로필을 정하거나 바꾼다.
- `profile sync <프로젝트>`는 기록한 프로필을 다시 적용하며 프로필을 바꾸지 않는다.
- 두 명령 모두 `agctx.project.json`에 적용한 프로필과 버전(Git 프로필이면 원격·브랜치·커밋)을 기록한다. 커밋에 고정하는 방법은 [갱신 방식 고르기](../guides/update-policies.md)에 있다.

## 프로필 삭제

```bash
agctx profile remove company --yes
```

삭제되는 것은 프로필 원본과 설정뿐이다. 이미 프로젝트에 적용된 파일은 그대로 남는다. TUI에서는 이름과 `--yes` 없이 골라 확인 후 삭제한다.
