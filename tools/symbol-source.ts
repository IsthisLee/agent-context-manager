import { createHash } from 'node:crypto';

/**
 * 문서 인용이 가리키는 파일 조각을 잘라 내서, 게이트가 지문을 만들고 바뀐 것을 알아차리게 한다.
 * 인용하는 파일은 세 종류다: TypeScript 선언, JSON 키, YAML 키. 이 저장소는 최상위 선언과 키만
 * 인용하므로 줄 단위로 잘라도 충분하고, 도구가 파서 의존성을 갖지 않아도 된다. TypeScript 7에는
 * JavaScript 파서 API가 없다. 결정은 docs/discussion/repository/topics/code-citation-style.md에 있다.
 */

const KEYWORDS = ['function', 'const', 'let', 'var', 'class', 'interface', 'type', 'enum'];

const escaped = (name: string) => name.replaceAll('$', '\\$');

/** `export async function name`, `const name`, `export interface name` 같은 것. */
function declares(line: string, name: string): boolean {
  return new RegExp(
    `^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:declare\\s+)?(?:${KEYWORDS.join('|')})\\s+${escaped(name)}\\b`
  ).test(line);
}

/** 다른 최상위 선언이나 그 문서 주석을 시작하는 줄. */
function startsNextDeclaration(line: string): boolean {
  return /^(?:export\b|\/\*\*|\/\/)/.test(line) || KEYWORDS.some(keyword => new RegExp(`^${keyword}\\s`).test(line));
}

export function symbolText(source: string, name: string): string | null {
  const lines = source.split('\n');
  const start = lines.findIndex(line => declares(line, name));
  if (start < 0) return null;

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (startsNextDeclaration(lines[index])) {
      end = index;
      break;
    }
  }

  while (end > start + 1 && !lines[end - 1].trim()) end--;
  return lines.slice(start, end).join('\n');
}

/** 최상위나 중첩 객체 안에 있는 JSON 키의 값. 정규 JSON으로. */
export function jsonValue(source: string, name: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  const queue: unknown[] = [parsed];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || Array.isArray(current)) continue;
    const record = current as Record<string, unknown>;
    if (name in record) return JSON.stringify(record[name]);
    queue.push(...Object.values(record));
  }
  return null;
}

/** YAML 키와 그 아래 들여쓴 블록. */
export function yamlBlock(source: string, name: string): string | null {
  const lines = source.split('\n');
  const start = lines.findIndex(line => new RegExp(`^(\\s*)${escaped(name)}:`).test(line));
  if (start < 0) return null;

  const indent = lines[start].length - lines[start].trimStart().length;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (line.length - line.trimStart().length <= indent) {
      end = index;
      break;
    }
  }

  while (end > start + 1 && !lines[end - 1].trim()) end--;
  return lines.slice(start, end).join('\n');
}

/**
 * 파일 종류에 따라 고른, 인용한 파일 조각. 다른 문서를 가리키는 인용에는 지문이 없다. 그 글은 계속
 * 바뀌고, 가리키는 문서가 그것을 설명하지는 않기 때문이다.
 */
export function citedText(filePath: string, source: string, name: string): string | null {
  if (filePath.endsWith('.md')) return null;
  if (filePath.endsWith('.json')) return jsonValue(source, name);
  if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) return yamlBlock(source, name);
  return symbolText(source, name);
}

/**
 * 인용 옆에 기록하는 짧은 지문. 충돌할 가능성은 낮을 만큼 길고, 읽을 수 있을 만큼 짧다. 줄 끝을
 * 정규화하므로 CRLF를 쓰는 checkout도 LF와 같은 지문을 기록한다.
 */
export function symbolDigest(text: string): string {
  return createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex').slice(0, 12);
}
