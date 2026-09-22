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

test('문서는 절마다 소스를 핀할 수 있고, 각 마커는 그 아래 글을 소유한다', () => {
  const sections = docSourceSections(document);

  assert.equal(sections.length, 2);
  assert.deepEqual(sections[0].sources, ['package.json']);
  assert.equal(sections[0].digest, 'a'.repeat(64));
  assert.equal(sections[0].heading, '문서', '첫 마커는 제목에 속한다');
  assert.deepEqual(sections[1].sources, ['src/check.ts', 'tools/build.ts']);
  assert.equal(sections[1].digest, 'PENDING');
  assert.equal(sections[1].heading, '두 번째 절');
});

test('마커가 없는 문서에는 핀한 절이 없다', () => {
  assert.deepEqual(docSourceSections('# 제목\n\n본문\n'), []);
});

test('해시 줄이 없는 마커는 불완전하다고 보고한다', () => {
  const broken = '# 제목\n\n<!-- agctx-doc-sources: package.json -->\n\n본문\n';
  const sections = docSourceSections(broken);

  assert.equal(sections.length, 1);
  assert.equal(sections[0].digest, null, '검사기는 빠진 해시 줄을 오류로 바꾼다');
});
