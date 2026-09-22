import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { markerPair } from './generate-reference.ts';
import { readTopics, TOPICS_FILE, type DiscussionTopic, type DiscussionTopics } from './discussion-topics.ts';

/**
 * Keep every place that shows a discussion topic's status in step with
 * docs/discussion/topics.json: the status line of each topic document, the
 * topic table of each area index, the stage diagram of the implementation plan
 * and the status lists of both READMEs. Everything outside the generated
 * blocks is written by people.
 *
 *   node tools/generate-discussion-status.ts          rewrite the generated blocks
 *   node tools/generate-discussion-status.ts --check  exit 1 when a block is out of date
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The README introduces the package, so its lists show only the implementation plan. */
const README_AREA = 'architecture';

/** Mermaid has no HTML comments, so the stage diagram marks its generated lines with `%%` comments. */
const DIAGRAM_MARKERS: readonly [string, string] = [
  '%% agctx:generated:stage-classes:start',
  '%% agctx:generated:stage-classes:end'
];

/** Node class of a stage in the diagram, in the order the class lines are written. */
const DIAGRAM_CLASSES: ReadonlyArray<[status: string, className: string]> = [
  ['Implemented', 'done'],
  ['Implementing', 'doing'],
  ['Proposed', 'todo']
];

interface ReadmeList {
  file: string;
  title: (topic: DiscussionTopic) => string;
  labels: ReadonlyArray<[status: string, label: string]>;
  proposedNote: string;
}

const README_LISTS: readonly ReadmeList[] = [
  {
    file: 'README.md',
    title: topic => topic.title,
    labels: [
      ['Implemented', '구현됨'],
      ['Implementing', '구현 중'],
      ['Proposed', '제안 단계']
    ],
    proposedNote: '아직 현재 동작이 아니므로 보장하지 않습니다.'
  },
  {
    file: 'README.en.md',
    title: topic => {
      if (!topic.titleEn) throw new Error(`${TOPICS_FILE}: ${topic.file} needs titleEn for README.en.md`);
      return topic.titleEn;
    },
    labels: [
      ['Implemented', 'Implemented'],
      ['Implementing', 'In progress'],
      ['Proposed', 'Proposed']
    ],
    proposedNote: 'These are not current behavior yet.'
  }
];

/** Replace the lines between two marker lines, keeping the markers and their indentation. */
function replaceBetween(content: string, [start, end]: readonly [string, string], body: string): string {
  const lines = content.split('\n');
  const from = lines.findIndex(line => line.trim() === start);
  const to = lines.findIndex((line, index) => index > from && line.trim() === end);
  if (from < 0 || to < 0) throw new Error(`Add ${start} and ${end} before generating.`);
  return [...lines.slice(0, from + 1), ...body.split('\n'), ...lines.slice(to)].join('\n');
}

const orDash = (value: string | undefined) => value || '—';
const isStaged = (topics: readonly DiscussionTopic[]) => topics.some(topic => topic.stage !== undefined);

export function topicTable(topics: readonly DiscussionTopic[]): string {
  const staged = isStaged(topics);
  const header = staged
    ? ['단계', '주제', '중요도', '선행 단계', '핵심 결과', '상태']
    : ['주제', '중요도', '핵심 결과', '상태'];
  const row = (topic: DiscussionTopic) => {
    const link = `[${topic.title}](topics/${topic.file})`;
    const cells = staged
      ? [
          orDash(topic.stage?.toString()),
          link,
          orDash(topic.importance),
          orDash(topic.prerequisites?.join('·')),
          topic.outcome,
          topic.status
        ]
      : [link, orDash(topic.importance), topic.outcome, topic.status];
    return `| ${cells.join(' | ')} |`;
  };
  return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...topics.map(row)].join('\n');
}

/** Diagram nodes are named `S<stage>`; each status gets one `class` line, left out when no stage has it. */
export function stageClasses(topics: readonly DiscussionTopic[]): string {
  return DIAGRAM_CLASSES.flatMap(([status, className]) => {
    const stages = topics
      .flatMap(topic => (topic.status === status && topic.stage !== undefined ? [topic.stage] : []))
      .sort((a, b) => a - b);
    return stages.length ? [`  class ${stages.map(stage => `S${stage}`).join(',')} ${className}`] : [];
  }).join('\n');
}

export function statusList(topics: readonly DiscussionTopic[], readme: ReadmeList): string {
  return readme.labels
    .flatMap(([status, label]) => {
      const names = topics.filter(topic => topic.status === status).map(readme.title);
      if (!names.length) return [];
      return [`- **${label}:** ${names.join(', ')}${status === 'Proposed' ? `. ${readme.proposedNote}` : ''}`];
    })
    .join('\n');
}

function renderIndex(content: string, topics: readonly DiscussionTopic[]): string {
  const withTable = replaceBetween(content, markerPair('topics'), topicTable(topics));
  return isStaged(topics) ? replaceBetween(withTable, DIAGRAM_MARKERS, stageClasses(topics)) : withTable;
}

export interface GeneratedFile {
  file: string;
  render: (content: string) => string;
}

export function discussionOutputs(topics: DiscussionTopics): GeneratedFile[] {
  const areaFiles = Object.entries(topics).flatMap(([area, list]) => [
    { file: `docs/discussion/${area}/README.md`, render: (content: string) => renderIndex(content, list) },
    ...list.map(topic => ({
      file: `docs/discussion/${area}/topics/${topic.file}`,
      render: (content: string) => replaceBetween(content, markerPair('status'), `**상태:** ${topic.status}`)
    }))
  ]);
  const readmeFiles = README_LISTS.map(readme => ({
    file: readme.file,
    render: (content: string) =>
      replaceBetween(content, markerPair('discussion-status'), statusList(topics[README_AREA] ?? [], readme))
  }));
  return [...areaFiles, ...readmeFiles];
}

function main(argv: readonly string[]): void {
  const check = argv.includes('--check');
  const stale: string[] = [];
  for (const output of discussionOutputs(readTopics(repoRoot))) {
    const file = path.join(repoRoot, output.file);
    const current = fs.readFileSync(file, 'utf8');
    const next = output.render(current);
    if (current === next) continue;
    if (check) stale.push(output.file);
    else fs.writeFileSync(file, next);
  }
  if (stale.length) {
    process.stderr.write(
      `Generated discussion status is out of date: ${stale.join(', ')}. Run node tools/generate-discussion-status.ts.\n`
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main(process.argv.slice(2));
