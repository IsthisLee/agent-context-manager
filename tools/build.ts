#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * npm 패키지용으로 `src/`를 `dist/`에 컴파일한다. 게시하는 패키지는 JavaScript여야 한다. Node는
 * node_modules 아래 파일의 TypeScript 타입을 지우지 않는다.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// `typescript` 이름에는 typescript-eslint가 쓰는 6.0 호환 패키지가 있어서, 컴파일은 7.0을 가리키는 별칭으로 한다(ADR 0040).
const tsc = path.join(repoRoot, 'node_modules', '@typescript', 'native', 'bin', 'tsc');

// 빈 dist/에서 시작해서, src/에서 지운 파일이 패키지에 남지 않게 한다.
fs.rmSync(path.join(repoRoot, 'dist'), { recursive: true, force: true });
// `npm pack --json`은 stdout을 JSON으로 해석하므로, 컴파일러 출력과 이 알림은 stderr로 보낸다.
execFileSync(process.execPath, [tsc, '-p', path.join(repoRoot, 'tsconfig.build.json')], { stdio: ['ignore', 2, 2] });
console.error('Built dist/ from src/.');
