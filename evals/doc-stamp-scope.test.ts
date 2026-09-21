import test from 'node:test';
import assert from 'node:assert/strict';
import { restampOnlyDocuments, sourcesToReread, stampTargets } from '../tools/doc-sources.ts';

/** A diff hunk for one file, in the shape `git diff --unified=0` produces. */
function diffFor(file: string, removed: string[], added: string[]): string {
  return [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    '@@ -1,1 +1,1 @@',
    ...removed.map(line => `-${line}`),
    ...added.map(line => `+${line}`)
  ].join('\n');
}

const olddigest = 'a'.repeat(64);
const newdigest = 'b'.repeat(64);

test('a document whose only change is its recorded hash is reported as restamped', () => {
  const diff = diffFor(
    'docs/faq.md',
    [`<!-- agctx-doc-sources-sha256: ${olddigest} -->`],
    [`<!-- agctx-doc-sources-sha256: ${newdigest} -->`]
  );

  assert.deepEqual(restampOnlyDocuments(diff), ['docs/faq.md']);
});

test('a citation digest counts as a hash too, even mid-sentence', () => {
  const diff = diffFor(
    'docs/contributing/architecture.md',
    ['판정은 `src/check.ts`의 `checkProject`<!--s:aaaaaaaaaaaa-->가 한다.'],
    ['판정은 `src/check.ts`의 `checkProject`<!--s:bbbbbbbbbbbb-->가 한다.']
  );

  assert.deepEqual(restampOnlyDocuments(diff), ['docs/contributing/architecture.md']);
});

test('a document whose prose changed alongside its hash is not reported', () => {
  const diff = diffFor(
    'README.md',
    [`<!-- agctx-doc-sources-sha256: ${olddigest} -->`, '항목은 6개다.'],
    [`<!-- agctx-doc-sources-sha256: ${newdigest} -->`, '항목은 10개다.']
  );

  assert.deepEqual(restampOnlyDocuments(diff), [], 'PR #54 re-read the document, so it is not a bare restamp');
});

test('only Markdown files are considered, so a source file that happens to hold a digest is left out', () => {
  const diff = diffFor(
    'src/explain.ts',
    [`const digest = '${olddigest}';`],
    [`const digest = '${newdigest}';`]
  );

  assert.deepEqual(restampOnlyDocuments(diff), []);
});

test('several documents in one diff are each judged on their own', () => {
  const diff = [
    diffFor('docs/a.md', [`<!-- agctx-doc-sources-sha256: ${olddigest} -->`], [`<!-- agctx-doc-sources-sha256: ${newdigest} -->`]),
    diffFor('docs/b.md', [`<!-- agctx-doc-sources-sha256: ${olddigest} -->`, '한 줄 더 고쳤다.'], [`<!-- agctx-doc-sources-sha256: ${newdigest} -->`, '한 줄 더 고쳤다는 말을 바꿨다.'])
  ].join('\n');

  assert.deepEqual(restampOnlyDocuments(diff), ['docs/a.md']);
});

test('a document that only gained or lost lines is not a bare restamp', () => {
  const diff = diffFor('docs/faq.md', [], ['새로 쓴 문단이다.']);

  assert.deepEqual(restampOnlyDocuments(diff), []);
});

test('the sources to re-read are the pinned ones git says changed', () => {
  const pinned = ['src/explain.ts', 'src/i18n/messages-en.ts', 'templates'];
  const changed = ['src/explain.ts', 'src/check.ts', 'templates/CLAUDE.md'];

  assert.deepEqual(sourcesToReread(pinned, changed), ['src/explain.ts', 'templates/CLAUDE.md'], 'a pinned folder covers the files beneath it');
});

test('nothing is singled out when git names no pinned source', () => {
  assert.deepEqual(sourcesToReread(['src/explain.ts'], ['src/check.ts']), []);
});

test('--stamp with no path asks for one instead of restamping everything', () => {
  assert.deepEqual(stampTargets(['--stamp']), { kind: 'ask' });
});

test('--stamp --all restamps every document, the way it used to', () => {
  assert.deepEqual(stampTargets(['--stamp', '--all']), { kind: 'all' });
});

test('--stamp with paths restamps only those documents', () => {
  assert.deepEqual(stampTargets(['--stamp', 'docs/faq.md', 'README.md']), { kind: 'paths', paths: ['docs/faq.md', 'README.md'] });
});

test('a path given with a leading ./ names the same document', () => {
  assert.deepEqual(stampTargets(['--stamp', './docs/faq.md']), { kind: 'paths', paths: ['docs/faq.md'] });
});
