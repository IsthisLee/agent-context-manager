#!/usr/bin/env node

/**
 * check.mjs - 결정론적 자가 검증 러너
 * 프로젝트의 테스트/린트를 실행하고 기계 판독 가능한 증거를 생성한다.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const startTime = Date.now();

// 1. 실행할 검사 명령 결정
let cmd = 'npm';
let args = ['test'];

// 커스텀 명령 인수가 주어진 경우 지원 (예: node tools/agentic/check.mjs --cmd "npm run lint")
const cmdIdx = process.argv.indexOf('--cmd');
if (cmdIdx !== -1 && process.argv[cmdIdx + 1]) {
  const parts = process.argv[cmdIdx + 1].split(' ');
  cmd = parts[0];
  args = parts.slice(1);
}

console.log(`[Agentic Check] Running verification: ${cmd} ${args.join(' ')}`);

// node --test 내부에서 실행돼도 대상 프로젝트의 테스트는 독립 프로세스로 실행한다.
// Node의 내부 테스트 컨텍스트를 전달하면 중첩 테스트 실행으로 오인할 수 있다.
const childEnv = { ...process.env };
delete childEnv.NODE_TEST_CONTEXT;

const result = spawnSync(cmd, args, {
  cwd,
  stdio: 'inherit',
  env: childEnv
});

const durationMs = Date.now() - startTime;
const exitCode = result.status ?? (result.error ? 1 : 0);
const success = exitCode === 0;

const summary = {
  timestamp: new Date().toISOString(),
  command: `${cmd} ${args.join(' ')}`,
  exitCode,
  durationMs,
  success
};

// 증거 요약 파일 생성 (gitignored 경로)
const evidenceDir = path.join(cwd, '.agentic');
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}
fs.writeFileSync(path.join(evidenceDir, 'last-check.json'), JSON.stringify(summary, null, 2));

console.log('\n-----------------------------------');
if (success) {
  console.log(`✓ Verification PASSED in ${durationMs}ms (exit code 0)`);
} else {
  console.error(`✗ Verification FAILED in ${durationMs}ms (exit code ${exitCode})`);
}
console.log('-----------------------------------');

process.exit(exitCode);
