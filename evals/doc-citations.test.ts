import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyCitationMarkers,
  citationExempt,
  citationMarkerProblems,
  lineNumberCitations,
  namedCitations,
  repoFile
} from '../tools/doc-citations.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('문서는 줄 번호로 코드를 인용하면 안 된다', () => {
  assert.deepEqual(lineNumberCitations('`src/check.ts`의 `checkProject`가 판정한다.'), []);
  assert.deepEqual(lineNumberCitations('판정은 `src/check.ts:62-127`에 있다.'), ['src/check.ts:62-127']);
  assert.deepEqual(lineNumberCitations('`package.json:3`과 `.github/workflows/ci.yml:10-12`'), [
    'package.json:3',
    '.github/workflows/ci.yml:10-12'
  ]);
  assert.deepEqual(
    lineNumberCitations('시각은 `12:30`이고 키는 `agctx:managed`다.'),
    [],
    '확장자가 있는 경로만 인용으로 센다'
  );
});

test('인용은 파일과 그 안의 이름을 가리킨다', () => {
  assert.deepEqual(namedCitations('`src/check.ts`의 `checkProject`가 판정한다.'), [
    { file: 'src/check.ts', name: 'checkProject', digest: null }
  ]);
  assert.deepEqual(namedCitations('`src/check.ts`의 `checkProject`<!--s:0123456789ab-->가 판정한다.'), [
    { file: 'src/check.ts', name: 'checkProject', digest: '0123456789ab' }
  ]);
  assert.deepEqual(namedCitations('`tools/generate-skills.ts`의 `SKILLS`·`renderSkill`'), [
    { file: 'tools/generate-skills.ts', name: 'SKILLS', digest: null },
    { file: 'tools/generate-skills.ts', name: 'renderSkill', digest: null }
  ]);
  assert.deepEqual(namedCitations('`docs/README.md`의 `문서별 책임` 절'), [], '산문 속 이름은 검사하지 않는다');
});

test('이 저장소가 소유한 파일만 검사하므로 외부 경로와 생성 경로는 통과한다', () => {
  assert.equal(repoFile('src/check.ts'), true);
  assert.equal(repoFile('tools/build.ts'), true);
  assert.equal(repoFile('package.json'), true);
  assert.equal(repoFile('apm.yml'), false, '이 파일은 다른 도구의 것이다');
  assert.equal(repoFile('agctx.project.json'), false, 'agctx가 사용자 프로젝트에 만드는 파일이다');
  assert.equal(repoFile('compilation/claude_formatter.py'), false, '외부 저장소 안의 경로');
});

test('이력 문서는 옛 인용을 그대로 두고, 현재 동작 문서는 그러지 않는다', () => {
  assert.equal(citationExempt('docs/discussion/repository/topics/code-citation-style.md'), true);
  assert.equal(citationExempt('docs/adr/0016-command-contract.md'), true);
  assert.equal(citationExempt('CHANGELOG.md'), true);
  assert.equal(citationExempt('docs/contributing/implementation-principles.md'), false);
  assert.equal(citationExempt('README.md'), false);
});

test('다시 쓴 두 문서는 있는 이름을 가리키고 줄 번호가 없다', () => {
  for (const doc of [
    'docs/contributing/implementation-mechanics.md',
    'docs/contributing/implementation-principles.md'
  ]) {
    const content = fs.readFileSync(path.join(repoRoot, doc), 'utf8');
    assert.deepEqual(lineNumberCitations(content), [], `${doc}은 줄이 아니라 이름으로 코드를 인용한다`);
    for (const { file, name } of namedCitations(content)) {
      const target = path.join(repoRoot, file);
      assert.ok(fs.existsSync(target), `${doc}: ${file}이 있다`);
      assert.match(
        fs.readFileSync(target, 'utf8'),
        new RegExp(`\\b${name}\\b`),
        `${doc}: ${file}에 아직 ${name}이 있다`
      );
    }
  }

  assert.match(fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8'), /namedCitations/);
});

test('인용은 가리키는 것의 지문을 담는다', () => {
  const digests = new Map([['src/check.ts|checkProject', 'aaaaaaaaaaaa']]);
  const digestFor = (file: string, name: string) => digests.get(`${file}|${name}`) ?? null;

  const plain = '판정은 `src/check.ts`의 `checkProject`가 한다.';
  const stamped = applyCitationMarkers(plain, digestFor);
  assert.equal(stamped, '판정은 `src/check.ts`의 `checkProject`<!--s:aaaaaaaaaaaa-->가 한다.');
  assert.deepEqual(citationMarkerProblems(plain, digestFor), ['src/check.ts의 checkProject: 지문이 없다']);
  assert.deepEqual(citationMarkerProblems(stamped, digestFor), []);

  digests.set('src/check.ts|checkProject', 'bbbbbbbbbbbb');
  assert.deepEqual(citationMarkerProblems(stamped, digestFor), ['src/check.ts의 checkProject: 가리킨 코드가 바뀌었다']);
  assert.equal(
    applyCitationMarkers(stamped, digestFor),
    '판정은 `src/check.ts`의 `checkProject`<!--s:bbbbbbbbbbbb-->가 한다.'
  );
});

test('코드 블록 안의 예시는 건드리지 않는다', () => {
  const digestFor = () => 'cccccccccccc';
  const text = '규칙은 이렇다.\n\n```markdown\n판정은 `src/check.ts`의 `checkProject`가 한다.\n```\n';
  assert.equal(applyCitationMarkers(text, digestFor), text);
  assert.deepEqual(citationMarkerProblems(text.replace(/```[\s\S]*?```/g, ''), digestFor), []);
});

test('지문을 만들 대상이 없는 인용에는 마커를 두지 않는다', () => {
  const none = () => null;
  const text = '형식은 `CHANGELOG.md`의 `Unreleased` 절을 따른다.';
  assert.equal(applyCitationMarkers(text, none), text);
  assert.deepEqual(citationMarkerProblems(text, none), []);
});
