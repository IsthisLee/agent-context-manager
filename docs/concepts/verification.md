# 전달 확인과 검증의 범위

<!-- agctx-doc-sources: src/verify, src/check.ts, src/explain.ts -->
<!-- agctx-doc-sources-sha256: 9683971c034b1ea5d26901cad3a1bf5a03039ecfa4502b9d4d74fb1caf98e127 -->

agctx가 확인하는 것은 세 층이다. 층마다 증거가 다르므로 필요한 만큼만 쓴다.

| 명령 | 확인하는 것 | 증거 | 에이전트 실행 |
| --- | --- | --- | --- |
| `check` | 저장소 파일이 기록한 프로필 버전·관리 영역과 맞는가 | 관리 영역 hash, 원천 커밋 | 없음 |
| `explain` | 한 폴더에서 시작한 에이전트가 규칙상 읽는 파일 | 에이전트별 문서화된 로드 규칙과 실측 | 없음 |
| `verify` | 에이전트가 그 파일을 실제로 받았는가 | 세션 기록, 또는 `--probe`의 표지 줄 | `--probe`일 때만 |

## 실제로 들어갔는지 확인하기

그 폴더에서 Codex나 Claude Code를 한 번 쓴 뒤 `verify`를 실행하면, 에이전트가 이 컴퓨터에 남긴 세션 기록에서 기대한 파일이 들어갔는지 본다. 아래 출력은 실제 결과에서 경로만 바꿨다.

```bash
$ agctx verify --agent claude /work/shop
claude       pass         session log /Users/me/.claude/projects/-work-shop/0f1c2d3e-….jsonl
  delivered  CLAUDE.md
  delivered  AGENTS.md
```

기록이 없거나 지침을 읽은 뒤 파일을 고쳤다면 판정하지 않고 `no-evidence`로 알린다. Antigravity는 agctx가 기록을 읽지 못해 항상 `no-evidence`다. 이럴 때는 `--probe`로 에이전트에게 직접 묻는다. 아래는 설치된 세 에이전트 CLI로 실제로 실행한 결과다.

```bash
$ agctx verify services/payments --probe --yes
codex        pass         asked codex with marker lines in a scratch copy
  delivered  AGENTS.md
  delivered  services/payments/AGENTS.md
claude       pass         asked claude with marker lines in a scratch copy
  delivered  CLAUDE.md
antigravity  pass         asked agy with marker lines in a scratch copy
  delivered  AGENTS.md
  delivered  .agents/rules/agctx.md
```

probe는 실제 저장소 대신 임시 사본에서 에이전트 CLI를 도구 없이 한 번씩 실행하고, 파일마다 붙인 표지 줄을 되풀이하는지 본다. 에이전트 요금제나 API 사용량이 들므로 터미널에서는 실행 전에 묻고, 스크립트에서는 `--yes`가 있어야 실행한다. 판정 방법과 실행 명령은 [CLI Reference](../reference/cli.md#verify)에 있다.

## 검증하지 않는 것

- agctx 저장소의 `pnpm run check`는 agctx 자체의 형식·문서·평가를 확인할 뿐, 대상 프로젝트의 테스트를 대신 실행하지 않는다.
- 에이전트가 지침을 받았다는 것과 지침대로 행동한다는 것은 다르다. agctx는 행동을 강제하지 않는다.
- 세션 기록 형식은 에이전트의 공개 계약이 아니다. 형식이 바뀌면 `verify`가 `no-evidence`를 더 자주 낼 수 있다. 근거는 [ADR 0019](../adr/0019-explain-verify-and-agent-skills.md)에 있다.
