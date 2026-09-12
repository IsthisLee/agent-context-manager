import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const doctorScript = path.resolve(__dirname, '../tools/agentic/doctor.mjs');

test('doctor checks AGENTS.md size and warns when exceeding 150 lines', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-doctor-test-'));

  try {
    // 1. Case: Normal size (under 150 lines)
    const normalAgents = Array(50).fill('rule line').join('\n');
    fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), normalAgents);

    const normalOut = JSON.parse(execSync(`node "${doctorScript}" --json`, { cwd: tempDir, encoding: 'utf-8' }));
    const normalCheck = normalOut.checks.find(c => c.name === 'AGENTS.md Size');
    assert.ok(normalCheck, 'AGENTS.md Size check should be present');
    assert.equal(normalCheck.status, 'PASS');
    assert.ok(normalCheck.detail.includes('50 lines'));

    // 2. Case: Bloated size (> 150 lines)
    const bloatedAgents = Array(160).fill('excessive rule line').join('\n');
    fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), bloatedAgents);

    const bloatedOut = JSON.parse(execSync(`node "${doctorScript}" --json`, { cwd: tempDir, encoding: 'utf-8' }));
    const bloatedCheck = bloatedOut.checks.find(c => c.name === 'AGENTS.md Size');
    assert.ok(bloatedCheck, 'AGENTS.md Size check should be present');
    assert.equal(bloatedCheck.status, 'WARN');
    assert.ok(bloatedCheck.detail.includes('160 lines'));
    assert.ok(bloatedCheck.detail.includes('docs/'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('doctor reports a non-Git directory without leaking Git errors to stderr', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-doctor-no-git-test-'));

  try {
    fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), 'rule line');
    const result = spawnSync(process.execPath, [doctorScript, '--json'], {
      cwd: tempDir,
      encoding: 'utf-8'
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout);
    const gitCheck = report.checks.find(check => check.name === 'Git Repository');
    assert.equal(gitCheck.status, 'WARN');
    assert.equal(gitCheck.detail, 'Not a git repository or git not found');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
