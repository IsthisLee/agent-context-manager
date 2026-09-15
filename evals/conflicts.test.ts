import test from 'node:test';
import assert from 'node:assert/strict';
import { baseFilePath, collectUserEdits, formatDiff, parseBase, relocateUserEdits, serializeBase } from '../src/project/conflicts.ts';

const START = '<!-- agctx:managed:start -->';
const END = '<!-- agctx:managed:end -->';

test('collectUserEdits separates lines added and removed relative to the base', () => {
  const edits = collectUserEdits('a\nb\nc', 'a\nx\nc\ny');
  assert.deepEqual(edits.addedLines, ['x', 'y']);
  assert.deepEqual(edits.removedLines, ['b']);
});

test('collectUserEdits drops blank lines at the edges of the added text', () => {
  const edits = collectUserEdits('title\nbody', 'title\n\n## Commands\n- Test\n\nbody');
  assert.deepEqual(edits.addedLines, ['## Commands', '- Test']);
  assert.deepEqual(edits.removedLines, []);
});

test('relocateUserEdits places pointer-file edits right below the managed block', () => {
  const content = `before\n${START}\nmanaged\n${END}\nafter\n`;
  assert.equal(
    relocateUserEdits(content, ['x', 'y'], 'pointer'),
    `before\n${START}\nmanaged\n${END}\n\nx\ny\n\nafter\n`
  );
  assert.equal(relocateUserEdits(`${START}\nmanaged\n${END}\n`, ['x'], 'pointer'), `${START}\nmanaged\n${END}\n\nx\n`);
});

test('relocateUserEdits appends AGENTS.md edits to the end of the extension section', () => {
  const content = '# Profile\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\nexisting rule\n';
  assert.equal(relocateUserEdits(content, ['x'], 'agents'), `${content.trimEnd()}\n\nx\n`);
});

test('relocateUserEdits leaves the content unchanged when there is nothing to move', () => {
  const content = `${START}\nmanaged\n${END}\n`;
  assert.equal(relocateUserEdits(content, [], 'pointer'), content);
});

test('formatDiff renders a unified diff of two texts', () => {
  const diff = formatDiff('base/CLAUDE.md', 'current/CLAUDE.md', 'a\nb\n', 'a\nx\n');
  assert.match(diff, /^-b$/m);
  assert.match(diff, /^\+x$/m);
});

test('base files round-trip the exact managed text under .agctx/base', () => {
  assert.equal(baseFilePath('.agents/rules/agctx.md'), '.agctx/base/.agents/rules/agctx.md.base');
  const managed = `${START}\nmanaged\n${END}`;
  assert.equal(parseBase(serializeBase(managed)), managed);
});
