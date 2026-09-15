import test from 'node:test';
import assert from 'node:assert/strict';
import { describeHiddenCharacters, findHiddenCharacters } from '../src/shared/hidden-chars.ts';

test('plain Korean and English text has no hidden characters', () => {
  assert.deepEqual(findHiddenCharacters('# 규칙\n- Use pnpm.\n- 테스트를 먼저 쓴다.\n'), []);
});

test('bidirectional controls, zero-width, tag, and variation selector characters are reported with position', () => {
  const text = 'line one\nsafe \u{202E}evil\u{202C} text\nzero\u{200B}width\ntag\u{E0041}\nvs\u{E0100}\n';
  const found = findHiddenCharacters(text);
  assert.deepEqual(found.map(item => [item.line, item.column, item.codePoint, item.kind]), [
    [2, 6, 'U+202E', 'bidi-control'],
    [2, 11, 'U+202C', 'bidi-control'],
    [3, 5, 'U+200B', 'zero-width'],
    [4, 4, 'U+E0041', 'tag'],
    [5, 3, 'U+E0100', 'variation-selector']
  ]);
});

test('a byte order mark is allowed only as the first character', () => {
  assert.deepEqual(findHiddenCharacters('\u{FEFF}# Profile\n'), []);
  assert.deepEqual(findHiddenCharacters('# Profile\n\u{FEFF}').map(item => item.codePoint), ['U+FEFF']);
});

test('findings are described as file:line:column lines', () => {
  assert.deepEqual(describeHiddenCharacters('AGENTS.md', findHiddenCharacters('a\u{2066}b')), ['AGENTS.md:1:2 U+2066 bidi-control']);
});
