import fs from 'node:fs';
import path from 'node:path';
import { readTopics } from './discussion-topics.ts';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * 커밋 이력으로 PROGRESS.md의 최근 기록을 채운다. 한 일은 이미 git에 있으므로 아무도 그 목록을 손으로
 * 쓰지 않는다. 진행 파일에는 git이 말해 주지 않는 것만 남긴다: 진행 중인 일, 다음 단계, 알려진 한계,
 * 이미 해 보고 버린 접근.
 *
 *   node tools/generate-progress.ts   git log로 블록을 다시 쓴다
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

/** 최근 기록이 보여 주는 커밋 수. 더 오래된 이력은 `git log`로 읽는다. */
const RECENT_COUNT = 10;

export interface RecentEntry {
  date: string;
  subject: string;
}

/**
 * 최근 기록이 따르는 이력. pull request는 squash로 병합하므로 브랜치 자체의 커밋은 병합하면 사라진다.
 * 그래서 기록은 이미 기본 브랜치에 있는 것을 나열하고, 그것은 병합 뒤에도 사실로 남는다.
 */
function historyRef(root: string): string {
  for (const ref of ['main', 'origin/main']) {
    try {
      execSync(`git rev-parse --verify --quiet ${ref}`, { cwd: root, stdio: 'ignore' });
      return ref;
    } catch {
      continue;
    }
  }
  return 'HEAD';
}

export function recentEntries(root: string, count = RECENT_COUNT): RecentEntry[] {
  const log = execSync(`git log ${historyRef(root)} --first-parent --format=%ad%x09%s --date=short -n ${count}`, {
    cwd: root,
    encoding: 'utf8'
  });
  return log
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
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
  /** 주제 자신의 `권장 다음 작업` 칸. 주제 문서 기준으로 쓴다. */
  next: string;
}

/** 주제 문서 안에 쓴 링크를 저장소 루트에서 동작하도록 다시 쓴 것. */
function fromRoot(area: string, file: string, target: string): string {
  const topicDir = path.posix.join('docs/discussion', area, 'topics');
  if (/^(https?:|mailto:)/i.test(target)) return target;
  if (target.startsWith('#')) return `${path.posix.join(topicDir, file)}${target}`;
  return path.posix.normalize(path.posix.join(topicDir, target));
}

export function progressRow(topic: TopicRow): string {
  const next = topic.next.replace(
    /\]\(([^)\s]+)\)/g,
    (whole, target: string) => `](${fromRoot(topic.area, topic.file, target)})`
  );
  return `| [${topic.title}](${path.posix.join('docs/discussion', topic.area, 'topics', topic.file)}) | ${next} |`;
}

/** 주제 제안 요약의 `권장 다음 작업` 칸. */
function recommendedNext(root: string, area: string, file: string): string {
  const content = fs.readFileSync(path.join(root, 'docs', 'discussion', area, 'topics', file), 'utf8');
  const match = content.match(/^\| 권장 다음 작업 \| (.+?) \|$/m);
  if (!match) throw new Error(`${area}/${file}: add a 권장 다음 작업 row to the proposal summary.`);
  return match[1].trim();
}

/** 구현 중인 주제. 진행 파일이 보여 주는 표 형태다. */
export function renderInProgress(root: string): string {
  const topics = readTopics(root);
  const rows = Object.entries(topics).flatMap(([area, list]) =>
    list
      .filter(topic => topic.status === 'Implementing')
      .map(topic =>
        progressRow({ area, file: topic.file, title: topic.title, next: recommendedNext(root, area, topic.file) })
      )
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
  if (tableFrom < 0 || tableTo < tableFrom)
    throw new Error(`Add ${tableStart} and ${tableEnd} to ${PROGRESS_FILE} before generating.`);
  const next = `${withRecent.slice(0, tableFrom + tableStart.length)}\n${renderInProgress(repoRoot)}\n${withRecent.slice(tableTo)}`;

  if (next === content) {
    console.log('Progress file already current.');
    return;
  }
  fs.writeFileSync(file, next);
  console.log(`Rewrote the generated blocks in ${PROGRESS_FILE}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
