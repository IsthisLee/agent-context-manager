import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Fills the recent log of PROGRESS.md from the commit history. What was done
 * is already in git, so nobody writes that list by hand: the progress file
 * keeps only what git cannot say, which is the work in progress, the next
 * step, the known limits and the approaches already tried and dropped.
 *
 *   node tools/generate-progress.ts   rewrite the block from git log
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PROGRESS_FILE = 'PROGRESS.md';
export const RECENT_MARKER: readonly [start: string, end: string] = [
  '<!-- agctx:generated:recent:start -->',
  '<!-- agctx:generated:recent:end -->'
];

/** How many commits the recent log shows. Older history is read with `git log`. */
const RECENT_COUNT = 10;

export interface RecentEntry {
  date: string;
  subject: string;
}

export function recentEntries(root: string, count = RECENT_COUNT): RecentEntry[] {
  const log = execSync(`git log --first-parent --format=%ad%x09%s --date=short -n ${count}`, { cwd: root, encoding: 'utf8' });
  return log.trim().split('\n').filter(Boolean).map(line => {
    const [date, ...rest] = line.split('\t');
    return { date, subject: rest.join('\t') };
  });
}

export function renderRecent(entries: readonly RecentEntry[]): string {
  return entries.map(entry => `- ${entry.date}: ${entry.subject}`).join('\n');
}

function main(): void {
  const file = path.join(repoRoot, PROGRESS_FILE);
  const content = fs.readFileSync(file, 'utf8');
  const [start, end] = RECENT_MARKER;
  const from = content.indexOf(start);
  const to = content.indexOf(end);
  if (from < 0 || to < from) throw new Error(`Add ${start} and ${end} to ${PROGRESS_FILE} before generating.`);

  const next = `${content.slice(0, from + start.length)}\n${renderRecent(recentEntries(repoRoot))}\n${content.slice(to)}`;
  if (next === content) {
    console.log('Recent log already current.');
    return;
  }
  fs.writeFileSync(file, next);
  console.log(`Rewrote the recent log in ${PROGRESS_FILE}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
