import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Replace a UTF-8 text file through a same-directory temporary file.
 * Refuse symlink targets so a project path cannot redirect a write elsewhere.
 * @param {string} target
 * @param {string} content
 */
export function assertSafeTextTarget(target, boundary = null) {
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw new Error(`Refusing to replace symbolic link: ${target}`);
    if (!stat.isFile()) throw new Error(`Refusing to replace non-regular file: ${target}`);
  } catch (error) {
    if (error.code === 'ENOTDIR') throw new Error(`Parent path is not a directory: ${target}`);
    if (error.code !== 'ENOENT') throw error;
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
      if (error.code === 'ENOENT') {
        current = path.dirname(current);
        continue;
      }
      if (error.code === 'ENOTDIR') throw new Error(`Parent path is not a directory: ${current}`);
      throw error;
    }
    current = path.dirname(current);
  }
}

export function writeTextAtomic(target, content) {
  assertSafeTextTarget(target);
  let mode = 0o666;
  try {
    const stat = fs.lstatSync(target);
    mode = stat.mode & 0o777;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
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
