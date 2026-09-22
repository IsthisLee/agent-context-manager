import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  IN_PROGRESS_MARKER,
  progressRow,
  recentEntries,
  renderInProgress,
  renderRecent,
  RECENT_MARKER
} from '../tools/generate-progress.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const progress = () => fs.readFileSync(path.join(repoRoot, 'PROGRESS.md'), 'utf8');

/** A shallow clone holds one commit, so the history checks have nothing to compare against. */
const shallowClone =
  execSync('git rev-parse --is-shallow-repository', { cwd: repoRoot, encoding: 'utf8' }).trim() === 'true';

test('the recent log is rendered from the commit history, one line per commit', () => {
  const entries = [
    { date: '2026-09-20', subject: 'docs: 진행 파일의 최근 기록을 생성한다' },
    { date: '2026-09-19', subject: 'chore(release): 0.4.0 (#66)' }
  ];

  assert.equal(
    renderRecent(entries),
    '- 2026-09-20: docs: 진행 파일의 최근 기록을 생성한다\n- 2026-09-19: chore(release): 0.4.0 (#66)'
  );
});

test('the progress file carries the generated block', () => {
  const [start, end] = RECENT_MARKER;
  const content = progress();

  assert.ok(content.includes(start) && content.includes(end), 'run node tools/generate-progress.ts');
  assert.ok(content.indexOf(start) < content.indexOf(end));
});

test('every line of the recent log matches a real commit, so nobody can write one by hand', t => {
  if (shallowClone) return t.skip('shallow clone: no history to compare against');
  const [start, end] = RECENT_MARKER;
  const content = progress();
  const block = content.slice(content.indexOf(start) + start.length, content.indexOf(end)).trim();
  const subjects = new Set(
    execSync('git log --format=%s -n 200', { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n')
  );

  for (const line of block.split('\n').filter(Boolean)) {
    const match = line.match(/^- (\d{4}-\d{2}-\d{2}): (.+)$/);
    assert.ok(match, `a line of the recent log has the generated shape: ${line}`);
    assert.ok(subjects.has(match[2]), `no commit says: ${match[2]}`);
  }
});

test('the entries come from the history newest first', t => {
  if (shallowClone) return t.skip('shallow clone: no history to compare against');
  const entries = recentEntries(repoRoot, 5);

  assert.equal(entries.length, 5);
  assert.match(entries[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(entries[0].date >= entries[4].date, 'newest first');
});

test('a generated row rewrites the topic links so they work from the repository root', () => {
  const row = progressRow({
    area: 'repository',
    file: 'doc-gate-pin-scope.md',
    title: '문서 소스 해시 게이트의 핀 범위와 승인 단위',
    next: '[결정](#결정) 절대로 진행하고 [ADR 0024](../../../adr/0024-guidance-evidence-and-budget.md)를 본다.'
  });

  assert.equal(
    row,
    '| [문서 소스 해시 게이트의 핀 범위와 승인 단위](docs/discussion/repository/topics/doc-gate-pin-scope.md)' +
      ' | [결정](docs/discussion/repository/topics/doc-gate-pin-scope.md#결정) 절대로 진행하고' +
      ' [ADR 0024](docs/adr/0024-guidance-evidence-and-budget.md)를 본다. |'
  );
});

test('every topic that is being implemented shows up in the generated table', () => {
  const [start, end] = IN_PROGRESS_MARKER;
  const content = progress();
  const block = content.slice(content.indexOf(start) + start.length, content.indexOf(end));
  const topics = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/discussion/topics.json'), 'utf8')) as Record<
    string,
    Array<{ title: string; status: string }>
  >;

  for (const list of Object.values(topics)) {
    for (const topic of list.filter(item => item.status === 'Implementing')) {
      assert.ok(block.includes(topic.title), `the table shows ${topic.title}`);
    }
  }
  assert.equal(block, `\n${renderInProgress(repoRoot)}\n`, 'run node tools/generate-progress.ts');
});
