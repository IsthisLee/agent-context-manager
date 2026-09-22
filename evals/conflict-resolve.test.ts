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
const EXTENSION = '## 4. Project rule extensions (SSOT)';
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
  const run = (args: string[], env: NodeJS.ProcessEnv = {}) =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home, ...env },
      encoding: 'utf8'
    });
  const ok = (args: string[], env: NodeJS.ProcessEnv = {}) => {
    const result = run(args, env);
    assert.equal(result.status, 0, `${args.join(' ')} 실패\n${result.stdout}\n${result.stderr}`);
    return result;
  };
  ok(['profile', 'create', 'team', '--scope', 'team']);
  ok(['profile', 'apply', 'team', project, '--yes']);
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
  fs.writeFileSync(
    path.join(dir, 'fake-code.mjs'),
    `import fs from 'node:fs';
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
`
  );
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(dir, 'code.cmd'), `@"${process.execPath}" "%~dp0fake-code.mjs" %*\r\n`);
  } else {
    fs.writeFileSync(
      path.join(dir, 'code'),
      `#!/bin/sh\nexec "${process.execPath}" "$(dirname "$0")/fake-code.mjs" "$@"\n`
    );
    fs.chmodSync(path.join(dir, 'code'), 0o755);
  }
  return { [PATH_KEY]: `${dir}${path.delimiter}${process.env[PATH_KEY]}` };
}

test('충돌하는 sync는 바뀐 관리 파일을 모두 알리고 확인·해결 방법을 안내한다', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);
  editProfileRegion(fixture);
  const before = snapshot(fixture.project);

  const result = fixture.run(['profile', 'sync', fixture.project]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /edits inside the profile-owned area: AGENTS\.md, CLAUDE\.md/);
  assert.match(result.stderr, /profile sync --dry-run/);
  assert.match(result.stderr, /profile resolve/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('dry-run은 충돌을 diff와 함께 나열하고 아무것도 쓰지 않고 2로 끝난다', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);
  const before = snapshot(fixture.project);

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);

  assert.equal(result.status, 2);
  assert.match(result.stdout, /conflict\s+CLAUDE\.md/);
  assert.match(result.stdout, /unchanged\s+AGENTS\.md/);
  assert.match(result.stdout, /^\+## Commands$/m);
  assert.match(result.stderr, /profile resolve/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('dry-run은 지운 관리 파일을 missing 충돌로 보고한다', t => {
  const fixture = makeFixture(t);
  fs.rmSync(fixture.file('CLAUDE.md'));

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);

  assert.equal(result.status, 2);
  assert.match(result.stdout, /conflict\s+CLAUDE\.md/);
  assert.match(result.stdout, /missing/i);
});

test('apply는 기록된 해시와 맞는 모든 관리 영역의 base 사본을 저장한다', t => {
  const fixture = makeFixture(t);
  const { managedHashes } = JSON.parse(fixture.read('agctx.project.json'));

  assert.deepEqual(Object.keys(managedHashes).sort(), ['.agents/rules/agctx.md', 'AGENTS.md', 'CLAUDE.md']);
  for (const [rel, hash] of Object.entries(managedHashes)) {
    const stored = fixture.read(`.agctx/base/${rel}.base`);
    assert.equal(sha256(stored.replace(/\n$/, '')), hash, rel);
  }
  assert.match(fixture.read('.agctx/.gitignore'), /^backups\/$/m);
});

test('sync는 base 파일이 생기기 전에 적용한 프로젝트에 base 파일을 만든다', t => {
  const fixture = makeFixture(t);
  fs.rmSync(fixture.file('.agctx'), { recursive: true, force: true });

  fixture.ok(['profile', 'sync', fixture.project, '--yes']);

  assert.ok(fs.existsSync(fixture.file('.agctx/base/CLAUDE.md.base')));
  assertCleanSync(fixture);
});

test('resolve는 포인터 블록 안의 수정을 블록 아래로 옮기고 블록을 다시 만든다', t => {
  const fixture = makeFixture(t);
  const original = fixture.read('CLAUDE.md');
  editPointerBlock(fixture);

  const result = fixture.ok(['profile', 'resolve', fixture.project, '--yes']);

  assert.match(result.stdout, /CLAUDE\.md: move 2 line\(s\) outside the managed area/);
  const resolved = fixture.read('CLAUDE.md');
  assert.ok(resolved.startsWith(original.slice(0, original.indexOf(END) + END.length)));
  assert.ok(resolved.indexOf('- Test: `pnpm test`') > resolved.indexOf(END));
  assertCleanSync(fixture);
});

test('resolve는 AGENTS.md 프로필 영역의 수정을 확장 영역으로 옮긴다', t => {
  const fixture = makeFixture(t);
  editProfileRegion(fixture);

  fixture.ok(['profile', 'resolve', fixture.project, '--yes']);

  const agents = fixture.read('AGENTS.md');
  assert.ok(agents.indexOf('- Test: `pnpm test`') > agents.indexOf(EXTENSION));
  assertCleanSync(fixture);
});

test('base가 있으면 resolve는 프로필이 바뀌어도 수정을 지킨다', t => {
  const fixture = makeFixture(t);
  editProfileRegion(fixture);
  fixture.ok(['profile', 'setup', 'team', '--tdd', 'on']);

  fixture.ok(['profile', 'resolve', fixture.project, '--yes']);

  const agents = fixture.read('AGENTS.md');
  assert.match(agents, /## TDD/, '프로필 변경이 프로젝트에 닿았다');
  assert.ok(agents.indexOf('- Test: `pnpm test`') > agents.indexOf(EXTENSION));
  assertCleanSync(fixture);
});

test('base를 모르고 프로필도 바뀌었으면 resolve는 쓰지 않고 멈춘다', t => {
  const fixture = makeFixture(t);
  editProfileRegion(fixture);
  fs.rmSync(fixture.file('.agctx/base'), { recursive: true, force: true });
  fixture.ok(['profile', 'setup', 'team', '--tdd', 'on']);
  const before = snapshot(fixture.project);

  const result = fixture.run(['profile', 'resolve', fixture.project, '--yes']);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--discard/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('resolve --discard는 다시 만들기 전에 충돌한 파일을 백업한다', t => {
  const fixture = makeFixture(t);
  editProfileRegion(fixture);
  fs.rmSync(fixture.file('.agctx/base'), { recursive: true, force: true });
  fixture.ok(['profile', 'setup', 'team', '--tdd', 'on']);
  const edited = fixture.read('AGENTS.md');

  const result = fixture.ok(['profile', 'resolve', '--discard', fixture.project, '--yes']);

  assert.match(result.stdout, /back up to \.agctx\/backups\//);
  const backupRoot = fixture.file('.agctx/backups');
  const [stamp] = fs.readdirSync(backupRoot);
  assert.equal(fs.readFileSync(path.join(backupRoot, stamp, 'AGENTS.md'), 'utf8'), edited);
  assert.doesNotMatch(fixture.read('AGENTS.md'), /Test: `pnpm test`/);
  assert.match(fixture.read('AGENTS.md'), /## TDD/, '프로필 변경이 프로젝트에 닿았다');
  assertCleanSync(fixture);
});

test('resolve는 관리 영역 안에서 지운 템플릿 줄을 되살린다', t => {
  const fixture = makeFixture(t);
  const original = fixture.read('CLAUDE.md');
  const deleted = '- Manage project-specific domain rules there.\n';
  assert.ok(original.includes(deleted), '템플릿이 바뀌었다. 이 픽스처가 지울 수 있는 줄을 골라라');
  fixture.write('CLAUDE.md', original.replace(deleted, ''));

  const result = fixture.ok(['profile', 'resolve', fixture.project, '--yes']);

  assert.match(result.stdout, /CLAUDE\.md: .*restore 1 line\(s\)/);
  assert.equal(fixture.read('CLAUDE.md'), original);
});

test('resolve는 지운 관리 파일을 다시 만든다', t => {
  const fixture = makeFixture(t);
  const original = fixture.read('CLAUDE.md');
  fs.rmSync(fixture.file('CLAUDE.md'));

  fixture.ok(['profile', 'resolve', fixture.project, '--yes']);

  assert.equal(fixture.read('CLAUDE.md'), original);
  assertCleanSync(fixture);
});

test('충돌이 없으면 resolve는 아무것도 바꾸지 않는다', t => {
  const fixture = makeFixture(t);
  const before = snapshot(fixture.project);

  const result = fixture.ok(['profile', 'resolve', fixture.project, '--yes']);

  assert.match(result.stdout, /Nothing to resolve/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('resolve --dry-run은 쓰지 않고 옮길 내용을 설명한다', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);
  const before = snapshot(fixture.project);

  const result = fixture.ok(['profile', 'resolve', '--dry-run', fixture.project]);

  assert.match(result.stdout, /CLAUDE\.md: would move 2 line\(s\) outside the managed area/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('resolve --edit은 관리 영역이 다시 만든 것과 같은 VS Code 병합 결과를 적용한다', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);

  fixture.ok(['profile', 'resolve', '--edit', fixture.project, '--yes'], fakeCode(t, 'incoming'));

  assert.match(fixture.read('CLAUDE.md'), /## Kept by merge/);
  assertCleanSync(fixture);
});

test('resolve --edit은 병합 결과를 자동 해결에서 시작한다', t => {
  const automatic = makeFixture(t);
  editPointerBlock(automatic);
  automatic.ok(['profile', 'resolve', automatic.project, '--yes']);
  const fixture = makeFixture(t);
  editPointerBlock(fixture);

  const result = fixture.ok(['profile', 'resolve', '--edit', fixture.project, '--yes'], {
    ...fakeCode(t, 'untouched'),
    AGCTX_LANG: 'ko'
  });

  assert.match(result.stdout, /CLAUDE\.md: VS Code 병합 편집기를 엽니다/);
  assert.match(result.stdout, /`current-CLAUDE\.md` 창/);
  assert.match(result.stdout, /`<!-- agctx:managed:end -->` 아래로 이미 옮겨져/);
  assert.match(result.stdout, /'충돌과 함께 닫기'\(Close with Conflicts\)/);
  assert.match(result.stdout, /VS Code 병합 결과를 적용했습니다/);
  assert.equal(fixture.read('CLAUDE.md'), automatic.read('CLAUDE.md'));
  assert.ok(fixture.read('CLAUDE.md').indexOf(ADDED) > fixture.read('CLAUDE.md').indexOf(END));
  assertCleanSync(fixture);
});

test('resolve --edit은 포매터가 블록을 다시 써도 관리 영역 밖으로 옮긴 내용을 지킨다', t => {
  const fixture = makeFixture(t);
  const original = fixture.read('CLAUDE.md');
  editPointerBlock(fixture);

  const result = fixture.ok(['profile', 'resolve', '--edit', fixture.project, '--yes'], fakeCode(t, 'formatted'));

  assert.match(result.stdout, /changes inside it were not applied/);
  const resolved = fixture.read('CLAUDE.md');
  assert.ok(resolved.startsWith(original.slice(0, original.indexOf(END) + END.length)));
  assert.ok(resolved.indexOf('* Test: `pnpm test`') > resolved.indexOf(END));
  assertCleanSync(fixture);
});

test('resolve --edit은 관리 영역을 다시 만들고 그 안에 남은 수정을 보고한다', t => {
  const fixture = makeFixture(t);
  const original = fixture.read('CLAUDE.md');
  editPointerBlock(fixture);

  const result = fixture.ok(['profile', 'resolve', '--edit', fixture.project, '--yes'], {
    ...fakeCode(t, 'current'),
    AGCTX_LANG: 'en'
  });

  assert.match(result.stdout, /CLAUDE\.md: opening the VS Code merge editor/);
  assert.match(result.stdout, /'Close with Conflicts'/);
  assert.match(result.stdout, /changes inside it were not applied/);
  assert.match(result.stdout, /^-- Test: `pnpm test`$/m);
  const kept = result.stdout.match(/Merge result kept at (.+)$/m);
  assert.ok(kept && fs.existsSync(kept[1].trim()), '병합 결과 파일은 복구를 위해 남긴다');
  t.after(() => fs.rmSync(path.dirname(kept[1].trim()), { recursive: true, force: true }));
  assert.equal(fixture.read('CLAUDE.md'), original);
  assertCleanSync(fixture);
});

test('resolve --edit은 관리 마커가 없는 병합 결과를 거부한다', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);
  const before = snapshot(fixture.project);

  const result = fixture.run(['profile', 'resolve', '--edit', fixture.project, '--yes'], fakeCode(t, 'nomarkers'));

  assert.equal(result.status, 2);
  assert.match(result.stderr, /no agctx managed area/);
  assert.deepEqual(snapshot(fixture.project), before);
});

test('VS Code CLI가 없으면 resolve --edit이 그렇다고 설명한다', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-no-code-'));
  t.after(() => fs.rmSync(emptyDir, { recursive: true, force: true }));

  const result = fixture.run(['profile', 'resolve', '--edit', fixture.project, '--yes'], { [PATH_KEY]: emptyDir });

  assert.equal(result.status, 69);
  assert.match(result.stderr, /VS Code/);
});

test('resolve는 이미 적용한 프로젝트가 필요하다', t => {
  const fixture = makeFixture(t);
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-unapplied-'));
  t.after(() => fs.rmSync(other, { recursive: true, force: true }));

  const result = fixture.run(['profile', 'resolve', other]);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /profile apply/);
});
