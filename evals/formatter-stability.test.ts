import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  extractAgentsManagedDocument,
  formatterNormalized,
  formatterUnstableLines,
  hashAgentsManagedDocument
} from '../src/project/analyzer.ts';
import { renderProfileAgents } from '../src/profile/apply.ts';
import { SUPPORTED_LOCALES, setLocale, t } from '../src/i18n/index.ts';

/**
 * Editors that format Markdown on save rewrite the whole file. If anything
 * agctx writes into a managed area is not already in the shape formatters
 * produce, saving the file changes the managed bytes and `agctx check`
 * reports a conflict the person never caused.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8');
const reasons = (text: string) => formatterUnstableLines(text).map(found => `line ${found.line}: ${found.reason}`);

test('formatterUnstableLines names what a Markdown formatter would rewrite', () => {
  assert.deepEqual(formatterUnstableLines('- kept\n'), []);
  assert.deepEqual(formatterUnstableLines('* changed\n'), [{ line: 1, reason: 'bullet marker is not -' }]);
  assert.deepEqual(formatterUnstableLines('+ changed\n'), [{ line: 1, reason: 'bullet marker is not -' }]);
  assert.deepEqual(formatterUnstableLines('본문 \n'), [{ line: 1, reason: 'trailing whitespace' }]);
  assert.deepEqual(formatterUnstableLines('## 제목\n본문\n'), [{ line: 1, reason: 'no blank line after heading' }]);
  assert.deepEqual(formatterUnstableLines('본문\n\n\n다음\n'), [{ line: 3, reason: 'consecutive blank lines' }]);

  assert.deepEqual(formatterUnstableLines('*강조*는 목록이 아니다\n'), [], 'emphasis is not a bullet');
  assert.deepEqual(formatterUnstableLines('```sh\n* echo\n```\n'), [], 'a formatter leaves fenced code alone');
  assert.deepEqual(formatterUnstableLines('## 제목\n\n본문\n'), []);
});

test('every template agctx writes survives a formatter unchanged', () => {
  const templates = [
    'templates/CLAUDE.md',
    'templates/CLAUDE.link.md',
    'templates/antigravity-rules/agctx.md',
    'templates/profile/AGENTS.md',
    'templates/profile/AGENTS.ko.md'
  ];
  for (const template of templates) {
    assert.deepEqual(
      reasons(read(template)),
      [],
      `${template} would be rewritten on save, which turns into a conflict`
    );
  }
});

test('the project context agctx appends to AGENTS.md survives a formatter unchanged', () => {
  for (const locale of SUPPORTED_LOCALES) {
    setLocale(locale);
    const rendered = renderProfileAgents('# 프로필 지침\n\n- 규칙 하나.\n', 'isthis', 'my-app');
    assert.deepEqual(reasons(rendered), [], `the ${locale} rendering would be rewritten on save`);
    assert.deepEqual(
      reasons(t(locale, 'scaffold.extBody')),
      [],
      `the ${locale} extension body would be rewritten on save`
    );
  }
});

/** A project with the profile already applied, in a throwaway agctx home. */
function applied(t: TestContext) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-formatter-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const run = (args: string[]) =>
    spawnSync(process.execPath, [path.join(repoRoot, 'src', 'agctx.ts'), ...args], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home },
      encoding: 'utf8'
    });
  const ok = (args: string[]) => {
    const result = run(args);
    assert.equal(result.status, 0, `${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
    return result;
  };
  ok(['profile', 'create', 'team', '--scope', 'team']);
  ok(['profile', 'apply', 'team', project, '--yes']);
  const read = (rel: string) => fs.readFileSync(path.join(project, rel), 'utf8');
  const write = (rel: string, content: string) => fs.writeFileSync(path.join(project, rel), content);
  return { project, run, read, write };
}

test('a managed area that already holds what agctx would write is not a conflict', t => {
  // An older agctx wrote `* **Project:**`, the editor's formatter turned it into
  // `- **Project:**` on save, and this version writes `-` too. The file already
  // holds what sync would write, so stopping costs the person a conflict they
  // cannot resolve into anything better.
  const fixture = applied(t);
  const region = extractAgentsManagedDocument(fixture.read('AGENTS.md')) ?? '';
  assert.ok(region.includes('- **Project:**'), 'the applied managed area carries the project line');

  const config = JSON.parse(fixture.read('agctx.project.json'));
  config.managedHashes['AGENTS.md'] = createHash('sha256')
    .update(region.replace('- **Project:**', '* **Project:**'))
    .digest('hex');
  fixture.write('agctx.project.json', `${JSON.stringify(config, null, 2)}\n`);

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);
  assert.equal(
    result.status,
    0,
    `sync stopped on a managed area it was about to write anyway\n${result.stdout}\n${result.stderr}`
  );
  assert.doesNotMatch(result.stdout, /conflict/);
});

test('a managed area holding something else is still a conflict', t => {
  const fixture = applied(t);
  fixture.write('AGENTS.md', fixture.read('AGENTS.md').replace(/^(# .*\n)/, '$1\n## 내가 끼워 넣은 절\n'));

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);
  assert.equal(result.status, 2, 'an edit agctx would overwrite still stops before writing anything');
});

test('a formatter changing one bullet marker in the managed area changes its hash', () => {
  const document =
    '# 지침\n\n## Project context\n\n- **Project:** my-app\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n- 내 규칙.\n';
  const formatted = document.replace('- **Project:**', '* **Project:**');

  assert.notEqual(
    hashAgentsManagedDocument(document),
    hashAgentsManagedDocument(formatted),
    'one byte inside the managed area is enough to report a conflict'
  );
  assert.deepEqual(
    reasons(formatted),
    [{ line: 5, reason: 'bullet marker is not -' }].map(found => `line ${found.line}: ${found.reason}`),
    'so the check names the line before it ever reaches a project'
  );
});

test('an area only a formatter touched is not a conflict, even when agctx would write something else', t => {
  // The base file says what agctx last wrote. If the difference from it is only
  // what a formatter does, nobody edited the area, so a sync that also changes
  // the area for other reasons still has nothing to lose.
  const fixture = applied(t);
  const before = fixture.read('AGENTS.md');
  fixture.write(
    'AGENTS.md',
    before.replace('- **Project:**', '* **Project:**').replace(/\n## Project context\n/, '\n## Project context  \n')
  );

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);
  assert.equal(result.status, 0, `a reformatted managed area stopped the sync\n${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(result.stdout, /conflict/);
});

test('a word changed inside the managed area is still a conflict', t => {
  const fixture = applied(t);
  fixture.write('AGENTS.md', fixture.read('AGENTS.md').replace('- **Project:** ', '- **Project:** my-'));

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);
  assert.equal(result.status, 2, 'normalising formatting must not hide a real edit');
});

test('formatterNormalized flattens what a formatter changes and nothing else', () => {
  assert.equal(formatterNormalized('* 하나\n+ 둘\n'), '- 하나\n- 둘');
  assert.equal(formatterNormalized('본문   \n'), '본문');
  assert.equal(
    formatterNormalized('가\n\n\n\n나\n'),
    '가\n나',
    "blank lines between blocks are the formatter's business"
  );
  assert.equal(formatterNormalized('## 가\r\n\r\n나\r\n'), '## 가\n나');
  assert.notEqual(formatterNormalized('- 하나'), formatterNormalized('- 둘'), 'words are never touched');
  assert.notEqual(
    formatterNormalized('- 하나'),
    formatterNormalized('하나'),
    'a bullet is not the same as a paragraph'
  );
});

test('formatterNormalized joins a paragraph a formatter rewrapped, because Markdown reads it the same', () => {
  assert.equal(formatterNormalized('한 문단이\n두 줄로 접혔다\n'), formatterNormalized('한 문단이 두 줄로 접혔다\n'));
  assert.equal(formatterNormalized('- 목록 항목이\n  접혔다\n'), formatterNormalized('- 목록 항목이 접혔다\n'));

  assert.notEqual(
    formatterNormalized('가\n나\n'),
    formatterNormalized('가\n\n나\n'),
    'a blank line still separates two blocks'
  );
  assert.notEqual(
    formatterNormalized('- 가\n- 나\n'),
    formatterNormalized('- 가 - 나\n'),
    'two list items are not one'
  );
  assert.notEqual(
    formatterNormalized('## 제목\n본문\n'),
    formatterNormalized('## 제목 본문\n'),
    'a heading is its own block'
  );
  assert.notEqual(
    formatterNormalized('| 가 |\n| 나 |\n'),
    formatterNormalized('| 가 | | 나 |\n'),
    'table rows stay rows'
  );
  assert.notEqual(
    formatterNormalized('문단에 낱말을 더했다\n'),
    formatterNormalized('문단에 낱말을 크게 더했다\n'),
    'words are never touched'
  );
  assert.equal(
    formatterNormalized('```sh\necho 하나\necho 둘\n```\n'),
    '```sh\necho 하나\necho 둘\n```',
    'fenced code keeps its line breaks'
  );
});

test('a managed area a formatter rewrapped is not a conflict', t => {
  // Prettier with `proseWrap: always` refolds every paragraph. Nothing the
  // person wrote changed, so agctx must not treat it as an edit: `resolve`
  // would copy the whole area into the extension section as "added lines".
  const fixture = applied(t);
  const before = fixture.read('AGENTS.md');
  const rewrapped = before
    .split('\n')
    .map(line =>
      line.length > 40 && !line.startsWith('#') && !line.startsWith('<') ? line.replace(/(.{1,40}) /g, '$1\n') : line
    )
    .join('\n');
  assert.notEqual(rewrapped, before, 'the fixture actually rewrapped something');
  fixture.write('AGENTS.md', rewrapped);

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);
  assert.equal(result.status, 0, `a rewrapped managed area stopped the sync\n${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(result.stdout, /conflict/);
});
