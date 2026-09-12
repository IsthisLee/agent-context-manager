import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

test('CI verifies the repository on supported Node and operating system combinations', () => {
  const ci = read('.github/workflows/ci.yml');
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.engines.node, '>=24.0.0');
  assert.equal(read('.nvmrc').trim(), '24');
  assert.match(ci, /pnpm\/action-setup@[0-9a-f]{40}/);
  assert.match(ci, /persist-credentials: false/);
  assert.match(ci, /pnpm install --frozen-lockfile/);
  assert.match(ci, /ubuntu-latest/);
  assert.match(ci, /macos-latest/);
  assert.match(ci, /windows-latest/);
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
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'SECURITY.md',
    '.github/dependabot.yml',
    '.github/ISSUE_TEMPLATE/bug-report.yml',
    '.github/ISSUE_TEMPLATE/feature-request.yml',
    '.github/ISSUE_TEMPLATE/config.yml',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/CODEOWNERS',
    '.editorconfig',
    '.gitattributes'
  ]) assert(fs.existsSync(path.join(repoRoot, relative)), `${relative} must exist`);
  const dependabot = read('.github/dependabot.yml');
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
});

test('GitHub Actions references are pinned to immutable commits', () => {
  for (const relative of ['.github/workflows/ci.yml', '.github/workflows/codeql.yml', '.github/workflows/dependency-review.yml', '.github/workflows/publish.yml']) {
    const workflow = read(relative);
    for (const match of workflow.matchAll(/uses:\s+([^\s#]+)@([^\s#]+)/g)) {
      assert.match(match[2], /^[0-9a-f]{40}$/, `${relative}: ${match[1]} must use a 40-character commit SHA`);
    }
  }
});

test('every GitHub workflow disables checkout credential persistence', () => {
  for (const relative of ['.github/workflows/ci.yml', '.github/workflows/codeql.yml', '.github/workflows/dependency-review.yml', '.github/workflows/publish.yml']) {
    const workflow = read(relative);
    const checkouts = [...workflow.matchAll(/uses: actions\/checkout@[^\n]+\n([\s\S]*?)(?=\n      - name:|\n  jobs:|$)/g)];
    assert(checkouts.length > 0, `${relative} must use checkout`);
    for (const [, block] of checkouts) assert.match(block, /persist-credentials: false/);
  }
});
