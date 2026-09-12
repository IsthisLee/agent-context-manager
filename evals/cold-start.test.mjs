import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ensureTestSetup } from '../bin/analyzer.mjs';

test('ensureTestSetup creates smoke test and registers test script for empty project', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-coldstart-test-'));

  try {
    // Mock package.json without a working test script
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'empty-test-app',
      scripts: {
        test: 'echo "Error: no test specified" && exit 1'
      }
    }, null, 2));

    // Run setup
    ensureTestSetup(tempDir);

    // Verify package.json test script updated to native node --test
    const updatedPkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
    assert.equal(updatedPkg.scripts.test, 'node --test tests/**/*.test.mjs');

    // Verify smoke test file created
    const smokeFile = path.join(tempDir, 'tests', 'smoke.test.mjs');
    assert.ok(fs.existsSync(smokeFile), 'Smoke test file must exist');

    const smokeContent = fs.readFileSync(smokeFile, 'utf-8');
    assert.ok(smokeContent.includes('smoke test'), 'Smoke test should have test definition');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ensureTestSetup preserves a project that has test files but no test script', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-existing-test-'));

  try {
    const packageJson = {
      name: 'existing-test-app',
      scripts: {
        test: 'echo "Error: no test specified" && exit 1'
      }
    };
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const existingTestDir = path.join(tempDir, 'src');
    fs.mkdirSync(existingTestDir);
    fs.writeFileSync(path.join(existingTestDir, 'widget.test.mjs'), "import test from 'node:test';\n");

    ensureTestSetup(tempDir);

    const updatedPkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
    assert.equal(updatedPkg.scripts.test, packageJson.scripts.test);
    assert.equal(fs.existsSync(path.join(tempDir, 'tests', 'smoke.test.mjs')), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
