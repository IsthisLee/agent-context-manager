import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('npm package contains only runtime assets and the package README', () => {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const [{ files }] = JSON.parse(result.stdout);
  const paths = files.map(file => file.path);

  assert(paths.includes('README.md'));
  assert(paths.some(file => file.startsWith('bin/')));
  assert(paths.some(file => file.startsWith('templates/')));
  assert(!paths.some(file => file.startsWith('docs/')));
  assert(!paths.some(file => file.startsWith('evals/')));
});
