import { createHash } from 'node:crypto';

/**
 * Cuts out the piece of a file that a documentation citation points at, so the
 * gate can fingerprint it and notice when it changes. Three kinds of files are
 * cited: TypeScript declarations, JSON keys and YAML keys. A line-based cut is
 * enough because this repository cites top-level declarations and keys, and it
 * keeps the tools free of a parser dependency: TypeScript 7 ships no
 * JavaScript parser API. The decision is in
 * docs/discussion/repository/topics/code-citation-style.md.
 */

const KEYWORDS = ['function', 'const', 'let', 'var', 'class', 'interface', 'type', 'enum'];

const escaped = (name: string) => name.replaceAll('$', '\\$');

/** `export async function name`, `const name`, `export interface name` and the like. */
function declares(line: string, name: string): boolean {
  return new RegExp(
    `^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:declare\\s+)?(?:${KEYWORDS.join('|')})\\s+${escaped(name)}\\b`
  ).test(line);
}

/** A line that starts another top-level declaration or its doc comment. */
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

/** The value of a JSON key, at the top level or one of the nested objects, as canonical JSON. */
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

/** A YAML key and the indented block under it. */
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
 * The cited piece of a file, chosen by the file's kind. A citation that points
 * at another document carries no fingerprint: its prose changes constantly and
 * the pointing document does not describe it.
 */
export function citedText(filePath: string, source: string, name: string): string | null {
  if (filePath.endsWith('.md')) return null;
  if (filePath.endsWith('.json')) return jsonValue(source, name);
  if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) return yamlBlock(source, name);
  return symbolText(source, name);
}

/**
 * Short digest recorded beside a citation; long enough to make a collision
 * unlikely, short enough to read. Line endings are normalized so a checkout
 * that uses CRLF records the same digest as one that uses LF.
 */
export function symbolDigest(text: string): string {
  return createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex').slice(0, 12);
}
