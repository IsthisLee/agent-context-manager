# References

외부 연구와 오픈소스 도구의 사실을 기록하는 참고 문서다. 이 문서는 프로필 지침의 정본이 아니며, 제품 방향과 구현 계약의 근거로만 사용한다.

## 제품 방향에 반영하는 원칙

- 복잡한 에이전트 하네스는 작업·모델에 따라 비용과 지연을 크게 늘릴 수 있으므로, 기본 기능은 작게 유지하고 선택적으로 확장한다. [Anthropic Harness 연구](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- 테스트 실행 결과는 유용한 검증 신호지만, 요구사항 충족·지침 준수·제품 품질 전체의 증명은 아니다. 별도 grader나 사람 검토가 필요할 수 있다. [Anthropic Evals 설명](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- 루트 지침은 필요한 고신호 정보를 제공하고 상세 지침은 필요할 때 찾을 수 있게 구성한다. 특정 줄 수를 공식 기준으로 취급하지 않는다. [Anthropic Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [OpenAI AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

## 공개 npm·GitHub 저장소 운영 근거

- npm은 배포 패키지의 `files` 필드로 포함 파일을 제한할 수 있고, `npm pack --dry-run`으로 실제 포함 목록을 확인할 수 있다고 설명한다. README·LICENSE·package.json은 npm의 기본 포함 규칙이 있으므로, 배포물에 필요한 안내와 실행 파일을 별도로 점검한다. [npm `package.json` 문서](https://docs.npmjs.com/files/package.json), [npm publish 문서](https://docs.npmjs.com/cli/commands/npm-publish/)
- npm trusted publishing은 장기 토큰 대신 CI의 OIDC를 사용하고 provenance attestation을 생성한다. GitHub Actions에서 사용하려면 저장소·workflow·`repository.url`을 정확히 연결하고 publish job에 `id-token: write` 권한을 부여해야 한다. [npm Trusted publishing](https://docs.npmjs.com/trusted-publishers), [GitHub Node.js package publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages)
- GitHub는 공개 저장소의 community profile에서 README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT 같은 커뮤니티 건강 파일을 점검한다. 기여 안내는 저장소 루트·`docs`·`.github`에 둘 수 있으며, 공개 저장소 운영자는 이를 통해 기여 기대치를 명확히 할 수 있다. [GitHub community profile](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories), [GitHub contributing guidelines](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors)
- GitHub는 공개 저장소에서 Dependabot alerts, secret scanning, push protection, code scanning을 최소 보안 기준으로 권장하고, Dependency Review는 PR에 새 취약 의존성이 들어오는 것을 확인하는 게이트로 사용할 수 있다고 설명한다. [GitHub security settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository), [GitHub dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review)
- Node.js의 내장 `node:test`는 지원되는 LTS 런타임에서 안정적인 테스트 러너로 제공된다. Agentic은 Node.js 24 LTS 이상을 지원 기준으로 삼고, 저장소 평가는 별도 테스트 프레임워크 없이 이 러너로 실행한다. [Node.js test runner](https://nodejs.org/api/test.html), [Node.js 릴리스 일정](https://nodejs.org/en/about/previous-releases)

## 비교 대상

비교의 기준은 “에이전트가 무엇을 잘하게 하는가”와 “여러 프로젝트·에이전트에 공통 지침을 어떻게 배포하고 관리하는가”를 분리하는 것이다. Agentic은 후자에 초점을 둔다. 따라서 아래 도구들은 일부 기능이 겹쳐도 목적과 책임 범위가 다르며, 함께 사용할 수 있다.

| 도구 | 목적 | 중심 역할 | 주 활용 영역 | Agentic과의 차이 | Agentic과 함께 쓰는 판단 |
| --- | --- | --- | --- | --- | --- |
| **Agentic** | 여러 AI 에이전트가 동일한 프로젝트 개발 지침을 사용하도록 지원 | Personal·Company·Team·Workspace 단위의 프로필을 생성·설정하고, 공통 지침을 프로젝트와 여러 에이전트에 적용·동기화 | 여러 개발자·프로젝트·에이전트에 걸친 공통 개발 지침 관리 | 이 표의 비교 기준이다. 특정 에이전트의 스킬·런타임·팀 오케스트레이션을 제공하기보다, 지침의 정본·범위·선택·적용을 관리한다. | 단독으로 공통 지침의 생성·설정·적용을 맡는다. 필요한 경우 아래 도구를 역할별로 추가한다. |
| [Ruler](https://github.com/intellectronica/ruler) | 여러 코딩 에이전트에 규칙을 배포 | 중앙 규칙을 도구별 파일로 변환·동기화하고 적용 상태를 관리 | 단일 저장소의 다중 에이전트 규칙 배포 | Agentic의 가장 가까운 비교 대상이다. Agentic은 여기에 Personal·Company·Team·Workspace 단위의 프로필 생성·선택과 `profile setup` 기반 지침 구성을 제품의 중심으로 둔다. | 같은 대상 파일을 두 도구가 동시에 생성하면 충돌·drift가 생길 수 있다. 동일 프로젝트의 동기화 정본은 하나만 선택하고, 함께 쓸 때는 출력 경계를 분리한 뒤 검증해야 한다. |
| [agents-sync](https://www.npmjs.com/package/%40googlarz/agents-sync) | `AGENTS.md` 중심의 규칙 동기화와 drift 확인 | 정본과 대상 파일을 동기화하고 불일치를 검사 | 여러 에이전트 파일의 일관성 유지 | Agentic은 단순 파일 동기화 도구가 아니라 프로필의 수명주기, 선택적 지침 설정, 프로젝트 적용까지 포함하는 것을 목표로 한다. | Ruler와 마찬가지로 Agentic의 동기화와 중복 적용하지 않는다. Agentic을 프로필·적용 관리에 쓰고 agents-sync를 별도 drift CI로 쓰려면 어느 도구가 파일을 소유하는지 먼저 고정해야 한다. |
| [agents-lint](https://github.com/giacomo/agents-lint) | 에이전트 지침의 품질 문제 발견 | 지침 파일을 정적으로 분석해 모호성·중복·구조 문제를 진단 | `AGENTS.md` 등 지침 품질 관리 | agents-lint가 지침의 품질을 진단한다면, Agentic은 사용자가 선택한 공통 지침을 만들고 여러 에이전트에 전달하는 관리 계층이다. | Agentic이 생성·적용한 지침을 품질 관점에서 별도로 lint하는 보완 조합이 적합하다. 공식적인 Agentic 통합은 확인하지 않았으므로 CI 명령을 사용자가 직접 연결해야 한다. |
| [Harness Doctor](https://www.npmjs.com/package/%40andypai/harness-doctor) | 에이전트 하네스의 구성 상태 점검 | 하네스 파일·문서·설정의 문제를 찾아 진단 | 하네스 유지보수와 문제 해결 | Harness Doctor는 진단 도구이고, Agentic은 공통 지침을 생성·설정·적용하는 패키지다. Agentic이 자체 진단을 제공하더라도 하네스 런타임을 소유하거나 감싸는 것을 목표로 하지 않는다. | 적용 후 대상 프로젝트의 하네스 상태를 독립적으로 점검하는 용도로 함께 사용할 수 있다. 다만 두 도구의 진단 결과를 하나의 성공 판정으로 간주하지 말고 각각의 검사 범위를 보고해야 한다. |
| [Everything Claude Code (ECC)](https://github.com/affaan-m/ECC) | 에이전트의 개발 능력과 작업 방법을 확장 | 전문 에이전트, 스킬, 명령, 훅, 규칙, 메모리·보안 도구와 워크플로를 제공하며 여러 하네스에 어댑터를 제공 | Claude Code 중심의 에이전트 작업 자동화·전문화, Codex 등 인접 하네스 지원 | ECC는 에이전트가 계획·구현·리뷰·보안·도메인 작업을 수행하도록 기능과 방법론을 제공한다. Agentic은 ECC 같은 도구를 실행·통제하지 않고, 조직·팀·프로젝트가 선택한 공통 개발 지침을 프로필에서 관리해 여러 에이전트와 프로젝트에 적용하는 데 집중한다. | ECC는 선택한 에이전트의 능력·워크플로를 제공하고 Agentic은 조직·프로젝트 공통 지침을 관리하는 식으로 역할을 나눌 수 있다. ECC 지침을 프로필에 자동 수입하는 공식 계약은 확인하지 않았으므로, 채택할 내용은 검토 후 별도로 복사·정리해야 한다. |
| [GitHub Spec Kit](https://github.com/github/spec-kit) | 명세 중심 개발을 돕기 | 요구사항·설계·구현으로 이어지는 spec-driven 개발 템플릿과 흐름 제공 | 신규 기능의 명세화와 계획 수립 | Spec Kit은 기능 개발 방법론과 산출물에 초점을 둔다. Agentic은 특정 명세 방법론을 강제하지 않고, 프로젝트가 선택한 공통 지침을 에이전트별 파일로 적용하는 기반을 제공한다. | Spec Kit의 명세·계획 산출물을 프로젝트 도메인 작업에 사용하고, Agentic으로 그 프로젝트의 공통 지침을 여러 에이전트에 적용하는 조합이 자연스럽다. 이는 역할 분리에 따른 활용 방식이며 공식 Agentic 플러그인 통합을 뜻하지 않는다. |
| [obra/superpowers](https://github.com/obra/superpowers) | 에이전트의 개발 작업 품질과 습관 개선 | 스킬과 개발 방법론을 조합해 계획·구현·검토 흐름을 안내 | 에이전트 주도 개발 프로세스와 재사용 스킬 | superpowers는 에이전트가 작업하는 방법을 제공하고, Agentic은 그런 방법론을 프로필에 선택적으로 포함·관리하고 여러 에이전트에 전달하는 역할을 맡는다. | Superpowers를 특정 에이전트의 작업 방법으로 사용하고, Agentic에는 팀·프로젝트가 실제로 채택한 공통 규칙만 관리한다. 양쪽의 자동 동기화나 공식 연동은 확인하지 않았으므로 동일 규칙을 양쪽에 중복 관리하지 않는다. |
| [revfactory/harness](https://github.com/revfactory/harness) | Claude Code에서 에이전트 팀 패턴을 쉽게 구성 | 팀·전문 에이전트·스킬과 실행 모드를 제공 | 복잡하거나 병렬화 가능한 작업의 역할 분담·오케스트레이션 | revfactory/harness는 특정 에이전트 런타임 안의 팀 실행 방식에 가깝다. Agentic은 런타임 래퍼나 오케스트레이터를 만들지 않고, 단일 에이전트 작업과 선택적 리뷰·팀 분업 모두에 적용될 공통 지침을 관리한다. | Agentic이 공통 작업·안전·문서 지침을 제공하고, 복잡한 작업에서만 Harness가 Claude Code 팀 실행을 담당하는 조합이 가능하다. Harness는 Claude Code 전용 공식 런타임이며, Agentic이 이를 다른 에이전트에서 실행해 주는 것은 아니다. |

### 함께 사용하기 전 확인할 규칙

위의 “함께 쓰는 판단”은 공식 통합을 의미하지 않는다. 각 도구의 공식 설명에서 확인되는 책임 범위를 기준으로 한 조합 가이드이며, Agentic과의 직접 연동·자동 변환·호환성을 주장하지 않는다. 실제로 함께 도입할 때는 다음을 먼저 확정한다.

1. **정본 소유자:** 같은 `AGENTS.md`, `CLAUDE.md` 또는 기타 에이전트 파일을 둘 이상의 생성기가 수정하지 않도록 정본과 생성기를 하나만 정한다.
2. **실행 책임:** ECC·Superpowers·revfactory/harness처럼 에이전트의 작업 방식이나 팀 실행을 바꾸는 도구와, Agentic처럼 공통 지침을 배포하는 도구의 책임을 분리한다.
3. **검증 책임:** lint·doctor·프로젝트 테스트는 각각 검사 대상과 실패 의미가 다르므로 한 도구의 통과를 다른 도구의 품질 보증으로 해석하지 않는다.
4. **도입 순서:** 먼저 Agentic으로 공통 지침의 범위와 적용 파일을 확정하고, 그 다음 필요한 프로젝트에 방법론·스킬·팀 실행·진단 도구를 선택적으로 추가한다.

### Agentic을 선택할 상황

다음 요구가 있으면 Agentic의 책임 범위와 직접 맞는다.

1. Claude Code, Codex, Gemini, Cursor, Copilot 등 여러 에이전트를 같은 프로젝트에서 사용하고, 도구가 바뀌어도 공통 개발 지침을 유지해야 한다.
2. 개인·회사·팀·workspace처럼 서로 다른 범위의 공통 지침을 여러 개 만들고, 프로젝트별로 적용할 프로필을 선택해야 한다.
3. 공통 지침과 프로젝트 도메인 지침을 분리하고, 공통 지침은 한 곳에서 관리하면서 프로젝트에는 필요한 형태로 적용해야 한다.
4. TDD, 리뷰, 검증, 문서화, 보안 등 지침을 한 번에 고정하지 않고 프로필 생성 후 선택적으로 구성해야 한다.
5. 특정 에이전트의 CLI·런타임에 종속되는 실행기를 직접 유지하지 않고, 각 에이전트가 읽는 지침 파일과 프로젝트의 표준 명령을 활용하고 싶다.

다음 목적만 있다면 Agentic을 추가하기보다 해당 도구가 더 직접적이다.

- Claude Code 안에서 전문 에이전트·스킬·훅·작업 자동화를 바로 확장하려면 ECC 또는 revfactory/harness
- 여러 에이전트용 규칙 파일을 이미 갖고 있고 배포·drift 검사만 필요하면 Ruler 또는 agents-sync
- 지침의 모호성·중복·품질 진단이 목적이면 agents-lint 또는 Harness Doctor
- 명세 작성부터 기능 구현까지의 특정 개발 방법론이 목적이면 GitHub Spec Kit 또는 obra/superpowers

즉, Agentic은 위 도구들을 대체하는 통합 실행 환경이 아니라, 선택한 규칙과 방법론을 프로필에 담아 여러 에이전트·개발자·프로젝트에 일관되게 적용하는 공통 지침 관리 계층이다.

## 해석 규칙

외부 자료가 TDD, Solo, 멀티 에이전트, 검증을 언급하더라도 Agentic의 규칙으로 자동 채택하지 않는다. 제품 목표와 사용자 선택권에 부합하는지 검토한 뒤, 채택한 규칙만 프로필의 `AGENTS.md`와 템플릿에 반영한다.
