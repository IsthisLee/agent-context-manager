import fs from 'node:fs';
import path from 'node:path';

/** 지침 파일을 찾지 않는 폴더: 의존성, 빌드 결과, agctx 자신의 사본. */
export const SKIPPED_FOLDERS: ReadonlySet<string> = new Set([
  '.git',
  'node_modules',
  '.agctx',
  'dist',
  'build',
  'vendor',
  '.venv',
  'target',
  'coverage'
]);
const MAX_SCANNED_FOLDERS = 5000;

/**
 * `start` 아래 폴더(`start` 자체는 빼고)에서 이름이 `names` 중 하나인 파일. SKIPPED_FOLDERS와,
 * 자기 지침을 따로 갖는 중첩 저장소는 건너뛴다.
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
