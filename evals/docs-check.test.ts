import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('문서 검사기는 저장소 문서 계약을 검증한다', () => {
  const result = spawnSync('node', ['tools/check-docs.ts'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Documentation check passed/);
});

test('문서 검사기는 색인 아래의 architecture 논의 주제를 검증한다', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /path\.join\(discussionDir, 'topics'\)/);
});

test('topics 폴더가 있는 논의 영역은 모두 검사하므로 저장소 주제도 예외가 아니다', async t => {
  const { discussionRoots } = await import('../tools/discussion-roots.ts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-discussion-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  fs.mkdirSync(path.join(dir, 'repository', 'topics'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'architecture', 'topics'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), '# 논의\n');

  assert.deepEqual(discussionRoots(dir), ['architecture', 'repository'], 'topics/가 없는 폴더는 논의 영역이 아니다');
  assert.deepEqual(discussionRoots(path.join(dir, 'missing')), []);

  const areas = fs
    .readdirSync(path.join(repoRoot, 'docs/discussion'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
  assert.deepEqual(
    discussionRoots(path.join(repoRoot, 'docs/discussion')),
    areas,
    '이 저장소의 논의 폴더는 모두 검사기가 순회하는 영역이다'
  );

  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');
  assert.match(checker, /discussionRoots/);
});

test('지침 카탈로그는 사용자용 레퍼런스이고 검사기가 거기서 지킨다', () => {
  assert.ok(
    fs.existsSync(path.join(repoRoot, 'docs/reference/guidance-catalog.md')),
    '사용자가 각 지침 항목이 쓰는 내용을 읽으므로 카탈로그는 다른 사양 문서와 함께 둔다'
  );
  assert.ok(!fs.existsSync(path.join(repoRoot, 'docs/contributing/guidance-catalog.md')));

  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');
  assert.match(checker, /'reference', 'guidance-catalog\.md'/);
  assert.doesNotMatch(checker, /'contributing', 'guidance-catalog\.md'/);
});

test('저장소 운영 논의는 패키지 구현 계획과 따로 둔다', () => {
  const topic = path.join(repoRoot, 'docs/discussion/repository/topics/doc-accuracy-review.md');

  assert.ok(fs.existsSync(topic), '문서 게이트 검토 주제는 저장소 영역에 속한다');
  assert.ok(
    !fs.existsSync(path.join(repoRoot, 'docs/discussion/architecture/topics/doc-accuracy-review.md')),
    '주제는 정확히 한 영역의 색인에 있다'
  );
});

test('문서 검사기는 핀한 폴더를 해시해서 목록을 고치지 않아도 안의 파일을 덮는다', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /walkFiles/);
  assert.match(checker, /isDirectory\(\)/);
});

test('문서 소스 해시의 경로는 모든 플랫폼에서 POSIX라, 한 OS에서 stamp한 해시가 다른 OS에서도 맞는다', async () => {
  const { docSourceHashPath } = await import('../tools/doc-source-path.ts');

  assert.equal(docSourceHashPath('D:\\a\\repo', 'D:\\a\\repo\\src\\agctx.ts', path.win32), 'src/agctx.ts');
  assert.equal(
    docSourceHashPath('D:\\a\\repo', 'D:\\a\\repo\\.github\\workflows\\ci.yml', path.win32),
    '.github/workflows/ci.yml'
  );
  assert.equal(docSourceHashPath('/repo', '/repo/src/agctx.ts', path.posix), 'src/agctx.ts');
});

test('문서 검사기는 완전한 제안 요약을 요구한다', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  for (const field of ['제안 목표', '제안 이유', '결정할 것', '선행 제안', '후속 제안', '연관 제안']) {
    assert.match(checker, new RegExp(field));
  }
});

test('문서 검사기는 ADR 결정자 머리말 필드를 요구한다', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /결정자/);
});

test('문서 검사기는 문서 체계의 진입점이 정본 제안 형식을 링크하게 한다', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /checkDocumentationGovernance/);
  assert.match(checker, /implementation-contracts\.md/);
});

test('문서 검사기는 공개 저장소 운영 계약을 지킨다', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /releasing\.md/);
  assert.match(checker, /SECURITY\.md/);
  assert.match(checker, /SECURITY\.md/);
});

test('문서 검사기는 로컬 Markdown 제목 앵커를 검증한다', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /checkInternalAnchors/);
  assert.match(checker, /markdownHeadingSlug/);
});

test('문서 검사기는 README 제품 진입점과 논의 색인의 무결성을 지킨다', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /checkReadme/);
  assert.match(checker, /must be indexed exactly once/);
  assert.match(checker, /index references missing topic/);
});

test('Implemented 논의 주제는 코드 블록 밖에 구현 기록 제목이 있어야 한다', async () => {
  const { hasImplementationRecord, requiresImplementationRecord } = await import('../tools/discussion-record.ts');

  assert.equal(requiresImplementationRecord('Implemented'), true);
  assert.equal(requiresImplementationRecord('Implementing'), false);
  assert.equal(requiresImplementationRecord('Proposed'), false);
  assert.equal(hasImplementationRecord('# 주제\n\n#### 구현 기록: 프로필 setup\n\n* **결정:** …'), true);
  assert.equal(hasImplementationRecord('# 주제\n\n## 9. 구현 기록\n\n- 내용'), false);
  assert.equal(hasImplementationRecord('```markdown\n#### 구현 기록: <구현한 범위>\n```'), false);

  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');
  assert.match(checker, /hasImplementationRecord/);
  assert.match(checker, /requiresImplementationRecord/);
});

test('문서는 src 폴더 전체가 아니라 소스 모듈을 핀하고, 모든 소스 파일은 어떤 문서가 핀한다', async () => {
  const { unpinnedSources, wholeRootPins } = await import('../tools/doc-sources.ts');

  assert.deepEqual(wholeRootPins(['src', 'src/commands', 'package.json']), ['src']);
  assert.deepEqual(wholeRootPins(['src/', 'templates']), ['src/']);
  assert.deepEqual(
    unpinnedSources(
      ['src/agctx.ts', 'src/commands/cli.ts', 'src/repos/pr.ts', 'src/repos-extra.ts'],
      ['src/commands', 'src/repos', 'src/agctx.ts']
    ),
    ['src/repos-extra.ts'],
    '폴더 핀은 그 폴더 안의 파일만 덮는다'
  );
  assert.deepEqual(
    unpinnedSources(['src/check.ts'], ['src']),
    ['src/check.ts'],
    'src 전체를 핀하면 아무것도 덮지 않는다'
  );

  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');
  assert.match(checker, /wholeRootPins/);
  assert.match(checker, /unpinnedSources/);
});

test('문서가 이름으로 인용한 소스는 덮인 것으로 세므로 핀을 그것이 필요한 절로 옮길 수 있다', async () => {
  const { unpinnedSources } = await import('../tools/doc-sources.ts');

  assert.deepEqual(
    unpinnedSources(['src/check.ts', 'src/explain.ts'], ['src/explain.ts'], ['src/check.ts']),
    [],
    '인용한 파일에는 핀이 필요 없다'
  );
  assert.deepEqual(unpinnedSources(['src/check.ts'], [], []), ['src/check.ts'], '핀도 인용도 안 된 파일은 보고한다');
});

test('소스로 핀한 문서는 자기 기록 해시를 빼고 해시하므로 두 README가 서로를 핀할 수 있다', async () => {
  const { withoutRecordedHash } = await import('../tools/doc-sources.ts');
  const doc = (hash: string, body: string) =>
    `# Title\n\n<!-- agctx-doc-sources: README.en.md -->\n<!-- agctx-doc-sources-sha256: ${hash} -->\n\n${body}\n`;
  assert.equal(
    withoutRecordedHash(doc('a'.repeat(64), 'body')),
    withoutRecordedHash(doc('b'.repeat(64), 'body')),
    '핀한 문서를 다시 stamp해도 그것을 핀한 쪽은 바뀌지 않는다'
  );
  assert.notEqual(
    withoutRecordedHash(doc('a'.repeat(64), 'body')),
    withoutRecordedHash(doc('a'.repeat(64), 'edited body')),
    '핀한 문서를 고치면 여전히 게이트가 걸린다'
  );

  for (const [readme, translation] of [
    ['README.md', 'README.en.md'],
    ['README.en.md', 'README.md']
  ]) {
    const content = fs.readFileSync(path.join(repoRoot, readme), 'utf8');
    const pins =
      content
        .match(/<!--\s*agctx-doc-sources:\s*([^\n]+?)\s*-->/)?.[1]
        .split(',')
        .map(value => value.trim()) ?? [];
    assert.ok(
      pins.includes(translation),
      `${readme}는 ${translation}을 핀하므로 한 언어를 바꾸면 다른 언어도 확인하게 한다`
    );
  }
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');
  assert.match(checker, /withoutRecordedHash/);
});
