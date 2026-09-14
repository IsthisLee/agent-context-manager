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

test('documentation checker hashes a pinned directory so files inside it are covered without list edits', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.mjs'), 'utf8');

  assert.match(checker, /walkFiles/);
  assert.match(checker, /isDirectory\(\)/);
});

test('doc-source hash paths are POSIX on every platform so a stamp from one OS verifies on another', async () => {
  const { docSourceHashPath } = await import('../tools/doc-source-path.mjs');

  assert.equal(docSourceHashPath('D:\\a\\agentic', 'D:\\a\\agentic\\bin\\agentic.mjs', path.win32), 'bin/agentic.mjs');
  assert.equal(docSourceHashPath('D:\\a\\agentic', 'D:\\a\\agentic\\.github\\workflows\\ci.yml', path.win32), '.github/workflows/ci.yml');
  assert.equal(docSourceHashPath('/repo', '/repo/bin/agentic.mjs', path.posix), 'bin/agentic.mjs');
});

test('documentation checker requires complete proposal summaries', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.mjs'), 'utf8');

  for (const field of ['제안 목표', '제안 이유', '결정할 것', '선행 제안', '후속 제안', '연관 제안']) {
    assert.match(checker, new RegExp(field));
  }
});

test('documentation checker requires the ADR decider header field', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.mjs'), 'utf8');

  assert.match(checker, /결정자/);
});

test('documentation checker keeps document-system entry points linked to the canonical proposal format', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.mjs'), 'utf8');

  assert.match(checker, /checkDocumentationGovernance/);
  assert.match(checker, /implementation-contracts\.md/);
});

test('documentation checker protects the public repository operations contract', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.mjs'), 'utf8');

  assert.match(checker, /repository-operations\.md/);
  assert.match(checker, /CONTRIBUTING\.md/);
  assert.match(checker, /SECURITY\.md/);
});

test('documentation checker validates local Markdown heading anchors', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.mjs'), 'utf8');

  assert.match(checker, /checkInternalAnchors/);
  assert.match(checker, /markdownHeadingSlug/);
});

test('documentation checker protects the README product entry point and discussion index integrity', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.mjs'), 'utf8');

  assert.match(checker, /checkReadme/);
  assert.match(checker, /must be indexed exactly once/);
  assert.match(checker, /index references missing topic/);
});
