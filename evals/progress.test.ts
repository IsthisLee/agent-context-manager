import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { recentEntries, renderRecent, RECENT_MARKER } from '../tools/generate-progress.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const progress = () => fs.readFileSync(path.join(repoRoot, 'PROGRESS.md'), 'utf8');

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

test('every line of the recent log matches a real commit, so nobody can write one by hand', () => {
  const [start, end] = RECENT_MARKER;
  const content = progress();
  const block = content.slice(content.indexOf(start) + start.length, content.indexOf(end)).trim();
  const subjects = new Set(execSync('git log --format=%s -n 200', { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n'));

  for (const line of block.split('\n').filter(Boolean)) {
    const match = line.match(/^- (\d{4}-\d{2}-\d{2}): (.+)$/);
    assert.ok(match, `a line of the recent log has the generated shape: ${line}`);
    assert.ok(subjects.has(match[2]), `no commit says: ${match[2]}`);
  }
});

test('the entries come from the history newest first', () => {
  const entries = recentEntries(repoRoot, 5);

  assert.equal(entries.length, 5);
  assert.match(entries[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(entries[0].date >= entries[4].date, 'newest first');
});
