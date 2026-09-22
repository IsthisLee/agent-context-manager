import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { citedText, jsonValue, symbolDigest, symbolText, yamlBlock } from '../tools/symbol-source.ts';
import { namedCitations } from '../tools/doc-citations.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const source = [
  "import fs from 'node:fs';",
  '',
  '/** Keeps the profile list sorted. */',
  'export function listProfiles(dir: string): string[] {',
  '  return fs.readdirSync(dir).sort();',
  '}',
  '',
  'export const LIMITS = {',
  '  files: 10',
  '};',
  '',
  'export interface Profile {',
  '  name: string;',
  '}',
  ''
].join('\n');

test('심볼은 첫 줄부터 다음 최상위 선언 전까지의 선언이다', () => {
  assert.equal(
    symbolText(source, 'listProfiles'),
    'export function listProfiles(dir: string): string[] {\n  return fs.readdirSync(dir).sort();\n}'
  );
  assert.equal(symbolText(source, 'LIMITS'), 'export const LIMITS = {\n  files: 10\n};');
  assert.equal(symbolText(source, 'Profile'), 'export interface Profile {\n  name: string;\n}');
  assert.equal(symbolText(source, 'missingName'), null);
  assert.equal(symbolText(source, 'fs'), null, 'import는 이 저장소가 인용하는 선언이 아니다');
});

test('지문은 본문이 바뀌면 바뀌고 주변 코드가 바뀌면 바뀌지 않는다', () => {
  const other = source.replace("import fs from 'node:fs';", "import fs from 'node:fs';\n// a new comment above");
  assert.equal(symbolDigest(symbolText(other, 'listProfiles')!), symbolDigest(symbolText(source, 'listProfiles')!));

  const changed = source.replace('.sort()', '.sort().reverse()');
  assert.notEqual(
    symbolDigest(symbolText(changed, 'listProfiles')!),
    symbolDigest(symbolText(source, 'listProfiles')!)
  );
  assert.match(symbolDigest(symbolText(source, 'listProfiles')!), /^[0-9a-f]{12}$/);
});

test('JSON 키는 값으로, YAML 키는 블록으로 잘라 낸다', () => {
  assert.equal(jsonValue('{"scripts":{"test":"node --test"},"files":["dist"]}', 'files'), '["dist"]');
  assert.equal(jsonValue('{"scripts":{"test":"node --test"}}', 'test'), '"node --test"', '중첩 객체 안의 키도 찾는다');
  assert.equal(jsonValue('{"a":1}', 'missing'), null);
  assert.equal(
    yamlBlock('on:\n  push:\n    branches: [main]\njobs:\n  build:\n', 'on'),
    'on:\n  push:\n    branches: [main]'
  );
  assert.equal(yamlBlock('jobs:\n  build:\n', 'missing'), null);
  assert.equal(citedText('package.json', '{"files":["dist"]}', 'files'), '["dist"]');
  assert.equal(citedText('src/a.ts', 'export const A = 1;\n', 'A'), 'export const A = 1;');
  assert.equal(
    citedText('CHANGELOG.md', '## [Unreleased]\n- 내용\n', 'Unreleased'),
    null,
    '다른 문서를 가리키는 인용에는 지문이 없다'
  );
});

test('문서가 인용하는 모든 이름은 그 파일에서 잘라 낼 수 있다', () => {
  const failures: string[] = [];
  for (const doc of fs.readdirSync(path.join(repoRoot, 'docs/contributing')).map(name => `docs/contributing/${name}`)) {
    if (!doc.endsWith('.md')) continue;
    const content = fs.readFileSync(path.join(repoRoot, doc), 'utf8');
    for (const { file, name } of namedCitations(content)) {
      if (file.endsWith('.md')) continue;
      const text = citedText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8'), name);
      if (!text) failures.push(`${doc}: ${file}의 ${name}`);
    }
  }
  assert.deepEqual(failures, [], '잘라 낼 수 없는 인용 이름은 다른 방식으로 가리켜야 한다');
});

test('선언이 아닌 이름은 잘라 낼 수 없으므로 게이트가 거부할 수 있다', () => {
  const body = ['export function run(): void {', '  const helper = 1;', '  return;', '}'].join('\n');
  assert.equal(symbolText(body, 'helper'), null, '함수 안의 지역 이름은 이 저장소가 인용하는 선언이 아니다');
  assert.equal(citedText('src/a.ts', body, 'helper'), null);
  assert.ok(symbolText(body, 'run'));
});

test('지문은 checkout이 쓰는 줄 끝에 영향을 받지 않는다', () => {
  const lf = 'export const A = {\n  b: 1\n};';
  assert.equal(
    symbolDigest(citedText('src/a.ts', lf, 'A')!),
    symbolDigest(citedText('src/a.ts', lf.replaceAll('\n', '\r\n'), 'A')!)
  );
});
