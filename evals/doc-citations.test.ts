import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { citationExempt, lineNumberCitations, namedCitations, repoFile } from '../tools/doc-citations.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('a document may not cite code by line number', () => {
  assert.deepEqual(lineNumberCitations('`src/check.ts`의 `checkProject`가 판정한다.'), []);
  assert.deepEqual(lineNumberCitations('판정은 `src/check.ts:62-127`에 있다.'), ['src/check.ts:62-127']);
  assert.deepEqual(lineNumberCitations('`package.json:3`과 `.github/workflows/ci.yml:10-12`'), ['package.json:3', '.github/workflows/ci.yml:10-12']);
  assert.deepEqual(lineNumberCitations('시각은 `12:30`이고 키는 `agctx:managed`다.'), [], 'only paths with an extension count as citations');
});

test('a citation names a file and a name inside it', () => {
  assert.deepEqual(namedCitations('`src/check.ts`의 `checkProject`가 판정한다.'), [{ file: 'src/check.ts', name: 'checkProject' }]);
  assert.deepEqual(
    namedCitations('`tools/generate-skills.ts`의 `SKILLS`·`renderSkill`'),
    [{ file: 'tools/generate-skills.ts', name: 'SKILLS' }, { file: 'tools/generate-skills.ts', name: 'renderSkill' }]
  );
  assert.deepEqual(namedCitations('`docs/README.md`의 `문서별 책임` 절'), [], 'prose names are not checked');
});

test('only files this repository owns are checked, so external and generated paths pass', () => {
  assert.equal(repoFile('src/check.ts'), true);
  assert.equal(repoFile('tools/build.ts'), true);
  assert.equal(repoFile('package.json'), true);
  assert.equal(repoFile('apm.yml'), false, 'another tool owns this file');
  assert.equal(repoFile('agctx.project.json'), false, 'agctx generates this in a user project');
  assert.equal(repoFile('compilation/claude_formatter.py'), false, 'a path inside an external repository');
});

test('history documents keep their old citations, current-behavior documents do not', () => {
  assert.equal(citationExempt('docs/discussion/repository/topics/code-citation-style.md'), true);
  assert.equal(citationExempt('docs/adr/0016-command-contract.md'), true);
  assert.equal(citationExempt('CHANGELOG.md'), true);
  assert.equal(citationExempt('docs/contributing/implementation-principles.md'), false);
  assert.equal(citationExempt('README.md'), false);
});

test('the two rewritten documents point at names that exist and carry no line numbers', () => {
  for (const doc of ['docs/contributing/implementation-mechanics.md', 'docs/contributing/implementation-principles.md']) {
    const content = fs.readFileSync(path.join(repoRoot, doc), 'utf8');
    assert.deepEqual(lineNumberCitations(content), [], `${doc} cites code by name, not by line`);
    for (const { file, name } of namedCitations(content)) {
      const target = path.join(repoRoot, file);
      assert.ok(fs.existsSync(target), `${doc}: ${file} exists`);
      assert.match(fs.readFileSync(target, 'utf8'), new RegExp(`\\b${name}\\b`), `${doc}: ${file} still has ${name}`);
    }
  }

  assert.match(fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8'), /namedCitations/);
});
