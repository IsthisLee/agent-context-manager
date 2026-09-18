---
name: repo-docs
description: 이 저장소(agent-context-manager)의 문서·ADR·논의 문서를 추가하거나 고칠 때 따르는 절차. 문서를 어디에 둘지 정하고, 정본과 중복을 확인하고, ADR·논의 문서의 상태와 기록을 갱신하고, 문서 소스 해시를 다시 기록해 `pnpm run check`를 통과시키는 단계를 담는다. 코드만 바꾸는 작업에는 쓰지 않는다.
metadata:
  internal: true
---

# 저장소 문서 변경 절차

규칙의 정본은 루트 `AGENTS.md`다. 이 스킬은 그 규칙을 실제 순서로 옮긴 것이며, 규칙과 어긋나면 `AGENTS.md`를 따른다.

## 1. 어디에 쓸지 먼저 정한다

`AGENTS.md`의 문서 배치 표에서 내용의 상태에 맞는 정본을 하나만 고른다. 고른 뒤 다음을 확인한다.

- 기존 정본에 같은 내용이 이미 있는가. 있으면 그 문서를 고치고 새로 쓰지 않는다.
- 다른 문서에는 요약과 링크만 두는가.
- 논의가 결정이나 구현으로 승격됐는가.

이미 열어 둔 문서라는 이유로 다른 주제의 내용을 섞어 넣지 않는다.

## 2. 내용을 쓴다

- 그림·예시 형식은 `docs/contributing/doc-style.md`를 따른다. 현재 동작 예시는 실제로 실행한 출력에서 옮긴다.
- 외부 사실은 `docs/references.md`에 출처 링크와 `(확인일: YYYY-MM-DD)`를 붙여 쓰고, 다른 문서는 그 절로 링크한다.
- 코드 동작을 서술하면 `파일:줄`로 인용하고, 그 소스를 문서 상단 마커에 핀한다.

## 3. ADR이 필요한지 판단한다

아키텍처, 주요 기술 선택, 공개 인터페이스, 데이터·보안 경계, 되돌리기 어려운 결정을 바꾸면 `docs/adr/`에 ADR을 추가한다.

- 파일 이름은 `NNNN-kebab-case-title.md`이고 번호는 순차다.
- 머리말에 `* **상태:**`, `* **일자:**`, `* **결정자:**`를 두고, 관련 ADR이 있으면 `* **관련:**`으로 링크한다.
- 0009 이후 ADR은 `* **근거:**`에 외부 근거 링크를 두거나, 외부 사실에 기대지 않으면 `외부 근거 없음: <이유>`를 적는다.
- 본문에는 배경(Context), 검토한 대안(Options), 결정(Decision), 결과 및 영향(Consequences)을 둔다.
- 채택된 ADR의 이력은 덮어쓰지 않는다. 결정을 바꾸려면 새 ADR을 쓰고 이전 결정과의 관계를 밝힌다. 오탈자·링크 정정은 기존 ADR에 반영해도 된다.
- `docs/README.md`의 ADR 색인을 같은 변경에서 갱신한다.

## 4. 논의 문서의 상태와 기록을 맞춘다

논의 문서의 계약을 구현했거나 구현하면서 계약이 바뀌었으면 같은 변경에서 갱신한다.

- 그 문서의 `**상태:**`
- 구현 기록(`#### 구현 기록: <범위>`)
- 그 주제가 속한 영역의 색인(`docs/discussion/<영역>/README.md`)의 상태
- 제안 요약의 `권장 다음 작업`

형식과 기록 시점의 정본은 `docs/discussion/architecture/topics/implementation-contracts.md`다.

## 5. 해시를 다시 기록하고 검증한다

```bash
node tools/check-docs.ts          # 무엇이 어긋났는지 본다
node tools/check-docs.ts --stamp  # 문서를 다시 읽고 고친 뒤에만 실행한다
pnpm run check                    # 형식 검사·문서 계약·평가 전체
```

`doc sources changed` 실패는 핀한 소스가 바뀌었다는 뜻이다. **stamp만 다시 실행해도 통과하므로**, 먼저 문서를 열어 인용한 줄 번호와 서술이 지금 코드와 맞는지 확인한 뒤에 stamp한다. 게이트 계약과 대상 문서 목록은 `docs/contributing/doc-gate.md`가 정본이다.

## 6. 함께 갱신할 문서를 확인한다

- 사용자에게 보이는 기능·호환성·설치·검증·보안 변경: `CHANGELOG.md`의 `Unreleased`
- 패키지의 목적·책임 경계·작업 모델: `docs/contributing/product-direction.md`와 README 요약
- 공개 저장소 운영 계약: `docs/contributing/releasing.md`와 관련 GitHub 파일·workflow
