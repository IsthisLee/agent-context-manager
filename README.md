# Agentic Development Environment

에이전틱 개발 환경의 범용 설계와 구축 프롬프트를 관리하는 독립 환경 루트다.

**위치:** `/Users/isthis/Documents/task/agentic-dev`  
**상태:** 설계 문서 배치 완료 · Core 런타임/에이전트 설정/CI 구축 전

## 시작하기

1. [전체 안내](docs/agentic/README.md)에서 구조와 구축 순서를 읽는다.
2. [환경 설계서](docs/agentic/01-blueprint.md)에서 Core·Adapter·실행 기록의 경계를 확인한다.
3. [구현 프롬프트](docs/agentic/02-implementation-prompts.md)에 실제 경로를 지정하고 0~10단계를 진행한다.
4. 적용 대상이 없으면 합성 예제 프로젝트로 시작한다. 다른 업무 저장소를 자동 선택하지 않는다.

## 책임과 저장 위치

| 구분 | 저장 위치 | 포함할 내용 |
|---|---|---|
| 범용 환경/Core | 이 루트 | 범용 계약·runner·provider·템플릿·합성 평가 |
| 프로젝트 Adapter | 각 프로젝트 저장소 | 해당 도메인·검사 명령·배포/연동 제약·적용 문서 |
| 프로젝트 실행 기록 | 프로젝트 전용 비공개 경로 | task·checkpoint·증거·브라우저 기록 |
| 기존 혼합 문서와 이동 대조 기록 | 원래 프로젝트 내부 | 원본·해시·문단별 이동 경로; 이 환경으로 반출하지 않음 |

## 구조

```text
agentic-dev/
├── README.md
└── docs/
    └── agentic/
        ├── README.md
        ├── 01-blueprint.md
        ├── 02-implementation-prompts.md
        └── 03-sources.md
```

`packages/`, `templates/`, `evals/`, `provenance/`는 후속 Core 구현 단계에서 만든다. Git 초기화·원격 저장소·의존성 설치는 아직 수행하지 않았다.

프로젝트 세션에는 필요한 범용 문서/고정 릴리스만 읽기 전용으로 제공한다. 프로젝트 정보가 포함된 세션에서 이 루트의 Core를 개발하지 않는다. 이 루트와 제품의 `PROJECT_ROOT`, 실행 기록의 `PROJECT_STATE_ROOT`는 서로 다른 경로다.

## 문서 규약

`agentic-core`는 범용 Core 구성요소의 명칭이며, 실제 환경 폴더는 `agentic-dev`다. `.agentic/`와 `agentic` 명령은 설계상 규약이며 아직 자동 동작하는 내장 기능이 아니다. 프로젝트 언어/패키지 관리자를 강제하지 않고 Adapter에 실행 명령을 연결한다.
