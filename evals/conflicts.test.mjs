import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDiff } from '../bin/conflicts.mjs';

test('formatDiff renders a unified diff of two texts', () => {
  const diff = formatDiff('base/CLAUDE.md', 'current/CLAUDE.md', 'a\nb\n', 'a\nx\n');
  assert.match(diff, /^-b$/m);
  assert.match(diff, /^\+x$/m);
});
