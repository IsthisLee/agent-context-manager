import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTopics, summaryImportance, TOPICS_FILE, type DiscussionTopics } from '../tools/discussion-topics.ts';
import { discussionOutputs } from '../tools/generate-discussion-status.ts';
import { forbidsImplementationRecord } from '../tools/discussion-record.ts';
import { withoutGeneratedBlocks } from '../tools/doc-sources.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

/** Render every generated file from `topics`, keyed by path, without writing anything. */
function rendered(topics: DiscussionTopics): Map<string, string> {
  return new Map(discussionOutputs(topics).map(output => [output.file, output.render(read(output.file))]));
}

test('generated status lines, discussion indexes and README status lists match topics.json', () => {
  for (const output of discussionOutputs(readTopics(repoRoot))) {
    const content = read(output.file);
    assert.equal(
      content,
      output.render(content),
      `${output.file} is out of date; run node tools/generate-discussion-status.ts`
    );
  }
});

test('changing one status in topics.json rewrites the topic, its index row, the stage diagram and both README lists', () => {
  const topics = readTopics(repoRoot);
  const before = rendered(topics);
  const changed: DiscussionTopics = {
    ...topics,
    architecture: topics.architecture.map(topic =>
      topic.file === 'profile-import.md' ? { ...topic, status: 'Implementing' } : topic
    )
  };
  const after = rendered(changed);

  const rewritten = [...after]
    .filter(([file, content]) => before.get(file) !== content)
    .map(([file]) => file)
    .sort();
  assert.deepEqual(
    rewritten,
    [
      'README.en.md',
      'README.md',
      'docs/discussion/architecture/README.md',
      'docs/discussion/architecture/topics/profile-import.md'
    ],
    'one edit to topics.json reaches every place that shows the status'
  );

  assert.match(after.get('docs/discussion/architecture/topics/profile-import.md')!, /^\*\*상태:\*\* Implementing$/m);
  const index = after.get('docs/discussion/architecture/README.md')!;
  assert.match(index, /\(topics\/profile-import\.md\) \|.*\| Implementing \|$/m);
  assert.match(index, /^ {2}class [^\n]*\bS14\b[^\n]* doing$/m, 'the stage diagram colours the stage as in progress');
  assert.match(after.get('README.md')!, /^- \*\*구현 중:\*\* .*기존 저장소에서 프로필 만들기/m);
  assert.match(after.get('README.en.md')!, /^- \*\*In progress:\*\* .*creating a Profile from an existing repository/m);
});

test('the repository area index has no stage columns and README lists only package topics', () => {
  const index = read('docs/discussion/repository/README.md');
  assert.match(index, /^\| 주제 \| 중요도 \| 핵심 결과 \| 상태 \|$/m);
  for (const topic of readTopics(repoRoot).repository) {
    assert.ok(!read('README.md').includes(topic.title), `${topic.file} is about the repository, not a package feature`);
  }
});

test('a topic that already has an implementation record cannot stay Proposed', () => {
  assert.equal(forbidsImplementationRecord('Proposed'), true);
  assert.equal(
    forbidsImplementationRecord('Implementing'),
    false,
    'Implementing topics collect a record per implemented scope'
  );
  assert.equal(forbidsImplementationRecord('Implemented'), false);

  const checker = read('tools/check-docs.ts');
  assert.match(checker, /forbidsImplementationRecord/);
  assert.match(checker, /readTopics/);
  assert.ok(fs.existsSync(path.join(repoRoot, TOPICS_FILE)));
});

test('the importance a topic states in its proposal summary must match topics.json', () => {
  assert.equal(summaryImportance('| 항목 | 내용 |\n| 중요도 | High — 사용자 경계를 정한다. |\n'), 'High');
  assert.equal(summaryImportance('| 중요도 | Medium: 문서 유지 비용을 줄인다. |'), 'Medium');
  assert.equal(
    summaryImportance('| 제안 목표 | 중요도를 적지 않은 문서 |'),
    undefined,
    'a document without the field states no importance'
  );

  const topics = readTopics(repoRoot);
  for (const [area, list] of Object.entries(topics)) {
    for (const topic of list) {
      const stated = summaryImportance(read(`docs/discussion/${area}/topics/${topic.file}`));
      assert.equal(
        stated,
        topic.importance,
        `${area}/${topic.file} states ${stated} but topics.json says ${topic.importance}`
      );
    }
  }
  assert.match(read('tools/check-docs.ts'), /summaryImportance/);
});

test('a pinned document is hashed without its generated blocks, so regenerating one README does not fail the other', () => {
  const block = (body: string) =>
    `# 제목\n\n<!-- agctx:generated:discussion-status:start -->\n${body}\n<!-- agctx:generated:discussion-status:end -->\n\n본문\n`;

  assert.equal(withoutGeneratedBlocks(block('- **구현됨:** A')), withoutGeneratedBlocks(block('- **구현됨:** A, B')));
  assert.notEqual(
    withoutGeneratedBlocks(block('- **구현됨:** A')),
    withoutGeneratedBlocks(block('- **구현됨:** A').replace('본문', '바뀐 본문')),
    'text outside generated blocks is still hashed'
  );
});
