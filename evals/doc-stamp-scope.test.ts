import test from 'node:test';
import assert from 'node:assert/strict';
import { restampOnlyDocuments, sourcesToReread, stampTargets } from '../tools/doc-sources.ts';

/** 파일 하나의 diff 헝크. `git diff --unified=0`이 만드는 모양이다. */
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

test('기록된 해시만 바뀐 문서는 다시 stamp만 했다고 보고한다', () => {
  const diff = diffFor(
    'docs/faq.md',
    [`<!-- agctx-doc-sources-sha256: ${olddigest} -->`],
    [`<!-- agctx-doc-sources-sha256: ${newdigest} -->`]
  );

  assert.deepEqual(restampOnlyDocuments(diff), ['docs/faq.md']);
});

test('인용 지문도 문장 한가운데 있어도 해시로 센다', () => {
  const diff = diffFor(
    'docs/contributing/architecture.md',
    ['판정은 `src/check.ts`의 `checkProject`<!--s:aaaaaaaaaaaa-->가 한다.'],
    ['판정은 `src/check.ts`의 `checkProject`<!--s:bbbbbbbbbbbb-->가 한다.']
  );

  assert.deepEqual(restampOnlyDocuments(diff), ['docs/contributing/architecture.md']);
});

test('해시와 함께 글도 바뀐 문서는 보고하지 않는다', () => {
  const diff = diffFor(
    'README.md',
    [`<!-- agctx-doc-sources-sha256: ${olddigest} -->`, '항목은 6개다.'],
    [`<!-- agctx-doc-sources-sha256: ${newdigest} -->`, '항목은 10개다.']
  );

  assert.deepEqual(restampOnlyDocuments(diff), [], 'PR #54는 문서를 다시 읽었으므로 stamp만 한 것이 아니다');
});

test('Markdown 파일만 보므로 지문이 우연히 든 소스 파일은 빠진다', () => {
  const diff = diffFor('src/explain.ts', [`const digest = '${olddigest}';`], [`const digest = '${newdigest}';`]);

  assert.deepEqual(restampOnlyDocuments(diff), []);
});

test('한 diff의 여러 문서는 각각 따로 판단한다', () => {
  const diff = [
    diffFor(
      'docs/a.md',
      [`<!-- agctx-doc-sources-sha256: ${olddigest} -->`],
      [`<!-- agctx-doc-sources-sha256: ${newdigest} -->`]
    ),
    diffFor(
      'docs/b.md',
      [`<!-- agctx-doc-sources-sha256: ${olddigest} -->`, '한 줄 더 고쳤다.'],
      [`<!-- agctx-doc-sources-sha256: ${newdigest} -->`, '한 줄 더 고쳤다는 말을 바꿨다.']
    )
  ].join('\n');

  assert.deepEqual(restampOnlyDocuments(diff), ['docs/a.md']);
});

test('줄이 더해지거나 빠지기만 한 문서도 stamp만 한 것이 아니다', () => {
  const diff = diffFor('docs/faq.md', [], ['새로 쓴 문단이다.']);

  assert.deepEqual(restampOnlyDocuments(diff), []);
});

test('다시 읽을 소스는 git이 바뀌었다고 말하는 핀 소스다', () => {
  const pinned = ['src/explain.ts', 'src/i18n/messages-en.ts', 'templates'];
  const changed = ['src/explain.ts', 'src/check.ts', 'templates/CLAUDE.md'];

  assert.deepEqual(
    sourcesToReread(pinned, changed),
    ['src/explain.ts', 'templates/CLAUDE.md'],
    '핀한 폴더는 그 아래 파일을 덮는다'
  );
});

test('git이 핀 소스를 하나도 말하지 않으면 아무것도 골라내지 않는다', () => {
  assert.deepEqual(sourcesToReread(['src/explain.ts'], ['src/check.ts']), []);
});

test('경로 없는 --stamp는 모두 다시 stamp하지 않고 경로를 달라고 한다', () => {
  assert.deepEqual(stampTargets(['--stamp']), { kind: 'ask' });
});

test('--stamp --all은 예전처럼 모든 문서를 다시 stamp한다', () => {
  assert.deepEqual(stampTargets(['--stamp', '--all']), { kind: 'all' });
});

test('경로를 준 --stamp는 그 문서만 다시 stamp한다', () => {
  assert.deepEqual(stampTargets(['--stamp', 'docs/faq.md', 'README.md']), {
    kind: 'paths',
    paths: ['docs/faq.md', 'README.md']
  });
});

test('앞에 ./를 붙인 경로도 같은 문서를 가리킨다', () => {
  assert.deepEqual(stampTargets(['--stamp', './docs/faq.md']), { kind: 'paths', paths: ['docs/faq.md'] });
});
