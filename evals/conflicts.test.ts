import test from 'node:test';
import assert from 'node:assert/strict';
import {
  baseFilePath,
  collectUserEdits,
  formatDiff,
  parseBase,
  relocateUserEdits,
  serializeBase
} from '../src/project/conflicts.ts';

const START = '<!-- agctx:managed:start -->';
const END = '<!-- agctx:managed:end -->';

test('collectUserEdits는 base와 비교해 더한 줄과 뺀 줄을 나눈다', () => {
  const edits = collectUserEdits('a\nb\nc', 'a\nx\nc\ny');
  assert.deepEqual(edits.addedLines, ['x', 'y']);
  assert.deepEqual(edits.removedLines, ['b']);
});

test('collectUserEdits는 더한 글 양 끝의 빈 줄을 뺀다', () => {
  const edits = collectUserEdits('title\nbody', 'title\n\n## Commands\n- Test\n\nbody');
  assert.deepEqual(edits.addedLines, ['## Commands', '- Test']);
  assert.deepEqual(edits.removedLines, []);
});

test('relocateUserEdits는 포인터 파일의 수정을 관리 블록 바로 아래에 둔다', () => {
  const content = `before\n${START}\nmanaged\n${END}\nafter\n`;
  assert.equal(
    relocateUserEdits(content, ['x', 'y'], 'pointer'),
    `before\n${START}\nmanaged\n${END}\n\nx\ny\n\nafter\n`
  );
  assert.equal(relocateUserEdits(`${START}\nmanaged\n${END}\n`, ['x'], 'pointer'), `${START}\nmanaged\n${END}\n\nx\n`);
});

test('relocateUserEdits는 AGENTS.md 수정을 확장 영역 끝에 붙인다', () => {
  const content = '# Profile\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\nexisting rule\n';
  assert.equal(relocateUserEdits(content, ['x'], 'agents'), `${content.trimEnd()}\n\nx\n`);
});

test('옮길 것이 없으면 relocateUserEdits는 내용을 바꾸지 않는다', () => {
  const content = `${START}\nmanaged\n${END}\n`;
  assert.equal(relocateUserEdits(content, [], 'pointer'), content);
});

test('formatDiff는 두 글의 unified diff를 만든다', () => {
  const diff = formatDiff('base/CLAUDE.md', 'current/CLAUDE.md', 'a\nb\n', 'a\nx\n');
  assert.match(diff, /^-b$/m);
  assert.match(diff, /^\+x$/m);
});

test('base 파일은 .agctx/base 아래에 관리 글을 정확히 보관했다가 돌려준다', () => {
  assert.equal(baseFilePath('.agents/rules/agctx.md'), '.agctx/base/.agents/rules/agctx.md.base');
  const managed = `${START}\nmanaged\n${END}`;
  assert.equal(parseBase(serializeBase(managed)), managed);
});
