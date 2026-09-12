import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliScript = path.resolve(__dirname, '../bin/agentic.mjs');

test('agentic sync handles cold start and preserves user custom rules', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-sync-e2e-'));

  try {
    // 1. Setup minimal package.json without tests (Cold Start)
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'e2e-coldstart-app',
      version: '1.0.0'
    }, null, 2));

    // Run agentic sync
    execSync(`node "${cliScript}" sync "${tempDir}"`, { encoding: 'utf-8' });

    // Verify Cold Start resolution (Item 2)
    const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
    assert.equal(pkg.scripts.test, 'node --test tests/**/*.test.mjs');
    assert.equal(pkg.scripts.check, 'node tools/agentic/check.mjs');
    assert.ok(fs.existsSync(path.join(tempDir, 'tests', 'smoke.test.mjs')));

    // Verify directives created
    const agentsPath = path.join(tempDir, 'AGENTS.md');
    assert.ok(fs.existsSync(agentsPath));
    assert.ok(fs.existsSync(path.join(tempDir, 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(tempDir, '.gemini/rules/agentic.md')));
    assert.ok(fs.existsSync(path.join(tempDir, '.cursor/rules/agentic.mdc')));
    assert.ok(fs.existsSync(path.join(tempDir, '.github/copilot-instructions.md')));

    // 2. User appends custom domain rule (Item 1)
    const customRule = '\n### 결제 모듈 규칙 (커스텀)\n* 토스페이먼츠 샌드박스 키를 사용할 것.\n';
    fs.appendFileSync(agentsPath, customRule);

    // Run agentic sync again
    execSync(`node "${cliScript}" sync "${tempDir}"`, { encoding: 'utf-8' });

    // Verify custom rule is preserved after sync
    const resyncedAgents = fs.readFileSync(agentsPath, 'utf-8');
    assert.ok(resyncedAgents.includes('### 결제 모듈 규칙 (커스텀)'), 'Custom rule header must be preserved');
    assert.ok(resyncedAgents.includes('토스페이먼츠 샌드박스 키를 사용할 것.'), 'Custom rule body must be preserved');

    // 3. Verify check works deterministically
    const checkResult = spawnSync('npm', ['run', 'check'], { cwd: tempDir, encoding: 'utf-8' });
    assert.equal(checkResult.status, 0);
    assert.ok(checkResult.stdout.includes('Verification PASSED'));
    assert.doesNotMatch(checkResult.stderr, /node:test run\(\) is being called recursively/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
