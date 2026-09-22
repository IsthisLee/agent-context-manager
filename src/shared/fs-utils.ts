import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

/**
 * 심볼릭 링크나 일반 파일이 아닌 것을 바꾸려 하면 거부한다. 경계가 주어지면, 그 안의 부모 경로가
 * 심볼릭 링크나 파일인 대상도 거부한다.
 */
export function assertSafeTextTarget(target: string, boundary: string | null = null): void {
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw new Error(`Refusing to replace symbolic link: ${target}`);
    if (!stat.isFile()) throw new Error(`Refusing to replace non-regular file: ${target}`);
  } catch (error) {
    if (errorCode(error) === 'ENOTDIR') throw new Error(`Parent path is not a directory: ${target}`, { cause: error });
    if (errorCode(error) !== 'ENOENT') throw error;
  }

  if (!boundary) return;
  const resolvedBoundary = path.resolve(boundary);
  let current = path.resolve(path.dirname(target));
  while (current !== resolvedBoundary && current.startsWith(`${resolvedBoundary}${path.sep}`)) {
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(`Refusing to use symbolic-link parent path: ${current}`);
      if (!stat.isDirectory()) throw new Error(`Parent path is not a directory: ${current}`);
    } catch (error) {
      if (errorCode(error) === 'ENOENT') {
        current = path.dirname(current);
        continue;
      }
      if (errorCode(error) === 'ENOTDIR')
        throw new Error(`Parent path is not a directory: ${current}`, { cause: error });
      throw error;
    }
    current = path.dirname(current);
  }
}

/**
 * CRLF 줄 끝을 LF로 바꾼 글. agctx가 지침을 비교하고 해시하는 형태다.
 * Git for Windows는 파일을 CRLF로 checkout한다(core.autocrlf).
 */
export function toLf(text: string): string {
  return text.replaceAll('\r\n', '\n');
}

/** 같은 폴더의 임시 파일을 거쳐 UTF-8 텍스트 파일을 바꾼다. 파일 모드와 CRLF 줄 끝은 유지한다. */
export function writeTextAtomic(target: string, content: string): void {
  assertSafeTextTarget(target);
  let mode = 0o666;
  let crlf = false;
  try {
    const stat = fs.lstatSync(target);
    mode = stat.mode & 0o777;
    // CRLF로 checkout한 파일은 CRLF를 유지해서, 다시 써도 모든 줄이 diff가 되지 않게 한다.
    crlf = fs.readFileSync(target, 'utf8').includes('\r\n');
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.agctx-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, crlf ? toLf(content).replaceAll('\n', '\r\n') : content, { encoding: 'utf8', mode });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

/** `target` 자체가 심볼릭 링크인지. 링크를 따라가지 않는다. */
export function isSymbolicLink(target: string): boolean {
  try {
    return fs.lstatSync(target).isSymbolicLink();
  } catch {
    return false;
  }
}
