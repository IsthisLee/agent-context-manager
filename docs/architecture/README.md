# 현재 아키텍처

이 문서는 현재 구현되어 채택된 구조만 기록한다. 후속 개선 계약은 [`discussion/architecture/`](../discussion/architecture/)에서 관리한다.

## 현재 구조

```text
사용자 Core (~/.agentic-cores/<name>)
  └── AGENTS.md                 # 공통 지침 정본
          │ agentic init/sync --core
          ▼
대상 프로젝트
  ├── agentic.project.json      # 선택한 Core 식별
  ├── AGENTS.md                 # 적용된 공통 + 프로젝트 지침
  ├── 도구별 포인터 파일
  └── 프로젝트 코드·테스트
```

현재 CLI는 옵션 기반 또는 TUI 방식으로 Core를 생성·목록화·조회·설정·삭제한다. Core에는 `personal`, `company`, `team`, `workspace` scope가 있으며, `core list --scope <scope>`로 CLI 필터링할 수 있다. TUI의 `core list`는 scope를 먼저 선택한 뒤 Core를 고르고 생성·설정·프로젝트 적용·동기화·상세 보기·삭제 메뉴를 제공하며, `setup`만 실행한 경우에도 scope와 Core를 선택하게 한다. 각 기능은 CLI 명령과 TUI 경로를 모두 제공한다. 적용 시 프로젝트 `AGENTS.md`의 기존 지침을 보존하며, Agentic이 관리하는 에이전트별 포인터 파일은 `init/sync` 때 재생성한다. Core 삭제는 해당 Core 원본만 제거하고 이미 적용된 프로젝트 파일은 변경하지 않는다. 다음 `sync`에서는 `agentic.project.json`의 Core를 사용한다.

## 저장소 파일 구조

```text
agentic/
├── bin/
│   ├── agentic.mjs              # 메인 CLI와 Core·프로젝트 적용 로직
│   ├── agt.mjs                  # agentic CLI 별칭
│   └── analyzer.mjs             # 프로젝트 AGENTS.md 도메인 규칙 병합
├── templates/
│   ├── core/AGENTS.md           # 새 Core의 초기 지침 템플릿
│   └── ...                      # 에이전트별 지침 포인터 템플릿
├── evals/                       # CLI·문서·패키지 산출물 평가
├── tools/
│   └── check-docs.mjs           # Markdown·ADR·discussion 계약 검사
├── docs/
│   ├── README.md                # 문서 탐색 시작점
│   ├── product-direction.md     # 제품 방향 정본
│   ├── architecture/            # 현재 채택된 구조
│   ├── discussion/              # 구현 계획·논의·계약
│   ├── adr/                     # 장기 설계 결정 기록
│   ├── workflow.md              # 사용자 워크플로
│   └── references.md            # 외부 근거와 비교 자료
├── AGENTS.md                    # 이 저장소 개발 규칙 정본
├── README.md                    # npm 패키지 소개
├── package.json                 # npm 패키지·CLI·스크립트 정의
└── pnpm-lock.yaml               # 저장소 개발 의존성 잠금
```

배포 패키지에는 `bin/`, `templates/`, `README.md`, `LICENSE`와 런타임 의존성만 포함된다. `docs/`, `evals/`, `tools/`와 저장소 개발 문서는 npm 사용자의 설치 대상에서 제외된다.

## 소유권

| 영역 | 소유자 | 설명 |
| --- | --- | --- |
| 패키지 템플릿 | Agentic 저장소 | 기본 포인터와 프로젝트 도구의 배포 원본 |
| Core `AGENTS.md` | 사용자·조직 | 선택된 공통 지침 정본 |
| 프로젝트 `AGENTS.md` | 대상 프로젝트 | 적용된 공통 지침과 프로젝트 도메인 지침을 담는 최종 지침 파일 |
| 프로젝트 코드·테스트 | 대상 프로젝트 | 제품 동작과 도메인 검증 |

## 패키지 내부 검증

이 저장소의 `pnpm run check`는 문서 계약과 CLI 평가를 실행한다. 대상 프로젝트에 검증 실행기나 테스트를 주입하지 않는다. Core 지침에 검증 규칙을 선택하는 기능과 대상 프로젝트의 실제 검증은 별도 책임이다.
