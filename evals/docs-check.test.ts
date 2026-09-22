import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('documentation checker validates the repository documentation contracts', () => {
  const result = spawnSync('node', ['tools/check-docs.ts'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Documentation check passed/);
});

test('documentation checker validates architecture discussion topics beneath their index', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /path\.join\(discussionDir, 'topics'\)/);
});

test('every discussion area with a topics folder is checked, so repository topics are not exempt', async t => {
  const { discussionRoots } = await import('../tools/discussion-roots.ts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-discussion-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  fs.mkdirSync(path.join(dir, 'repository', 'topics'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'architecture', 'topics'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), '# 논의\n');

  assert.deepEqual(
    discussionRoots(dir),
    ['architecture', 'repository'],
    'a folder without topics/ is not a discussion area'
  );
  assert.deepEqual(discussionRoots(path.join(dir, 'missing')), []);

  const areas = fs
    .readdirSync(path.join(repoRoot, 'docs/discussion'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
  assert.deepEqual(
    discussionRoots(path.join(repoRoot, 'docs/discussion')),
    areas,
    'every discussion folder in this repository is an area the checker walks'
  );

  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');
  assert.match(checker, /discussionRoots/);
});

test('the guidance catalog is a user-facing reference and the checker guards it there', () => {
  assert.ok(
    fs.existsSync(path.join(repoRoot, 'docs/reference/guidance-catalog.md')),
    'users read what each guidance item writes, so the catalog belongs with the other specifications'
  );
  assert.ok(!fs.existsSync(path.join(repoRoot, 'docs/contributing/guidance-catalog.md')));

  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');
  assert.match(checker, /'reference', 'guidance-catalog\.md'/);
  assert.doesNotMatch(checker, /'contributing', 'guidance-catalog\.md'/);
});

test('repository operations discussions live apart from the package implementation plan', () => {
  const topic = path.join(repoRoot, 'docs/discussion/repository/topics/doc-accuracy-review.md');

  assert.ok(fs.existsSync(topic), 'the doc gate review topic belongs to the repository area');
  assert.ok(
    !fs.existsSync(path.join(repoRoot, 'docs/discussion/architecture/topics/doc-accuracy-review.md')),
    'a topic is indexed by exactly one area'
  );
});

test('documentation checker hashes a pinned directory so files inside it are covered without list edits', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /walkFiles/);
  assert.match(checker, /isDirectory\(\)/);
});

test('doc-source hash paths are POSIX on every platform so a stamp from one OS verifies on another', async () => {
  const { docSourceHashPath } = await import('../tools/doc-source-path.ts');

  assert.equal(docSourceHashPath('D:\\a\\repo', 'D:\\a\\repo\\src\\agctx.ts', path.win32), 'src/agctx.ts');
  assert.equal(
    docSourceHashPath('D:\\a\\repo', 'D:\\a\\repo\\.github\\workflows\\ci.yml', path.win32),
    '.github/workflows/ci.yml'
  );
  assert.equal(docSourceHashPath('/repo', '/repo/src/agctx.ts', path.posix), 'src/agctx.ts');
});

test('documentation checker requires complete proposal summaries', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  for (const field of ['제안 목표', '제안 이유', '결정할 것', '선행 제안', '후속 제안', '연관 제안']) {
    assert.match(checker, new RegExp(field));
  }
});

test('documentation checker requires the ADR decider header field', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /결정자/);
});

test('documentation checker keeps document-system entry points linked to the canonical proposal format', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /checkDocumentationGovernance/);
  assert.match(checker, /implementation-contracts\.md/);
});

test('documentation checker protects the public repository operations contract', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /releasing\.md/);
  assert.match(checker, /SECURITY\.md/);
  assert.match(checker, /SECURITY\.md/);
});

test('documentation checker validates local Markdown heading anchors', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /checkInternalAnchors/);
  assert.match(checker, /markdownHeadingSlug/);
});

test('documentation checker protects the README product entry point and discussion index integrity', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /checkReadme/);
  assert.match(checker, /must be indexed exactly once/);
  assert.match(checker, /index references missing topic/);
});

test('Implemented discussion topics must carry an implementation record heading outside code blocks', async () => {
  const { hasImplementationRecord, requiresImplementationRecord } = await import('../tools/discussion-record.ts');

  assert.equal(requiresImplementationRecord('Implemented'), true);
  assert.equal(requiresImplementationRecord('Implementing'), false);
  assert.equal(requiresImplementationRecord('Proposed'), false);
  assert.equal(hasImplementationRecord('# 주제\n\n#### 구현 기록: 프로필 setup\n\n* **결정:** …'), true);
  assert.equal(hasImplementationRecord('# 주제\n\n## 9. 구현 기록\n\n- 내용'), false);
  assert.equal(hasImplementationRecord('```markdown\n#### 구현 기록: <구현한 범위>\n```'), false);

  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');
  assert.match(checker, /hasImplementationRecord/);
  assert.match(checker, /requiresImplementationRecord/);
});

test('documents pin source modules rather than the whole src folder, and every source file is pinned by some document', async () => {
  const { unpinnedSources, wholeRootPins } = await import('../tools/doc-sources.ts');

  assert.deepEqual(wholeRootPins(['src', 'src/commands', 'package.json']), ['src']);
  assert.deepEqual(wholeRootPins(['src/', 'templates']), ['src/']);
  assert.deepEqual(
    unpinnedSources(
      ['src/agctx.ts', 'src/commands/cli.ts', 'src/repos/pr.ts', 'src/repos-extra.ts'],
      ['src/commands', 'src/repos', 'src/agctx.ts']
    ),
    ['src/repos-extra.ts'],
    'a folder pin covers only files inside that folder'
  );
  assert.deepEqual(unpinnedSources(['src/check.ts'], ['src']), ['src/check.ts'], 'a whole-src pin covers nothing');

  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');
  assert.match(checker, /wholeRootPins/);
  assert.match(checker, /unpinnedSources/);
});

test('a source a document cites by name counts as covered, so the pin can move to the section that needs it', async () => {
  const { unpinnedSources } = await import('../tools/doc-sources.ts');

  assert.deepEqual(
    unpinnedSources(['src/check.ts', 'src/explain.ts'], ['src/explain.ts'], ['src/check.ts']),
    [],
    'a cited file needs no pin'
  );
  assert.deepEqual(
    unpinnedSources(['src/check.ts'], [], []),
    ['src/check.ts'],
    'a file that is neither pinned nor cited is reported'
  );
});

test('a document pinned as a source is hashed without its recorded hash, so the two READMEs can pin each other', async () => {
  const { withoutRecordedHash } = await import('../tools/doc-sources.ts');
  const doc = (hash: string, body: string) =>
    `# Title\n\n<!-- agctx-doc-sources: README.en.md -->\n<!-- agctx-doc-sources-sha256: ${hash} -->\n\n${body}\n`;
  assert.equal(
    withoutRecordedHash(doc('a'.repeat(64), 'body')),
    withoutRecordedHash(doc('b'.repeat(64), 'body')),
    'restamping a pinned document does not change what pins it'
  );
  assert.notEqual(
    withoutRecordedHash(doc('a'.repeat(64), 'body')),
    withoutRecordedHash(doc('a'.repeat(64), 'edited body')),
    'editing a pinned document still trips the gate'
  );

  for (const [readme, translation] of [
    ['README.md', 'README.en.md'],
    ['README.en.md', 'README.md']
  ]) {
    const content = fs.readFileSync(path.join(repoRoot, readme), 'utf8');
    const pins =
      content
        .match(/<!--\s*agctx-doc-sources:\s*([^\n]+?)\s*-->/)?.[1]
        .split(',')
        .map(value => value.trim()) ?? [];
    assert.ok(pins.includes(translation), `${readme} pins ${translation}, so changing one language asks for the other`);
  }
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');
  assert.match(checker, /withoutRecordedHash/);
});
