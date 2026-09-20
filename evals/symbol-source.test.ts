import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { citedText, jsonValue, symbolDigest, symbolText, yamlBlock } from '../tools/symbol-source.ts';
import { namedCitations } from '../tools/doc-citations.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const source = [
  'import fs from \'node:fs\';',
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

test('a symbol is the declaration from its first line to the next top-level declaration', () => {
  assert.equal(symbolText(source, 'listProfiles'), 'export function listProfiles(dir: string): string[] {\n  return fs.readdirSync(dir).sort();\n}');
  assert.equal(symbolText(source, 'LIMITS'), 'export const LIMITS = {\n  files: 10\n};');
  assert.equal(symbolText(source, 'Profile'), 'export interface Profile {\n  name: string;\n}');
  assert.equal(symbolText(source, 'missingName'), null);
  assert.equal(symbolText(source, 'fs'), null, 'an import is not a declaration this repository cites');
});

test('the digest changes with the body and not with code around it', () => {
  const other = source.replace('import fs from \'node:fs\';', 'import fs from \'node:fs\';\n// a new comment above');
  assert.equal(symbolDigest(symbolText(other, 'listProfiles')!), symbolDigest(symbolText(source, 'listProfiles')!));

  const changed = source.replace('.sort()', '.sort().reverse()');
  assert.notEqual(symbolDigest(symbolText(changed, 'listProfiles')!), symbolDigest(symbolText(source, 'listProfiles')!));
  assert.match(symbolDigest(symbolText(source, 'listProfiles')!), /^[0-9a-f]{12}$/);
});

test('a JSON key is cut out as its value and a YAML key as its block', () => {
  assert.equal(jsonValue('{"scripts":{"test":"node --test"},"files":["dist"]}', 'files'), '["dist"]');
  assert.equal(jsonValue('{"scripts":{"test":"node --test"}}', 'test'), '"node --test"', 'a key inside a nested object is found too');
  assert.equal(jsonValue('{"a":1}', 'missing'), null);
  assert.equal(yamlBlock('on:\n  push:\n    branches: [main]\njobs:\n  build:\n', 'on'), 'on:\n  push:\n    branches: [main]');
  assert.equal(yamlBlock('jobs:\n  build:\n', 'missing'), null);
  assert.equal(citedText('package.json', '{"files":["dist"]}', 'files'), '["dist"]');
  assert.equal(citedText('src/a.ts', 'export const A = 1;\n', 'A'), 'export const A = 1;');
  assert.equal(citedText('CHANGELOG.md', '## [Unreleased]\n- 내용\n', 'Unreleased'), null, 'a citation that points at another document carries no fingerprint');
});

test('every name the documents cite can be cut out of its file', () => {
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
  assert.deepEqual(failures, [], 'a cited name that cannot be cut out needs a different pointer');
});

test('a name that is not a declaration cannot be cut, so the gate can reject it', () => {
  const body = ['export function run(): void {', '  const helper = 1;', '  return;', '}'].join('\n');
  assert.equal(symbolText(body, 'helper'), null, 'a local inside a function is not a declaration this repository cites');
  assert.equal(citedText('src/a.ts', body, 'helper'), null);
  assert.ok(symbolText(body, 'run'));
});

test('the digest ignores the line endings a checkout happens to use', () => {
  const lf = 'export const A = {\n  b: 1\n};';
  assert.equal(symbolDigest(citedText('src/a.ts', lf, 'A')!), symbolDigest(citedText('src/a.ts', lf.replaceAll('\n', '\r\n'), 'A')!));
});
