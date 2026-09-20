import fs from 'node:fs';
import path from 'node:path';
import { readTopics } from './discussion-topics.ts';
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

export const IN_PROGRESS_MARKER: readonly [start: string, end: string] = [
  '<!-- agctx:generated:in-progress:start -->',
  '<!-- agctx:generated:in-progress:end -->'
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

export interface TopicRow {
  area: string;
  file: string;
  title: string;
  /** The topic's own `권장 다음 작업` cell, written relative to the topic document. */
  next: string;
}

/** A link written inside a topic document, rewritten to work from the repository root. */
function fromRoot(area: string, file: string, target: string): string {
  const topicDir = path.posix.join('docs/discussion', area, 'topics');
  if (/^(https?:|mailto:)/i.test(target)) return target;
  if (target.startsWith('#')) return `${path.posix.join(topicDir, file)}${target}`;
  return path.posix.normalize(path.posix.join(topicDir, target));
}

export function progressRow(topic: TopicRow): string {
  const next = topic.next.replace(/\]\(([^)\s]+)\)/g, (whole, target: string) => `](${fromRoot(topic.area, topic.file, target)})`);
  return `| [${topic.title}](${path.posix.join('docs/discussion', topic.area, 'topics', topic.file)}) | ${next} |`;
}

/** The `권장 다음 작업` cell of a topic's proposal summary. */
function recommendedNext(root: string, area: string, file: string): string {
  const content = fs.readFileSync(path.join(root, 'docs', 'discussion', area, 'topics', file), 'utf8');
  const match = content.match(/^\| 권장 다음 작업 \| (.+?) \|$/m);
  if (!match) throw new Error(`${area}/${file}: add a 권장 다음 작업 row to the proposal summary.`);
  return match[1].trim();
}

/** Topics that are being implemented, as the table the progress file shows. */
export function renderInProgress(root: string): string {
  const topics = readTopics(root);
  const rows = Object.entries(topics).flatMap(([area, list]) =>
    list.filter(topic => topic.status === 'Implementing')
      .map(topic => progressRow({ area, file: topic.file, title: topic.title, next: recommendedNext(root, area, topic.file) }))
  );
  return ['| 주제 | 다음에 할 일 |', '| --- | --- |', ...rows].join('\n');
}

function main(): void {
  const file = path.join(repoRoot, PROGRESS_FILE);
  const content = fs.readFileSync(file, 'utf8');
  const [start, end] = RECENT_MARKER;
  const from = content.indexOf(start);
  const to = content.indexOf(end);
  if (from < 0 || to < from) throw new Error(`Add ${start} and ${end} to ${PROGRESS_FILE} before generating.`);

  const withRecent = `${content.slice(0, from + start.length)}\n${renderRecent(recentEntries(repoRoot))}\n${content.slice(to)}`;

  const [tableStart, tableEnd] = IN_PROGRESS_MARKER;
  const tableFrom = withRecent.indexOf(tableStart);
  const tableTo = withRecent.indexOf(tableEnd);
  if (tableFrom < 0 || tableTo < tableFrom) throw new Error(`Add ${tableStart} and ${tableEnd} to ${PROGRESS_FILE} before generating.`);
  const next = `${withRecent.slice(0, tableFrom + tableStart.length)}\n${renderInProgress(repoRoot)}\n${withRecent.slice(tableTo)}`;

  if (next === content) {
    console.log('Progress file already current.');
    return;
  }
  fs.writeFileSync(file, next);
  console.log(`Rewrote the generated blocks in ${PROGRESS_FILE}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
