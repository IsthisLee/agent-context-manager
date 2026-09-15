import fs from 'node:fs';
import path from 'node:path';

/** Folders never searched for instruction files: dependencies, build output, and agctx's own copies. */
export const SKIPPED_FOLDERS: ReadonlySet<string> = new Set(['.git', 'node_modules', '.agctx', 'dist', 'build', 'vendor', '.venv', 'target', 'coverage']);
const MAX_SCANNED_FOLDERS = 5000;

/**
 * Files named one of `names` in folders below `start` (not in `start` itself),
 * skipping SKIPPED_FOLDERS and nested repositories, which own their own guidance.
 */
export function filesBelow(start: string, names: readonly string[]): string[] {
  const found: string[] = [];
  const queue = [start];
  let scanned = 0;
  while (queue.length && scanned < MAX_SCANNED_FOLDERS) {
    const dir = queue.shift() as string;
    scanned += 1;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_FOLDERS.has(entry.name) && !fs.existsSync(path.join(full, '.git'))) queue.push(full);
      } else if (dir !== start && names.includes(entry.name)) {
        found.push(full);
      }
    }
  }
  return found.sort();
}
