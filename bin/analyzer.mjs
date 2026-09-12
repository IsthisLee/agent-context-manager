import fs from 'fs';
import path from 'path';

/**
 * detectProjectConstraints
 * 프로젝트 디렉터리를 분석하여 프레임워크, 언어, DB/ORM, 패키지 매니저 등의 핵심 제약을 마크다운 목록으로 추출한다.
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
