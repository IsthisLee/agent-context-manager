import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('documentation checker validates the repository documentation contracts', () => {
  const result = spawnSync('node', ['tools/check-docs.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Documentation check passed/);
});

test('documentation checker validates architecture discussion topics beneath their index', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.mjs'), 'utf8');

  assert.match(checker, /path\.join\(discussionDir, 'topics'\)/);
});
