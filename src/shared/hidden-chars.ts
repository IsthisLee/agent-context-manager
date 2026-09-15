/**
 * Find characters that change how text reads without showing up on screen.
 * Received guidance is agent input, so a profile that hides instructions
 * behind bidirectional controls or invisible tag characters must be caught
 * before it reaches a repository.
 */

export interface HiddenCharacter {
  /** 1-based line number. */
  line: number;
  /** 1-based column, counted in code points. */
  column: number;
  /** Code point written as `U+XXXX`. */
  codePoint: string;
  /** What kind of hidden character it is. */
  kind: 'bidi-control' | 'zero-width' | 'tag' | 'variation-selector';
}

const RANGES: ReadonlyArray<readonly [from: number, to: number, kind: HiddenCharacter['kind']]> = [
  [0x202a, 0x202e, 'bidi-control'],
  [0x2066, 0x2069, 'bidi-control'],
  [0x200b, 0x200d, 'zero-width'],
  [0x2060, 0x2060, 'zero-width'],
  [0xfeff, 0xfeff, 'zero-width'],
  [0xe0000, 0xe007f, 'tag'],
  [0xe0100, 0xe01ef, 'variation-selector']
];

function kindOf(code: number): HiddenCharacter['kind'] | null {
  for (const [from, to, kind] of RANGES) {
    if (code >= from && code <= to) return kind;
  }
  return null;
}

/** Every hidden character in `text`. A byte order mark at the very start is allowed. */
export function findHiddenCharacters(text: string): HiddenCharacter[] {
  const found: HiddenCharacter[] = [];
  let line = 1;
  let column = 0;
  let first = true;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (char === '\n') {
      line += 1;
      column = 0;
      first = false;
      continue;
    }
    column += 1;
    const kind = kindOf(code);
    if (kind && !(first && code === 0xfeff)) {
      found.push({ line, column, codePoint: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`, kind });
    }
    first = false;
  }
  return found;
}

/** One line per finding, for messages: `AGENTS.md:12:5 U+202E bidi-control`. */
export function describeHiddenCharacters(file: string, found: readonly HiddenCharacter[]): string[] {
  return found.map(item => `${file}:${item.line}:${item.column} ${item.codePoint} ${item.kind}`);
}
