import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { detectProjectConstraints } from '../bin/analyzer.mjs';

test('detectProjectConstraints detects Next.js App Router, TypeScript, and Prisma', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-analyzer-test-'));

  try {
    // 1. Setup mock project
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'my-next-app',
      dependencies: {
        next: '^14.2.0',
        react: '^18.3.0'
      }
    }));
    fs.mkdirSync(path.join(tempDir, 'app'));
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
    fs.mkdirSync(path.join(tempDir, 'prisma'));
    fs.writeFileSync(path.join(tempDir, 'prisma', 'schema.prisma'), 'datasource db { provider = "postgresql" }');
    fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');

    // 2. Run detector
    const constraints = detectProjectConstraints(tempDir);

    // 3. Verify assertions
    assert.ok(constraints.includes('Next.js (App Router)'), 'Should detect Next.js App Router');
    assert.ok(constraints.includes('Server Components'), 'Should include Server Components constraint');
    assert.ok(constraints.includes('TypeScript'), 'Should detect TypeScript');
    assert.ok(constraints.includes('Prisma'), 'Should detect Prisma');
    assert.ok(constraints.includes('pnpm'), 'Should detect pnpm');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
