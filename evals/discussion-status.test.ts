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

/** `topics`에서 만드는 생성 파일을 모두 경로별로 렌더링하고, 아무것도 쓰지 않는다. */
function rendered(topics: DiscussionTopics): Map<string, string> {
  return new Map(discussionOutputs(topics).map(output => [output.file, output.render(read(output.file))]));
}

test('생성된 상태 줄, 논의 색인, README 상태 목록은 topics.json과 맞다', () => {
  for (const output of discussionOutputs(readTopics(repoRoot))) {
    const content = read(output.file);
    assert.equal(
      content,
      output.render(content),
      `${output.file}이 최신이 아니다. node tools/generate-discussion-status.ts를 실행하라`
    );
  }
});

test('topics.json의 상태 하나를 바꾸면 주제, 색인 행, 단계 도표, 두 README 목록이 다시 쓰인다', () => {
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
    'topics.json을 한 번 고치면 상태를 보여 주는 모든 곳에 닿는다'
  );

  assert.match(after.get('docs/discussion/architecture/topics/profile-import.md')!, /^\*\*상태:\*\* Implementing$/m);
  const index = after.get('docs/discussion/architecture/README.md')!;
  assert.match(index, /\(topics\/profile-import\.md\) \|.*\| Implementing \|$/m);
  assert.match(index, /^ {2}class [^\n]*\bS14\b[^\n]* doing$/m, '단계 도표가 그 단계를 진행 중 색으로 칠한다');
  assert.match(after.get('README.md')!, /^- \*\*구현 중:\*\* .*기존 저장소에서 프로필 만들기/m);
  assert.match(after.get('README.en.md')!, /^- \*\*In progress:\*\* .*creating a Profile from an existing repository/m);
});

test('저장소 영역 색인에는 단계 열이 없고 README는 패키지 주제만 나열한다', () => {
  const index = read('docs/discussion/repository/README.md');
  assert.match(index, /^\| 주제 \| 중요도 \| 핵심 결과 \| 상태 \|$/m);
  for (const topic of readTopics(repoRoot).repository) {
    assert.ok(!read('README.md').includes(topic.title), `${topic.file}은 패키지 기능이 아니라 저장소에 관한 주제다`);
  }
});

test('이미 구현 기록이 있는 주제는 Proposed로 남을 수 없다', () => {
  assert.equal(forbidsImplementationRecord('Proposed'), true);
  assert.equal(forbidsImplementationRecord('Implementing'), false, 'Implementing 주제는 구현한 범위마다 기록을 모은다');
  assert.equal(forbidsImplementationRecord('Implemented'), false);

  const checker = read('tools/check-docs.ts');
  assert.match(checker, /forbidsImplementationRecord/);
  assert.match(checker, /readTopics/);
  assert.ok(fs.existsSync(path.join(repoRoot, TOPICS_FILE)));
});

test('주제가 제안 요약에 적은 중요도는 topics.json과 같아야 한다', () => {
  assert.equal(summaryImportance('| 항목 | 내용 |\n| 중요도 | High — 사용자 경계를 정한다. |\n'), 'High');
  assert.equal(summaryImportance('| 중요도 | Medium: 문서 유지 비용을 줄인다. |'), 'Medium');
  assert.equal(
    summaryImportance('| 제안 목표 | 중요도를 적지 않은 문서 |'),
    undefined,
    '그 필드가 없는 문서는 중요도를 밝히지 않은 것이다'
  );

  const topics = readTopics(repoRoot);
  for (const [area, list] of Object.entries(topics)) {
    for (const topic of list) {
      const stated = summaryImportance(read(`docs/discussion/${area}/topics/${topic.file}`));
      assert.equal(
        stated,
        topic.importance,
        `${area}/${topic.file}은 ${stated}라고 적었지만 topics.json은 ${topic.importance}다`
      );
    }
  }
  assert.match(read('tools/check-docs.ts'), /summaryImportance/);
});

test('핀한 문서는 생성 블록을 빼고 해시하므로, README 하나를 다시 만들어도 다른 README가 실패하지 않는다', () => {
  const block = (body: string) =>
    `# 제목\n\n<!-- agctx:generated:discussion-status:start -->\n${body}\n<!-- agctx:generated:discussion-status:end -->\n\n본문\n`;

  assert.equal(withoutGeneratedBlocks(block('- **구현됨:** A')), withoutGeneratedBlocks(block('- **구현됨:** A, B')));
  assert.notEqual(
    withoutGeneratedBlocks(block('- **구현됨:** A')),
    withoutGeneratedBlocks(block('- **구현됨:** A').replace('본문', '바뀐 본문')),
    '생성 블록 밖의 글은 여전히 해시한다'
  );
});
