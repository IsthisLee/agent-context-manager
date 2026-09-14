import test from 'node:test';
import assert from 'node:assert/strict';
import { baseFilePath, formatDiff, parseBase, serializeBase } from '../bin/conflicts.mjs';

const START = '<!-- agentic:managed:start -->';
const END = '<!-- agentic:managed:end -->';

test('formatDiff renders a unified diff of two texts', () => {
  const diff = formatDiff('base/CLAUDE.md', 'current/CLAUDE.md', 'a\nb\n', 'a\nx\n');
  assert.match(diff, /^-b$/m);
  assert.match(diff, /^\+x$/m);
});

test('base files round-trip the exact managed text under .agentic/base', () => {
  assert.equal(baseFilePath('.github/copilot-instructions.md'), '.agentic/base/.github/copilot-instructions.md.base');
  const managed = `${START}\nmanaged\n${END}`;
  assert.equal(parseBase(serializeBase(managed)), managed);
});
