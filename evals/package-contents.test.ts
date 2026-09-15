import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('npm package contains only runtime assets and the package README', () => {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['pack', '--dry-run', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);

  const [{ files }]: [{ files: { path: string }[] }] = JSON.parse(result.stdout);
  const paths = files.map(file => file.path);

  assert(paths.includes('README.md'));
  assert(paths.includes('dist/agctx.js'));
  assert(paths.some(file => file.startsWith('dist/profile/')));
  assert(!paths.some(file => file.startsWith('src/')));
  assert(paths.some(file => file.startsWith('templates/')));
  assert(!paths.some(file => file.startsWith('docs/')));
  assert(!paths.some(file => file.startsWith('evals/')));

  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /actions\/workflows\/ci\.yml\/badge\.svg/);
  assert.match(readme, /img\.shields\.io\/badge\/Node\.js-22/);
  assert.doesNotMatch(readme, /\]\((?:docs\/|CONTRIBUTING\.md|SECURITY\.md|CODE_OF_CONDUCT\.md)/);
  assert.match(readme, /https:\/\/github\.com\/IsthisLee\/agent-context-manager\/blob\/main\/docs\//);
});

test('repository exposes an installed-package smoke test', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts.typecheck, 'tsc -p tsconfig.json');
  assert.equal(packageJson.scripts.build, 'node tools/build.ts');
  assert.equal(packageJson.scripts.prepack, 'node tools/build.ts');
  assert.equal(packageJson.scripts['check:release'], 'node tools/check-release.ts');
  assert.equal(packageJson.scripts['package:smoke'], 'node tools/package-smoke.ts');
  assert.equal(packageJson.scripts.prepublishOnly, 'pnpm run check && pnpm run pack:check');
  assert.equal(packageJson.scripts.check, 'pnpm run typecheck && pnpm run check:docs && pnpm test');
  assert(fs.existsSync(path.join(repoRoot, 'tools', 'package-smoke.ts')));
  assert(fs.existsSync(path.join(repoRoot, 'tools', 'build.ts')));
  assert(fs.existsSync(path.join(repoRoot, 'tools', 'check-release.ts')));
});
