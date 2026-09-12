import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /\]\((?:docs\/|CONTRIBUTING\.md|SECURITY\.md|CODE_OF_CONDUCT\.md)/);
  assert.match(readme, /https:\/\/github\.com\/IsthisLee\/agentic\/blob\/main\/docs\//);
});

test('repository exposes an installed-package smoke test', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['check:syntax'], 'node tools/check-syntax.mjs');
  assert.equal(packageJson.scripts['check:release'], 'node tools/check-release.mjs');
  assert.equal(packageJson.scripts['package:smoke'], 'node tools/package-smoke.mjs');
  assert.equal(packageJson.scripts.prepublishOnly, 'pnpm run check && pnpm run pack:check');
  assert.equal(packageJson.scripts.check, 'pnpm run check:syntax && pnpm run check:docs && pnpm test');
  assert(fs.existsSync(path.join(repoRoot, 'tools', 'package-smoke.mjs')));
  assert(fs.existsSync(path.join(repoRoot, 'tools', 'check-syntax.mjs')));
  assert(fs.existsSync(path.join(repoRoot, 'tools', 'check-release.mjs')));
});
