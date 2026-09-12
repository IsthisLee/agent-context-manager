# Agent Runtime Boundary

Agentic은 Claude Code, Codex, Antigravity 등 벤더 에이전트 런타임을 감싸거나 대체하지 않는다. 벤더 CLI의 플래그, 인증, 세션, 출력 스트림, 컨텍스트 압축은 Core의 안정적인 API가 아니므로 직접 관리하면 유지보수와 호환성 위험이 커진다.

```text
Agentic이 소유:
  프로젝트 분석, 지침 생성·동기화, 역할·위험도 정책,
  계획·검토 artifact, npm run check와 검증 증거

공식 런타임이 소유:
  모델 호출, CLI 플래그, 인증, stdout/stderr 스트리밍,
  세션·컨텍스트 압축, 에이전트 간 통신
```

Core에는 다음을 추가하지 않는다.

* `agentic run` 같은 자체 실행기
* 벤더별 CLI 플래그 어댑터와 stdout/stderr 파서
* 인증 토큰·세션·컨텍스트 압축 관리
* 특정 벤더의 비공개 동작을 전제로 한 오케스트레이션

향후 `agentic analyze`는 읽기 전용 분석만 하고, `agentic plan`은 역할 선택과 artifact 생성만 한다. 가상 팀 선택은 공식 런타임에서 수행할 역할을 선언하는 것이며 Agentic이 런타임을 조정한다는 뜻이 아니다. `check.mjs`는 대상 프로젝트의 표준 검증 계약을 실행할 뿐 런타임 래퍼가 아니다.
