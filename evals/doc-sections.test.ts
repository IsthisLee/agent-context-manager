import test from 'node:test';
import assert from 'node:assert/strict';
import { docSourceSections } from '../tools/doc-sources.ts';

const document = [
  '# 문서',
  '',
  '<!-- agctx-doc-sources: package.json -->',
  `<!-- agctx-doc-sources-sha256: ${'a'.repeat(64)} -->`,
  '',
  '본문',
  '',
  '## 두 번째 절',
  '',
  '<!-- agctx-doc-sources: src/check.ts, tools/build.ts -->',
  '<!-- agctx-doc-sources-sha256: PENDING -->',
  '',
  '설명',
  ''
].join('\n');

test('a document may pin sources once per section, and each marker owns the text below it', () => {
  const sections = docSourceSections(document);

  assert.equal(sections.length, 2);
  assert.deepEqual(sections[0].sources, ['package.json']);
  assert.equal(sections[0].digest, 'a'.repeat(64));
  assert.equal(sections[0].heading, '문서', 'the first marker belongs to the title');
  assert.deepEqual(sections[1].sources, ['src/check.ts', 'tools/build.ts']);
  assert.equal(sections[1].digest, 'PENDING');
  assert.equal(sections[1].heading, '두 번째 절');
});

test('a document with no marker has no pinned section', () => {
  assert.deepEqual(docSourceSections('# 제목\n\n본문\n'), []);
});

test('a marker without its hash line is reported as incomplete', () => {
  const broken = '# 제목\n\n<!-- agctx-doc-sources: package.json -->\n\n본문\n';
  const sections = docSourceSections(broken);

  assert.equal(sections.length, 1);
  assert.equal(sections[0].digest, null, 'the checker turns a missing hash line into an error');
});
