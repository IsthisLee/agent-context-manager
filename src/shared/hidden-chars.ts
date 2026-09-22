/**
 * 화면에 보이지 않으면서 글이 읽히는 방식을 바꾸는 문자를 찾는다. 받은 지침은 에이전트의 입력이므로,
 * 양방향 제어 문자나 보이지 않는 태그 문자 뒤에 지시를 숨긴 프로필은 저장소에 닿기 전에 잡아야 한다.
 */

export interface HiddenCharacter {
  /** 줄 번호. 1부터 센다. */
  line: number;
  /** 열 번호. 1부터 세고 코드 포인트 단위다. */
  column: number;
  /** `U+XXXX`로 적은 코드 포인트. */
  codePoint: string;
  /** 숨은 문자의 종류. */
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

/** `text`의 모든 숨은 문자. 맨 앞의 바이트 순서 표시는 허용한다. */
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

/** 찾은 것마다 한 줄. 메시지에 쓴다: `AGENTS.md:12:5 U+202E bidi-control`. */
export function describeHiddenCharacters(file: string, found: readonly HiddenCharacter[]): string[] {
  return found.map(item => `${file}:${item.line}:${item.column} ${item.codePoint} ${item.kind}`);
}
