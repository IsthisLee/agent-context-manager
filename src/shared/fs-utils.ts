import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

/**
 * Refuse to replace a symbolic link or a non-regular file, and, when a boundary
 * is given, a target whose parent path inside it is a symbolic link or a file.
 */
export function assertSafeTextTarget(target: string, boundary: string | null = null): void {
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw new Error(`Refusing to replace symbolic link: ${target}`);
    if (!stat.isFile()) throw new Error(`Refusing to replace non-regular file: ${target}`);
  } catch (error) {
    if (errorCode(error) === 'ENOTDIR') throw new Error(`Parent path is not a directory: ${target}`);
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
      if (errorCode(error) === 'ENOTDIR') throw new Error(`Parent path is not a directory: ${current}`);
      throw error;
    }
    current = path.dirname(current);
  }
}

/** Replace a UTF-8 text file through a same-directory temporary file, keeping its mode. */
export function writeTextAtomic(target: string, content: string): void {
  assertSafeTextTarget(target);
  let mode = 0o666;
  try {
    const stat = fs.lstatSync(target);
    mode = stat.mode & 0o777;
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.agentic-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf8', mode });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
