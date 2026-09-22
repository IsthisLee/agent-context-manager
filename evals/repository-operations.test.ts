import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

function runReleaseCheck(args: string[]) {
  return spawnSync(process.execPath, [path.join(repoRoot, 'tools/check-release.ts'), ...args], { encoding: 'utf8' });
}

test('CI verifies the repository on supported Node and operating system combinations', () => {
  const ci = read('.github/workflows/ci.yml');
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.engines.node, '>=22.0.0');
  assert.equal(read('.nvmrc').trim(), '22');
  assert.match(ci, /pnpm\/action-setup@[0-9a-f]{40}/);
  assert.match(ci, /persist-credentials: false/);
  assert.match(ci, /pnpm install --frozen-lockfile/);
  assert.match(ci, /ubuntu-latest/);
  assert.match(ci, /macos-latest/);
  assert.match(ci, /windows-latest/);
  assert.match(ci, /node: 22\.x/);
  assert.match(ci, /node: 24\.x/);
  assert.match(ci, /node: 26\.x/);
  assert.match(ci, /pnpm run check/);
  assert.match(ci, /pnpm run package:smoke/);
  assert.match(ci, /pnpm run audit/);
});

test('npm publishing requires prepublish verification and provenance', () => {
  const publish = read('.github/workflows/publish.yml');
  assert.match(publish, /node-version: 24\.x/);
  assert.match(publish, /persist-credentials: false/);
  assert.match(publish, /id-token: write/);
  assert.match(publish, /pnpm run check:release/);
  assert.match(publish, /npm publish --provenance --access public/);
});

test('public repository health and dependency automation files are present', () => {
  for (const relative of [
    'SECURITY.md',
    '.github/dependabot.yml',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.editorconfig',
    '.gitattributes'
  ])
    assert(fs.existsSync(path.join(repoRoot, relative)), `${relative} must exist`);
  // ADR 0031로 뺐다. 행동 규범과 이슈 템플릿은 두 사람 이상이 있어야 의미가 있고, CODEOWNERS는
  // 소유자가 둘 이상이어야 의미가 있다.
  for (const relative of ['CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', '.github/CODEOWNERS', '.github/ISSUE_TEMPLATE']) {
    assert(!fs.existsSync(path.join(repoRoot, relative)), `${relative} was dropped and must stay dropped`);
  }
  const dependabot = read('.github/dependabot.yml');
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
});

test('GitHub Actions references are pinned to immutable commits', () => {
  for (const relative of [
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/dependency-review.yml',
    '.github/workflows/publish.yml'
  ]) {
    const workflow = read(relative);
    for (const match of workflow.matchAll(/uses:\s+([^\s#]+)@([^\s#]+)/g)) {
      assert.match(match[2], /^[0-9a-f]{40}$/, `${relative}: ${match[1]} must use a 40-character commit SHA`);
    }
  }
});

test('every GitHub workflow disables checkout credential persistence', () => {
  for (const relative of [
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/dependency-review.yml',
    '.github/workflows/publish.yml'
  ]) {
    const workflow = read(relative);
    const checkouts = [
      ...workflow.matchAll(/uses: actions\/checkout@[^\n]+\n([\s\S]*?)(?=\n {6}- name:|\n {2}jobs:|$)/g)
    ];
    assert(checkouts.length > 0, `${relative} must use checkout`);
    for (const [, block] of checkouts) assert.match(block, /persist-credentials: false/);
  }
});

test('release check reports a missing tag as a clean error without a stack trace', () => {
  const result = runReleaseCheck([]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^Error: A release tag is required/m);
  assert.doesNotMatch(result.stderr, /\n\s+at /, 'must not print a Node stack trace');
});

test('release check passes for the current package version tag', () => {
  const { version } = JSON.parse(read('package.json'));
  const result = runReleaseCheck([`v${version}`]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`Release contract passed for v${version.replaceAll('.', '\\.')}\\.`));
});
