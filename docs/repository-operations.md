# 공개 저장소 운영

이 문서는 Agentic 저장소를 공개 npm 패키지 프로젝트로 관리하는 현재 운영 계약이다. 제품 기능의 정본은 [`product-direction.md`](product-direction.md), 현재 코드 구조의 정본은 [`architecture/`](architecture/), 외부 근거는 [`references.md`](references.md)에 둔다. 문서 변경 절차는 [구현 계약 및 문서 규칙](discussion/architecture/topics/implementation-contracts.md)을 따른다.

현재 준비 상태는 “공개 전 품질 체계 구성”이다. GitHub 원격 저장소의 실제 visibility는 아직 private이고, `@isthis/agentic`도 npm registry에 게시되지 않았다. 공개 전환과 첫 배포는 아래 사전 점검을 모두 통과한 뒤 저장소 관리자 권한으로 수행한다.

## 품질 게이트

모든 변경은 다음 순서로 확인한다.

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run pack:check
pnpm run audit
pnpm run package:smoke
```

`pnpm run check`는 Node.js 문법 검사, 문서 계약 검사, Node.js 테스트 러너 기반 평가를 실행한다. `pnpm run pack:check`는 npm tarball에 들어갈 파일 목록을 확인해 개발 문서·평가·로컬 파일이 배포물에 섞이지 않는지 검토한다. 배포물에 포함되는 README의 저장소 문서 링크는 GitHub 절대 링크를 사용해 npm 페이지에서도 깨지지 않도록 유지한다. 이 검사는 패키지 동작과 저장소 문서 계약을 확인하지만, 모든 제품 요구사항·보안·사용자 경험을 증명하지는 않는다.
`pnpm run audit`는 의존성 취약점이 high 이상으로 보고되는 경우 실패한다. 이 검사는 알려진 취약점 신호이며, 악성 코드·설정 오류·런타임 전체의 안전을 보증하지 않는다.
`pnpm run package:smoke`는 실제 npm tarball을 임시 소비자 프로젝트에 설치하고 설치된 `agt help`, Core 생성·설정, 프로젝트 `init`·`sync`까지 실행한다. 저장소 소스가 아니라 배포 산출물의 설치·핵심 실행 경로를 확인하는 검사다. 프로젝트 적용·동기화는 현재 `AGENTS.md`의 Core 영역과 에이전트별 관리 블록을 사용자 영역과 분리해 갱신하고, 대상 preflight·dry-run·수동 수정 충돌 중단·파일 단위 원자적 교체를 제공한다. 여러 파일 전체 롤백·충돌 시각화·복구는 후속 안전 동기화 계약으로 관리한다.

GitHub Actions의 `CI`는 Ubuntu에서 Node.js 24 LTS·26 Current를, macOS와 Windows에서 Node.js 24 LTS를 고정된 pnpm 버전으로 검증한다. 저장소 루트의 `.nvmrc`는 기여자의 기본 로컬 런타임을 Node.js 24로 맞춘다. PR은 CI가 실패한 상태로 병합하지 않는다. 의존성·워크플로 변경은 보안 영향을 함께 검토한다.

저장소 루트의 `.editorconfig`와 `.gitattributes`는 편집기·운영체제에 따른 인코딩, 줄바꿈, 공백 차이를 줄이는 기본 파일 형식 계약이다.

## 릴리스

### 공개 전 사전 점검

- GitHub repository visibility를 Public으로 전환하고, README·License·Contributing·Code of Conduct·Security가 실제 화면에서 노출되는지 확인한다.
- `repository.url`이 실제 공개 저장소 URL과 일치하는지 확인한다.
- npm에서 패키지 이름과 scope 소유권을 확인하고, public package로 게시할 권한을 준비한다.
- npm trusted publisher에 정확한 저장소와 `.github/workflows/publish.yml`을 연결한다.
- 첫 배포 전에 `pnpm run check`, `pnpm run pack:check`, `pnpm run audit`와 임시 디렉터리 설치 smoke test를 실행한다.
- `npm publish` 자체도 `prepublishOnly`에서 `pnpm run check`와 `pnpm run pack:check`를 실행하므로, 검증되지 않은 로컬 게시를 기본적으로 차단한다.
- Release tag가 `package.json` 버전 및 `CHANGELOG.md` 항목과 일치하는지 `pnpm run check:release -- v<version>`으로 확인한다.

이 항목은 workflow 파일만으로 자동 완료되지 않는다. GitHub·npm 관리 화면의 실제 설정과 최초 게시 결과를 릴리스 기록에 남긴다.

1. 변경 내용을 `CHANGELOG.md`의 `Unreleased`에서 검토하고 버전을 Semantic Versioning에 맞게 결정한다.
2. 버전·변경 이력을 커밋하고 해당 버전의 Git tag와 GitHub Release를 만든다.
3. Release가 published 상태가 되면 `Publish to npm` workflow가 다시 `check`와 package 파일 검사를 실행한다.
4. 검사가 통과하면 npm trusted publishing과 provenance를 사용해 `@isthis/agentic`을 public으로 배포한다.
5. 배포 후 `npm install --global @isthis/agentic`와 `agt help`을 별도 임시 디렉터리에서 확인하고, GitHub Release와 npm 버전이 일치하는지 확인한다.

배포 workflow에는 장기 npm 토큰을 저장하지 않는다. npm trusted publishing을 사용할 수 없는 환경에서는 별도 보안 검토 없이 토큰 방식을 추가하지 않는다.

## 의존성과 보안

- Dependabot은 npm 의존성과 GitHub Actions 참조를 주기적으로 확인한다.
- 공개 저장소의 PR에는 Dependency Review를 활성화하고, 취약한 의존성 도입 여부를 검토한다.
- CodeQL workflow는 JavaScript 변경을 security-extended 쿼리로 분석한다.
- GitHub의 secret scanning, push protection, code scanning을 저장소 설정에서 활성화한다.
- `SECURITY.md`의 비공개 신고 절차를 통해 취약점을 접수한다.
- GitHub Actions는 필요한 최소 권한만 선언한다. 배포 workflow만 `id-token: write`를 사용한다.
- 모든 외부 GitHub Action은 검토한 버전의 불변 commit SHA로 고정하고 버전 주석을 함께 둔다. 모든 checkout 단계에서 `persist-credentials: false`를 사용해 workflow 작업 공간에 GitHub token을 유지하지 않는다.
- [`CODEOWNERS`](../.github/CODEOWNERS)는 기본 브랜치와 저장소 자동화 변경의 기본 검토 소유자를 지정한다. 실제 병합 보호와 required review 적용은 GitHub 저장소 설정에서 별도로 활성화한다.

## 기여와 변경 관리

기여자는 [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md), [`SECURITY.md`](../SECURITY.md)를 따른다. 사용자에게 보이는 CLI·TUI·파일 형식·설치·보안 변경은 README, 관련 정본 문서, `CHANGELOG.md`를 같은 변경에서 갱신한다. 되돌리기 어려운 공개 계약은 [`docs/adr/`](adr/)에 기록한다.

## 운영상 한계

GitHub 저장소 설정(브랜치 보호, required status checks, secret scanning, code scanning, npm trusted publisher 연결)은 파일만으로 완성되지 않으며 저장소 관리자 설정이 필요하다. workflow 파일은 그 설정을 사용할 수 있는 실행 경로를 제공하지만, 설정이 실제로 켜졌다는 증거는 GitHub 저장소 상태에서 별도로 확인해야 한다.
