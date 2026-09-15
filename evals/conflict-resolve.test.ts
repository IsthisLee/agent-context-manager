import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'src', 'agctx.ts');
const END = '<!-- agctx:managed:end -->';
const EXTENSION = '## 4. 프로젝트 규칙 확장 (SSOT)';
const ADDED = '## Commands\n- Test: `pnpm test`\n';
const PATH_KEY = Object.keys(process.env).find(key => key.toUpperCase() === 'PATH') || 'PATH';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function snapshot(dir: string) {
  const files: Record<string, string> = {};
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) walk(entryPath);
      else files[path.relative(dir, entryPath)] = fs.readFileSync(entryPath, 'utf8');
    }
  };
  walk(dir);
  return files;
}

function makeFixture(t: TestContext) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-conflict-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const run = (args: string[], env: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [cli, ...args], {
    cwd: repoRoot,
    env: { ...process.env, AGCTX_HOME: home, ...env },
    encoding: 'utf8'
  });
  const ok = (args: string[], env: NodeJS.ProcessEnv = {}) => {
    const result = run(args, env);
    assert.equal(result.status, 0, `${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
    return result;
  };
  ok(['profile', 'create', 'team', '--scope', 'team']);
  ok(['profile', 'apply', 'team', project]);
  const file = (rel: string) => path.join(project, rel);
  const read = (rel: string) => fs.readFileSync(file(rel), 'utf8');
  const write = (rel: string, content: string) => fs.writeFileSync(file(rel), content);
  return { project, run, ok, file, read, write };
}


type Fixture = ReturnType<typeof makeFixture>;

function editPointerBlock(fixture: Fixture) {
  fixture.write('CLAUDE.md', fixture.read('CLAUDE.md').replace(END, `${ADDED}${END}`));
}

function editProfileRegion(fixture: Fixture) {
  fixture.write('AGENTS.md', fixture.read('AGENTS.md').replace(/^(# .*\n)/, `$1\n${ADDED}`));
}

function assertCleanSync(fixture: Fixture) {
  const check = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);
  assert.equal(check.status, 0, `${check.stdout}\n${check.stderr}`);
  assert.doesNotMatch(check.stdout, /conflict/);
}

function fakeCode(t: TestContext, mode: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-fake-code-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'fake-code.mjs'), `import fs from 'node:fs';
const args = process.argv.slice(2);
const at = args.indexOf('--merge');
const [current, incoming, , result] = args.slice(at + 1, at + 5);
const START = '<!-- agctx:managed:start -->';
const END = '<!-- agctx:managed:end -->';
const mine = fs.readFileSync(current, 'utf8');
const mode = ${JSON.stringify(mode)};
if (mode === 'current') fs.writeFileSync(result, mine);
else if (mode === 'formatted') fs.writeFileSync(result, mine.replace('## Commands\\n- Test: \`pnpm test\`\\n', '').replace(START + '\\n', START + '\\n\\n').replaceAll('\\n* ', '\\n- ').replace(END, END + '\\n\\n* Test: \`pnpm test\`'));
else if (mode === 'nomarkers') fs.writeFileSync(result, mine.replace(START, '').replace(END, ''));
else if (mode === 'untouched') {}
else fs.writeFileSync(result, fs.readFileSync(incoming, 'utf8') + '\\n## Kept by merge\\n');
`);
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(dir, 'code.cmd'), `@"${process.execPath}" "%~dp0fake-code.mjs" %*\r\n`);
  } else {
    fs.writeFileSync(path.join(dir, 'code'), `#!/bin/sh\nexec "${process.execPath}" "$(dirname "$0")/fake-code.mjs" "$@"\n`);
    fs.chmodSync(path.join(dir, 'code'), 0o755);
  }
  return { [PATH_KEY]: `${dir}${path.delimiter}${process.env[PATH_KEY]}` };
}

test('a conflicting sync names every changed managed file and how to see and resolve it', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);
  editProfileRegion(fixture);
  const before = snapshot(fixture.project);

  const result = fixture.run(['profile', 'sync', fixture.project]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Managed file changed outside agctx: AGENTS\.md, CLAUDE\.md/);
  assert.match(result.stderr, /profile sync --dry-run/);
  assert.match(result.stderr, /profile resolve/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('dry-run lists a conflict with its diff, writes nothing, and exits 1', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);
  const before = snapshot(fixture.project);

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /conflict\s+CLAUDE\.md/);
  assert.match(result.stdout, /unchanged\s+AGENTS\.md/);
  assert.match(result.stdout, /^\+## Commands$/m);
  assert.match(result.stderr, /profile resolve/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('dry-run reports a deleted managed file as a missing conflict', t => {
  const fixture = makeFixture(t);
  fs.rmSync(fixture.file('CLAUDE.md'));

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /conflict\s+CLAUDE\.md/);
  assert.match(result.stdout, /missing/i);
});

test('apply stores a base copy of every managed area that matches its recorded hash', t => {
  const fixture = makeFixture(t);
  const { managedHashes } = JSON.parse(fixture.read('agctx.project.json'));

  assert.deepEqual(Object.keys(managedHashes).sort(), ['.agents/rules/agctx.md', 'AGENTS.md', 'CLAUDE.md']);
  for (const [rel, hash] of Object.entries(managedHashes)) {
    const stored = fixture.read(`.agctx/base/${rel}.base`);
    assert.equal(sha256(stored.replace(/\n$/, '')), hash, rel);
  }
  assert.match(fixture.read('.agctx/.gitignore'), /^backups\/$/m);
});

test('sync creates base files for a project applied before they existed', t => {
  const fixture = makeFixture(t);
  fs.rmSync(fixture.file('.agctx'), { recursive: true, force: true });

  fixture.ok(['profile', 'sync', fixture.project]);

  assert.ok(fs.existsSync(fixture.file('.agctx/base/CLAUDE.md.base')));
  assertCleanSync(fixture);
});

test('resolve moves edits made inside a pointer block below the block and regenerates it', t => {
  const fixture = makeFixture(t);
  const original = fixture.read('CLAUDE.md');
  editPointerBlock(fixture);

  const result = fixture.ok(['profile', 'resolve', fixture.project]);

  assert.match(result.stdout, /CLAUDE\.md: moved 2 line\(s\) outside the managed area/);
  const resolved = fixture.read('CLAUDE.md');
  assert.ok(resolved.startsWith(original.slice(0, original.indexOf(END) + END.length)));
  assert.ok(resolved.indexOf('- Test: `pnpm test`') > resolved.indexOf(END));
  assertCleanSync(fixture);
});

test('resolve moves edits made in the AGENTS.md profile region into the extension section', t => {
  const fixture = makeFixture(t);
  editProfileRegion(fixture);

  fixture.ok(['profile', 'resolve', fixture.project]);

  const agents = fixture.read('AGENTS.md');
  assert.ok(agents.indexOf('- Test: `pnpm test`') > agents.indexOf(EXTENSION));
  assertCleanSync(fixture);
});

test('resolve keeps edits through a profile change when the base is available', t => {
  const fixture = makeFixture(t);
  editProfileRegion(fixture);
  fixture.ok(['profile', 'setup', 'team', '--tdd', 'strict']);

  fixture.ok(['profile', 'resolve', fixture.project]);

  const agents = fixture.read('AGENTS.md');
  assert.match(agents, /적용 수준: strict/);
  assert.ok(agents.indexOf('- Test: `pnpm test`') > agents.indexOf(EXTENSION));
  assertCleanSync(fixture);
});

test('resolve stops without writing when the base is unknown and the profile also changed', t => {
  const fixture = makeFixture(t);
  editProfileRegion(fixture);
  fs.rmSync(fixture.file('.agctx/base'), { recursive: true, force: true });
  fixture.ok(['profile', 'setup', 'team', '--tdd', 'strict']);
  const before = snapshot(fixture.project);

  const result = fixture.run(['profile', 'resolve', fixture.project]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--discard/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('resolve --discard backs up the conflicting file before regenerating it', t => {
  const fixture = makeFixture(t);
  editProfileRegion(fixture);
  fs.rmSync(fixture.file('.agctx/base'), { recursive: true, force: true });
  fixture.ok(['profile', 'setup', 'team', '--tdd', 'strict']);
  const edited = fixture.read('AGENTS.md');

  const result = fixture.ok(['profile', 'resolve', '--discard', fixture.project]);

  assert.match(result.stdout, /backed up/);
  const backupRoot = fixture.file('.agctx/backups');
  const [stamp] = fs.readdirSync(backupRoot);
  assert.equal(fs.readFileSync(path.join(backupRoot, stamp, 'AGENTS.md'), 'utf8'), edited);
  assert.doesNotMatch(fixture.read('AGENTS.md'), /Test: `pnpm test`/);
  assert.match(fixture.read('AGENTS.md'), /적용 수준: strict/);
  assertCleanSync(fixture);
});

test('resolve restores template lines that were deleted inside the managed area', t => {
  const fixture = makeFixture(t);
  const original = fixture.read('CLAUDE.md');
  fixture.write('CLAUDE.md', original.replace('* Manage project-specific domain rules there.\n', ''));

  const result = fixture.ok(['profile', 'resolve', fixture.project]);

  assert.match(result.stdout, /CLAUDE\.md: .*restored 1 line\(s\)/);
  assert.equal(fixture.read('CLAUDE.md'), original);
});

test('resolve recreates a deleted managed file', t => {
  const fixture = makeFixture(t);
  const original = fixture.read('CLAUDE.md');
  fs.rmSync(fixture.file('CLAUDE.md'));

  fixture.ok(['profile', 'resolve', fixture.project]);

  assert.equal(fixture.read('CLAUDE.md'), original);
  assertCleanSync(fixture);
});

test('resolve without conflicts changes nothing', t => {
  const fixture = makeFixture(t);
  const before = snapshot(fixture.project);

  const result = fixture.ok(['profile', 'resolve', fixture.project]);

  assert.match(result.stdout, /Nothing to resolve/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('resolve --dry-run describes the moves without writing', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);
  const before = snapshot(fixture.project);

  const result = fixture.ok(['profile', 'resolve', '--dry-run', fixture.project]);

  assert.match(result.stdout, /CLAUDE\.md: would move 2 line\(s\) outside the managed area/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('resolve --edit applies a VS Code merge result whose managed area matches the regenerated one', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);

  fixture.ok(['profile', 'resolve', '--edit', fixture.project], fakeCode(t, 'incoming'));

  assert.match(fixture.read('CLAUDE.md'), /## Kept by merge/);
  assertCleanSync(fixture);
});

test('resolve --edit starts the merge result from the automatic resolution', t => {
  const automatic = makeFixture(t);
  editPointerBlock(automatic);
  automatic.ok(['profile', 'resolve', automatic.project]);
  const fixture = makeFixture(t);
  editPointerBlock(fixture);

  const result = fixture.ok(['profile', 'resolve', '--edit', fixture.project], { ...fakeCode(t, 'untouched'), AGCTX_LANG: 'ko' });

  assert.match(result.stdout, /CLAUDE\.md: VS Code 병합 편집기를 엽니다/);
  assert.match(result.stdout, /`current-CLAUDE\.md` 창/);
  assert.match(result.stdout, /`<!-- agctx:managed:end -->` 아래로 이미 옮겨져/);
  assert.match(result.stdout, /'충돌과 함께 닫기'\(Close with Conflicts\)/);
  assert.match(result.stdout, /applied the VS Code merge result/);
  assert.equal(fixture.read('CLAUDE.md'), automatic.read('CLAUDE.md'));
  assert.ok(fixture.read('CLAUDE.md').indexOf(ADDED) > fixture.read('CLAUDE.md').indexOf(END));
  assertCleanSync(fixture);
});

test('resolve --edit keeps content moved outside the managed area even when a formatter rewrote the block', t => {
  const fixture = makeFixture(t);
  const original = fixture.read('CLAUDE.md');
  editPointerBlock(fixture);

  const result = fixture.ok(['profile', 'resolve', '--edit', fixture.project], fakeCode(t, 'formatted'));

  assert.match(result.stdout, /changes inside it were not applied/);
  const resolved = fixture.read('CLAUDE.md');
  assert.ok(resolved.startsWith(original.slice(0, original.indexOf(END) + END.length)));
  assert.ok(resolved.indexOf('* Test: `pnpm test`') > resolved.indexOf(END));
  assertCleanSync(fixture);
});

test('resolve --edit regenerates the managed area and reports edits left inside it', t => {
  const fixture = makeFixture(t);
  const original = fixture.read('CLAUDE.md');
  editPointerBlock(fixture);

  const result = fixture.ok(['profile', 'resolve', '--edit', fixture.project], { ...fakeCode(t, 'current'), AGCTX_LANG: 'en' });

  assert.match(result.stdout, /CLAUDE\.md: opening the VS Code merge editor/);
  assert.match(result.stdout, /'Close with Conflicts'/);
  assert.match(result.stdout, /changes inside it were not applied/);
  assert.match(result.stdout, /^-- Test: `pnpm test`$/m);
  const kept = result.stdout.match(/Merge result kept at (.+)$/m);
  assert.ok(kept && fs.existsSync(kept[1].trim()), 'the merge result file is kept for recovery');
  t.after(() => fs.rmSync(path.dirname(kept[1].trim()), { recursive: true, force: true }));
  assert.equal(fixture.read('CLAUDE.md'), original);
  assertCleanSync(fixture);
});

test('resolve --edit refuses a merge result without the managed markers', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);
  const before = snapshot(fixture.project);

  const result = fixture.run(['profile', 'resolve', '--edit', fixture.project], fakeCode(t, 'nomarkers'));

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no agctx managed area/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('resolve --edit explains when the VS Code CLI is not available', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-no-code-'));
  t.after(() => fs.rmSync(emptyDir, { recursive: true, force: true }));

  const result = fixture.run(['profile', 'resolve', '--edit', fixture.project], { [PATH_KEY]: emptyDir });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /VS Code/);
});

test('resolve requires a project that was already applied', t => {
  const fixture = makeFixture(t);
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-unapplied-'));
  t.after(() => fs.rmSync(other, { recursive: true, force: true }));

  const result = fixture.run(['profile', 'resolve', other]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /profile apply/);
});
