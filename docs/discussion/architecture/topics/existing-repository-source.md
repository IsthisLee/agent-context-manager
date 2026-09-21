# 기존 Git 저장소를 프로필 원천으로 쓰기

<!-- agctx:generated:status:start -->
**상태:** Proposed
<!-- agctx:generated:status:end -->

## 제안 요약

### 목적과 이유

| 항목 | 내용 |
| --- | --- |
| 제안 목표 | 이미 Git으로 관리하던 규칙 저장소에 `profile.json` 하나만 더하면 규칙 파일을 옮기지 않고도 `profile clone`으로 받을 수 있게 한다. `profile.json`이 저장소 안에서 규칙 파일이 있는 경로를 가리킨다. |
| 제안 이유 | `profile clone`은 원격 저장소 루트의 `AGENTS.md`만 규칙 파일로 받는다. 조직은 대개 agctx보다 규칙 저장소를 먼저 갖고 있고, 그 저장소에서는 규칙 파일이 정책 문서·CI 워크플로와 함께 하위 폴더에 있다. 지금은 규칙 파일을 루트로 옮기고 README를 고쳐야 받을 수 있다. 게다가 거부할 때 보여 주는 안내는 새 프로필을 만들어 올리라고 하는데, 내용이 있는 저장소에서는 그 경로가 막혀 있다. |

### 범위와 우선순위

| 항목 | 내용 |
| --- | --- |
| 대상 계층 | 프로필 원천 저장소(`profile.json`), agctx CLI/TUI(`profile clone`·`pull`·`apply`·`sync`·`setup`·`view`, `check`), 프로필 보관함 |
| 결정할 것 | 필드 이름, 스키마 버전을 올릴지, 경로에 허용할 범위, 거부 안내를 같은 변경에서 고칠지 |
| 중요도 | High: 조직 사용자가 기존 규칙 저장소로 agctx를 처음 들일 때 첫 명령에서 막힌다. 다만 규칙 파일을 루트로 옮기는 우회가 지금도 동작한다. |

### 의존성과 실행 순서

| 항목 | 내용 |
| --- | --- |
| 선행 작업 | `profile clone`·`pull`·`apply --pin`과 숨은 문자 검사([ADR 0017](../../../adr/0017-git-profile-sharing.md)) |
| 선행 제안 | [프로필 모델과 저장소](profile-model.md), [Git 기반 프로필 관리](git-profile-management.md) |
| 후속 제안 | 없음 |
| 연관 제안 | [기존 저장소에서 프로필 만들기](profile-import.md)는 로컬 파일에서 고른 절을 복사해 새 프로필을 만드는 경로라 원천과의 연결이 끊긴다. 이 주제는 원천 저장소를 그대로 두고 `pull`로 따라간다. [프로필 설정 표면 확장](profile-config-surface.md)이 프로필에 규칙 말고 다른 파일을 담게 되면 여기서 정한 경로 제약을 함께 쓴다. |
| 후속 작업 | 결정을 ADR로 기록하고, `docs/reference/file-formats.md`의 `profile.json` 절과 [팀과 Git으로 공유하기](../../../guides/team-sharing.md)에 기존 저장소를 쓰는 절을 더한다. |
| 권장 다음 작업 | [결정할 것](#결정할-것)의 네 항목을 확정해 ADR로 기록한 뒤, [평가 계획](#평가-계획)의 실패하는 평가부터 작성해 구현한다. |

## 목차

- [현재 동작](#현재-동작)
- [원인](#원인)
- [제안](#제안)
- [검토한 대안](#검토한-대안)
- [결정할 것](#결정할-것)
- [비범위](#비범위)
- [평가 계획](#평가-계획)

## 현재 동작

아래 출력은 `main`(`0c87a59`, 0.4.0 이후)의 `node src/agctx.ts --lang ko`를 임시 `AGCTX_HOME`과 로컬 bare 원격으로 실행한 결과다. 원격 경로만 `<원격>`으로 바꿨다. 사례는 실제 조직의 공통 정책 저장소이고 이름만 바꿨다.

```text
acme/team-rules
├── docs/policy.md              사람이 읽는 공통 정책
├── templates/AGENTS.md         제품 저장소에 복사하는 에이전트 계약 ← 규칙 본문
├── .github/                    CI 설정
└── README.md
```

**1. 그대로 받으면 거부한다.** 루트에 `profile.json`도 `AGENTS.md`도 없기 때문이다. 종료 코드는 64다.

```text
$ agctx profile clone <원격>
오류: <원격>: 프로필 저장소가 아닙니다. 루트에 profile.json 파일이 없습니다.
다음: 프로필 저장소는 루트에 profile.json과 AGENTS.md가 있어야 합니다. agctx profile create로 만든 뒤 Git으로 올리세요.
```

**2. 심볼릭 링크로는 우회할 수 없다.** `profile.json`을 더하고 루트 `AGENTS.md`를 `templates/AGENTS.md`를 가리키는 링크로 두어도 64로 거부한다.

```text
오류: <원격>: 프로필 저장소가 아닙니다. 루트에 AGENTS.md 파일이 없습니다.
```

**3. 안내를 따르면 막힌다.** `profile create`로 새 프로필을 만들고 첫 커밋을 한 뒤 이 저장소에 `connect`하면, `push`와 그다음 `pull`이 모두 2로 멈춘다. 새 프로필의 첫 커밋과 원격의 기존 이력은 뿌리가 달라 fast-forward로 합칠 수 없기 때문이다.

```text
$ agctx profile push acme-try --yes
오류: acme-try 프로필의 원격에 받지 않은 커밋이 있습니다.
다음: 먼저 agctx profile pull acme-try 명령을 실행하세요.

$ agctx profile pull acme-try
오류: acme-try 프로필과 원격에 서로 다른 새 커밋이 있어 fast-forward pull을 할 수 없습니다.
```

**4. 지금 되는 경로는 규칙 파일을 루트로 옮기는 것뿐이다.** `git mv templates/AGENTS.md AGENTS.md`로 옮기고 `schemaVersion`·`name`·`scope` 세 항목만 적은 `profile.json`을 더하면 받는다. 대신 원천 저장소의 README 구성 설명을 고쳐야 하고, 루트로 옮긴 파일은 그 저장소를 열고 쓰는 에이전트에게도 규칙으로 읽힌다.

```text
$ agctx profile clone <원격> --branch feat/agctx-profile
team-rules 프로필을 커밋 4232219 기준으로 가져왔습니다.
다음: agctx profile apply team-rules <project>
```

공개 저장소에 원천 저장소의 이름이 남지 않도록, 같은 구성을 예시 이름 `team-rules`로 다시 만들어 같은 명령을 실행한 출력이다.

## 원인

원격에 `profile.json`이 있어야 한다는 제약과, 규칙 파일이 루트의 `AGENTS.md`여야 한다는 제약을 나눠 본다.

**`profile.json`은 원천이 가져야 한다.** [ADR 0017](../../../adr/0017-git-profile-sharing.md)은 받는 쪽이 `--name`으로 이름을 정하는 대안을 "팀원마다 이름이 달라지면 저장소에 기록한 `profile`과 맞지 않는다"는 이유로 버렸다. 제품 저장소의 `agctx.project.json`에 이 이름이 기록되고 `check`가 그 기록으로 검사하므로 이 제약은 유지한다.

**규칙 파일의 이름과 위치는 코드에 고정되어 있다.** 이 고정은 "프로필 저장소는 agctx가 만든 폴더를 그대로 Git에 올린 것"이라는 전제에서 나왔다. ADR 0017의 한계 목록에도 "저장소 하나에 프로필 하나만 받는다"가 있다. 고정된 자리는 다음과 같다.

- `src/profile/store.ts`의 `readProfile`: 보관함에 있는 프로필의 규칙 파일 경로를 정한다. `apply`·`sync`·`setup`·`profile view`와 TUI의 보기 화면이 모두 이 경로를 읽는다.
- `src/profile/store.ts`의 `createProfile`: 새 프로필에 루트 `AGENTS.md`를 만든다. 이 제안에서도 바꾸지 않는다.
- `src/profile/git-profile.ts`의 `cloneProfile`: 받은 저장소의 루트에 두 파일이 있는지와 숨은 문자가 없는지 검사한다.
- `src/profile/git-profile.ts`의 `pullProfile`: 들어올 커밋의 두 파일을 `git show`로 읽어 같은 검사를 한다.
- `src/profile/apply.ts`의 `profileVersion`: 고정한 프로젝트를 기록한 커밋의 `AGENTS.md`로 다시 만들고, 커밋하지 않은 수정이 있는지는 `AGENTS.md`와 `profile.json`만 보고 판정한다. `check`도 `planFor`를 거쳐 이 함수를 쓴다.

## 제안

`profile.json`에 저장소 안의 규칙 파일 경로를 적는다.

제안 예시(`profile.json`):

```json
{
  "schemaVersion": 2,
  "name": "team-rules",
  "scope": "company",
  "instructions": "templates/AGENTS.md"
}
```

그러면 원천 저장소에 더하는 파일은 이것 하나다.

제안 예시(원천 저장소):

```text
acme/team-rules
├── profile.json                ← 더하는 파일
├── docs/policy.md
├── templates/AGENTS.md         ← instructions가 가리킨다
├── .github/
└── README.md
```

읽는 쪽은 다음처럼 동작한다.

1. **필드가 없으면 지금과 같다.** 규칙 파일은 루트 `AGENTS.md`이고, 기존 프로필은 아무것도 바꾸지 않아도 된다.
2. **`clone`:** 임시 폴더에서 `profile.json`을 먼저 읽어 경로를 정하고, 그 파일이 있는지와 숨은 문자가 없는지 검사한다.
3. **`pull`:** 들어올 커밋의 `profile.json`에서 경로를 읽고, 그 커밋에 있는 그 경로의 파일을 검사한다. 경로를 바꾸는 커밋도 받는다.
4. **보관함의 프로필:** `readProfile`이 경로를 메타데이터에서 정한다. `apply`·`sync`·`profile view`·TUI는 그 결과를 따라간다. `setup`은 가리킨 파일에 지침 구역을 쓰고 루트에 `AGENTS.md`를 새로 만들지 않는다.
5. **고정한 프로젝트:** 기록한 커밋의 `profile.json`에서 경로를 읽어 그 커밋의 파일로 복원한다. 지금 작업 트리의 경로를 쓰면, 원천이 경로를 바꾼 뒤에는 옛 커밋을 복원할 수 없다.
6. **수정 판정:** `profile.json`과 가리킨 파일을 본다.
7. **제품 저장소:** 만들어지는 파일은 달라지지 않는다. 가리킨 파일의 내용이 지금 루트 `AGENTS.md`의 내용이 들어가는 자리에 들어간다.

## 검토한 대안

| 대안 | 판단 |
| --- | --- |
| 지금처럼 규칙 파일을 루트로 옮기게 한다 | 원천 저장소의 구조를 agctx에 맞춰 바꾸게 한다. 옮긴 파일은 그 저장소 자신의 규칙으로도 읽힌다. |
| `profile clone --path <폴더>`로 하위 폴더를 프로필로 받는다 | 보관함은 `~/.agctx/profiles/<이름>` 한 폴더에 저장소 전체를 두므로, 하위 폴더를 따로 기억해 `pull`·`push`·`apply`마다 따라가야 한다. 받는 사람마다 옵션을 맞춰야 하고, 경로를 원천이 정하지 못한다. |
| `profile clone --name --scope`로 `profile.json` 없이 받는다 | ADR 0017이 버린 대안이다. 팀원마다 이름이 달라진다. |
| 심볼릭 링크를 허용한다 | 링크가 저장소 밖을 가리키면 저장소에 없는 파일을 프로필로 읽는다. 지금의 거부를 유지한다. |
| [기존 저장소에서 프로필 만들기](profile-import.md)로 흡수한다 | 그 주제는 고른 절을 복사해 새 프로필을 만든다. 원천 저장소와 연결이 끊기므로 원천이 바뀌어도 `pull`로 따라갈 수 없다. |

## 결정할 것

### 1. 필드 이름

- **`instructions`(권장):** 코드의 `Profile.instructionsPath`와 이름이 같고, `profile view`가 보여 주는 내용을 가리킨다.
- **`agentsFile`:** 무엇을 가리키는지는 드러나지만, 제품 저장소에 만들어지는 `AGENTS.md`와 혼동하기 쉽다.

### 2. 스키마 버전

- **(가) `instructions`가 있으면 `schemaVersion` 2를 요구하고, 없으면 1을 그대로 받는다(권장).** 0.4.0과 지금의 `main`은 `src/profile/store.ts`의 `isValidProfileMetadata`가 `schemaVersion` 1만 받는다. 그래서 이 프로필을 받을 때 64로 거부하므로, 옛 버전이 엉뚱한 파일을 조용히 적용하는 일이 없다. `schemaVersion` 1에 `instructions`가 있으면 새 버전도 거부한다.

  ```text
  $ agctx profile clone <원격>
  오류: <원격>의 profile.json이 올바른 프로필 메타데이터가 아닙니다.
  ```

- **(나) 1에 선택 필드로 더한다.** 옛 agctx는 필드를 모른 채 루트 `AGENTS.md`를 찾는다. 원천 저장소 루트에 다른 `AGENTS.md`가 있으면 옛 버전은 그 파일을 적용하고, 아무 경고 없이 성공한다. `schemaVersion` 1에 `"instructions": "templates/AGENTS.md"`를 적고 루트에 `# 루트의 다른 규칙`으로 시작하는 `AGENTS.md`를 둔 원격을 지금의 `main`으로 `clone`·`apply`하면, 제품 저장소 `AGENTS.md`의 첫 줄이 `# 루트의 다른 규칙`이 된다.

### 3. 경로에 허용할 범위

권장하는 제약은 다음과 같다.

- 저장소 루트를 기준으로 한 상대 경로이고 `/`로 나눈다.
- 빈 값, 절대 경로, `..`나 `.` 조각, `.git`으로 시작하는 경로를 거부한다.
- 가리킨 파일과 거쳐 가는 폴더가 모두 심볼릭 링크가 아니어야 한다. 파일만 검사하면 폴더 링크로 저장소 밖을 가리킬 수 있다.
- 확장자는 `.md`만 받는다. 이 파일은 제품 저장소의 `AGENTS.md`에 들어가는 Markdown이다.

선택지로 남는 것은 `.md` 확장자를 강제할지 여부다.

### 4. 거부 안내

`clone`의 거부 안내("agctx profile create로 만든 뒤 Git으로 올리세요")는 내용이 있는 기존 저장소에서는 [막힌 경로](#현재-동작)를 가리킨다. 이 안내를 `profile.json` 최소 예시와 `instructions`를 보여 주는 문구로 바꾸고, 이 기능과 같은 변경에 넣을지 정한다.

## 비범위

- 저장소 하나에 여러 프로필을 두는 일. ADR 0017의 한계를 유지한다.
- 여러 파일을 합쳐 규칙 하나로 만드는 일.
- `profile create`에 경로 옵션을 두는 일. 보관함에서 새로 만드는 프로필은 루트 `AGENTS.md`로 충분하다. 이 제안은 새 명령이나 옵션을 더하지 않고, 필드는 원천 저장소에서 사람이 쓴다.
- agctx가 원천 저장소의 파일을 고치는 일.

## 평가 계획

bare 원격에 `templates/AGENTS.md`와 `instructions`가 있는 `profile.json`을 두고 다음을 확인한다.

1. `clone`이 가리킨 파일을 검사한 뒤 등록한다. 가리킨 파일에 숨은 문자가 있으면 3으로 멈춘다.
2. `apply`가 가리킨 파일의 내용을 제품 저장소 `AGENTS.md`에 넣는다. 원천 루트에 다른 `AGENTS.md`가 있어도 가리킨 파일을 쓴다.
3. `setup`이 가리킨 파일에 지침 구역을 쓰고 루트에 `AGENTS.md`를 만들지 않는다.
4. `pull`이 들어올 커밋의 가리킨 파일을 검사하고, 경로를 바꾸는 커밋도 받는다.
5. `apply --pin` 뒤 원천이 경로를 바꿔도 `sync`와 `check`가 기록한 커밋의 경로로 복원한다.
6. 가리킨 파일만 고치고 커밋하지 않으면 `apply`가 `uncommitted: true`를 기록하고 `apply --pin`은 거부한다.
7. 빈 값, 절대 경로, `..`, 링크 파일, 링크 폴더를 거치는 경로, `.md`가 아닌 파일, 없는 파일을 가리키면 거부한다. (가)를 고르면 `schemaVersion` 1에 `instructions`가 있을 때도 거부한다.
8. `instructions`가 없는 프로필의 기존 평가가 모두 그대로 통과한다.
9. TUI의 「프로필 가져오기」 흐름에서도 같은 결과가 나온다.
