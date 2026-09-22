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

/** 얕은 clone에는 커밋이 하나뿐이라 이력 검사가 비교할 대상이 없다. */
const shallowClone =
  execSync('git rev-parse --is-shallow-repository', { cwd: repoRoot, encoding: 'utf8' }).trim() === 'true';

test('최근 기록은 커밋 이력에서 커밋마다 한 줄로 렌더링한다', () => {
  const entries = [
    { date: '2026-09-20', subject: 'docs: 진행 파일의 최근 기록을 생성한다' },
    { date: '2026-09-19', subject: 'chore(release): 0.4.0 (#66)' }
  ];

  assert.equal(
    renderRecent(entries),
    '- 2026-09-20: docs: 진행 파일의 최근 기록을 생성한다\n- 2026-09-19: chore(release): 0.4.0 (#66)'
  );
});

test('진행 파일에 생성 블록이 있다', () => {
  const [start, end] = RECENT_MARKER;
  const content = progress();

  assert.ok(content.includes(start) && content.includes(end), 'node tools/generate-progress.ts를 실행하라');
  assert.ok(content.indexOf(start) < content.indexOf(end));
});

test('최근 기록의 모든 줄은 실제 커밋과 맞으므로 아무도 손으로 쓸 수 없다', t => {
  if (shallowClone) return t.skip('shallow clone: no history to compare against');
  const [start, end] = RECENT_MARKER;
  const content = progress();
  const block = content.slice(content.indexOf(start) + start.length, content.indexOf(end)).trim();
  const subjects = new Set(
    execSync('git log --format=%s -n 200', { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n')
  );

  for (const line of block.split('\n').filter(Boolean)) {
    const match = line.match(/^- (\d{4}-\d{2}-\d{2}): (.+)$/);
    assert.ok(match, `최근 기록의 줄이 생성된 모양이다: ${line}`);
    assert.ok(subjects.has(match[2]), `이렇게 말하는 커밋이 없다: ${match[2]}`);
  }
});

test('항목은 이력에서 최신순으로 온다', t => {
  if (shallowClone) return t.skip('shallow clone: no history to compare against');
  const entries = recentEntries(repoRoot, 5);

  assert.equal(entries.length, 5);
  assert.match(entries[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(entries[0].date >= entries[4].date, '최신순');
});

test('생성된 행은 주제 링크를 저장소 루트에서 동작하도록 다시 쓴다', () => {
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

test('구현 중인 주제는 모두 생성된 표에 나온다', () => {
  const [start, end] = IN_PROGRESS_MARKER;
  const content = progress();
  const block = content.slice(content.indexOf(start) + start.length, content.indexOf(end));
  const topics = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/discussion/topics.json'), 'utf8')) as Record<
    string,
    Array<{ title: string; status: string }>
  >;

  for (const list of Object.values(topics)) {
    for (const topic of list.filter(item => item.status === 'Implementing')) {
      assert.ok(block.includes(topic.title), `표에 ${topic.title}이 나온다`);
    }
  }
  assert.equal(block, `\n${renderInProgress(repoRoot)}\n`, 'node tools/generate-progress.ts를 실행하라');
});
