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

현재 CLI는 Core를 생성·목록화·설정하고, 선택한 Core를 대상 프로젝트에 적용한다. 적용 시 프로젝트 `AGENTS.md`의 도메인 규칙 확장 영역을 보존하며, Agentic이 관리하는 에이전트별 포인터 파일은 `init/sync` 때 재생성한다. 다음 `sync`에서는 `agentic.project.json`의 Core를 사용한다.

## 소유권

| 영역 | 소유자 | 설명 |
| --- | --- | --- |
| 패키지 템플릿 | Agentic 저장소 | 기본 포인터와 프로젝트 도구의 배포 원본 |
| Core `AGENTS.md` | 사용자·조직 | 선택된 공통 지침 정본 |
| 프로젝트 `AGENTS.md` | 대상 프로젝트 | 적용된 공통 지침과 프로젝트 도메인 지침을 담는 최종 지침 파일 |
| 프로젝트 코드·테스트 | 대상 프로젝트 | 제품 동작과 도메인 검증 |

## 패키지 내부 검증

이 저장소의 `pnpm run check`는 문서 계약과 CLI 평가를 실행한다. 대상 프로젝트에 검증 실행기나 테스트를 주입하지 않는다. Core 지침에 검증 규칙을 선택하는 기능과 대상 프로젝트의 실제 검증은 별도 책임이다.
