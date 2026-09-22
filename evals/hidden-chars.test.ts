import test from 'node:test';
import assert from 'node:assert/strict';
import { describeHiddenCharacters, findHiddenCharacters } from '../src/shared/hidden-chars.ts';

test('평범한 한국어와 영어 글에는 숨은 문자가 없다', () => {
  assert.deepEqual(findHiddenCharacters('# 규칙\n- Use pnpm.\n- 테스트를 먼저 쓴다.\n'), []);
});

test('양방향 제어, 폭 없는 문자, 태그, 이체 선택자 문자를 위치와 함께 보고한다', () => {
  const text = 'line one\nsafe \u{202E}evil\u{202C} text\nzero\u{200B}width\ntag\u{E0041}\nvs\u{E0100}\n';
  const found = findHiddenCharacters(text);
  assert.deepEqual(
    found.map(item => [item.line, item.column, item.codePoint, item.kind]),
    [
      [2, 6, 'U+202E', 'bidi-control'],
      [2, 11, 'U+202C', 'bidi-control'],
      [3, 5, 'U+200B', 'zero-width'],
      [4, 4, 'U+E0041', 'tag'],
      [5, 3, 'U+E0100', 'variation-selector']
    ]
  );
});

test('바이트 순서 표시는 첫 문자일 때만 허용한다', () => {
  assert.deepEqual(findHiddenCharacters('\u{FEFF}# Profile\n'), []);
  assert.deepEqual(
    findHiddenCharacters('# Profile\n\u{FEFF}').map(item => item.codePoint),
    ['U+FEFF']
  );
});

test('찾은 것은 file:line:column 줄로 설명한다', () => {
  assert.deepEqual(describeHiddenCharacters('AGENTS.md', findHiddenCharacters('a\u{2066}b')), [
    'AGENTS.md:1:2 U+2066 bidi-control'
  ]);
});
