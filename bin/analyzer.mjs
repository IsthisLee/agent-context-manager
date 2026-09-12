import fs from 'fs';
import path from 'path';

/**
 * 프로젝트 디렉터리를 분석하여 프레임워크, 언어, DB/ORM, 패키지 매니저 등의 핵심 제약을 마크다운 목록으로 추출한다.
 * @param {string} targetDir - 분석할 대상 프로젝트 디렉터리 경로
 * @returns {string} 마크다운 형태의 제약 목록
 */
export function detectProjectConstraints(targetDir) {
  const constraints = [];

  // 1. package.json 읽기
  const pkgPath = path.join(targetDir, 'package.json');
  let deps = {};
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    } catch {}
  }

  // 2. 프레임워크 & 라우팅 분석
  if (deps.next) {
    const hasAppRouter = fs.existsSync(path.join(targetDir, 'app')) || fs.existsSync(path.join(targetDir, 'src', 'app'));
    const hasPagesRouter = fs.existsSync(path.join(targetDir, 'pages')) || fs.existsSync(path.join(targetDir, 'src', 'pages'));

    if (hasAppRouter) {
      constraints.push('* **프레임워크:** Next.js (App Router) — 기본적으로 React Server Components(RSC)로 동작하며, 상태(state)나 브라우저 훅 사용 시 파일 상단에 \'use client\'를 명시하라.');
    } else if (hasPagesRouter) {
      constraints.push('* **프레임워크:** Next.js (Pages Router) — pages/ 디렉터리 기반 라우팅 및 SSR/SSG 규약을 준수하라.');
    } else {
      constraints.push('* **프레임워크:** Next.js');
    }
  } else if (deps['@nestjs/core']) {
    constraints.push('* **프레임워크:** NestJS — Controller, Service, Module 모듈형 아키텍처 및 의존성 주입(DI) 패턴을 준수하라.');
  } else if (deps.vite) {
    constraints.push('* **빌드 도구/프레임워크:** Vite — 빠른 HMR 기반 프론트엔드 환경 (기본 포트: 5173).');
  } else if (deps.express) {
    constraints.push('* **백엔드 프레임워크:** Express.js');
  }

  // 3. 언어 (TypeScript 여부)
  const hasTsConfig = fs.existsSync(path.join(targetDir, 'tsconfig.json'));
  if (hasTsConfig || deps.typescript) {
    constraints.push('* **개발 언어:** TypeScript — tsconfig.json 설정을 준수하며, any 타입 사용을 지양하고 엄격한 타입 안정성을 유지하라.');
  } else {
    constraints.push('* **개발 언어:** JavaScript (Node.js 환경)');
  }

  // 4. 데이터베이스 및 ORM
  const hasPrisma = fs.existsSync(path.join(targetDir, 'prisma', 'schema.prisma')) || deps['@prisma/client'] || deps.prisma;
  const hasDrizzle = fs.existsSync(path.join(targetDir, 'drizzle.config.ts')) || fs.existsSync(path.join(targetDir, 'drizzle.config.js')) || deps['drizzle-orm'];

  if (hasPrisma) {
    constraints.push('* **데이터베이스/ORM:** Prisma — 모델 변경 시 prisma/schema.prisma를 수정하고 마이그레이션 명령(npx prisma migrate)을 필수 실행하라.');
  } else if (hasDrizzle) {
    constraints.push('* **데이터베이스/ORM:** Drizzle ORM — 선언적 스키마 정의 및 마이그레이션 규칙을 준수하라.');
  }

  // 5. 패키지 매니저 감지
  if (fs.existsSync(path.join(targetDir, 'pnpm-lock.yaml'))) {
    constraints.push('* **패키지 매니저:** pnpm — 의존성 추가 시 npm 대신 pnpm 명령어를 사용하라.');
  } else if (fs.existsSync(path.join(targetDir, 'yarn.lock'))) {
    constraints.push('* **패키지 매니저:** yarn — 의존성 추가 시 yarn 명령어를 사용하라.');
  } else if (fs.existsSync(path.join(targetDir, 'bun.lockb')) || fs.existsSync(path.join(targetDir, 'bun.lock'))) {
    constraints.push('* **패키지 매니저:** bun — 빠른 bun 런타임 및 패키지 명령을 사용하라.');
  } else {
    constraints.push('* **패키지 매니저:** npm — 표준 npm 명령어를 사용하라.');
  }

  return constraints.join('\n');
}

/**
 * 새 템플릿 내용과 기존 AGENTS.md 내용을 스마트 병합하여,
 * 사용자가 "## 4. 프로젝트 규칙 확장 (SSOT)" 아래에 작성해 둔 커스텀 규칙을 안전하게 보존한다.
 * @param {string} newTemplateContent - 렌더링된 새 AGENTS.md 템플릿 내용
 * @param {string} [existingContent] - 기존 프로젝트에 존재하던 AGENTS.md 내용
 * @returns {string} 병합된 최종 AGENTS.md 내용
 */
export function mergeAgentsMd(newTemplateContent, existingContent) {
  if (!existingContent || typeof existingContent !== 'string') {
    return newTemplateContent;
  }

  // 기존 파일에서 프로젝트 규칙 확장 헤더 검색
  const headerRegex = /## \d+\.\s*프로젝트 규칙 확장[^\n]*\n+/i;
  const match = existingContent.match(headerRegex);
  if (!match) {
    return newTemplateContent;
  }

  const contentAfterHeader = existingContent.slice(match.index + match[0].length).trim();
  if (!contentAfterHeader) {
    return newTemplateContent;
  }

  // 기본 설명 문구
  const defaultBoilerplate = '이 프로젝트에만 적용되는 도메인 규칙이나 아키텍처 제약은 오직 이 파일(`AGENTS.md`)의 하단이나 `docs/`에 추가하여 단일 정본으로 관리한다. 모든 에이전트는 이 규칙을 공통으로 따른다.';

  let customRules = '';
  if (contentAfterHeader.includes(defaultBoilerplate)) {
    const idx = contentAfterHeader.indexOf(defaultBoilerplate);
    customRules = contentAfterHeader.slice(idx + defaultBoilerplate.length).trim();
  } else {
    customRules = contentAfterHeader;
  }

  if (!customRules) {
    return newTemplateContent;
  }

  const cleanNew = newTemplateContent.trimEnd();
  return cleanNew + '\n\n' + customRules + '\n';
}

/**
 * 테스트 프레임워크가 없는 프로젝트(Cold Start)를 감지하여
 * Node 내장 테스트 러너(node --test)를 등록하고 기본 스모크 테스트 파일을 생성한다.
 * @param {string} targetDir - 대상 프로젝트 디렉터리 경로
 * @returns {void}
 */
export function ensureTestSetup(targetDir) {
  const pkgPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;

  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    if (!pkg.scripts) pkg.scripts = {};

    const testCmd = pkg.scripts.test || '';
    const needsTestSetup = !testCmd || testCmd.includes('no test specified') || testCmd.includes('exit 1');

    if (needsTestSetup) {
      pkg.scripts.test = 'node --test tests/**/*.test.mjs';
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`  ✓ Configured "test": "node --test tests/**/*.test.mjs" in package.json`);

      // 기본 스모크 테스트 파일 생성
      const testsDir = path.join(targetDir, 'tests');
      if (!fs.existsSync(testsDir)) {
        fs.mkdirSync(testsDir, { recursive: true });
      }

      const smokeFile = path.join(testsDir, 'smoke.test.mjs');
      if (!fs.existsSync(smokeFile)) {
        const smokeContent = `import test from 'node:test';
import assert from 'node:assert/strict';

test('harness verification smoke test', () => {
  assert.equal(true, true);
});
`;
        fs.writeFileSync(smokeFile, smokeContent);
        console.log(`  ✓ Created initial smoke test: tests/smoke.test.mjs`);
      }
    }
  } catch (err) {
    console.warn(`  ! Could not configure test setup: ${err.message}`);
  }
}
