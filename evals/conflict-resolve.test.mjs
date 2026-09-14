import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agentic.mjs');
const END = '<!-- agentic:managed:end -->';
const ADDED = '## Commands\n- Test: `pnpm test`\n';

function snapshot(dir) {
  const files = {};
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) walk(entryPath);
      else files[path.relative(dir, entryPath)] = fs.readFileSync(entryPath, 'utf8');
    }
  };
  walk(dir);
  return files;
}

function makeFixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-conflict-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const run = (args, env = {}) => spawnSync(process.execPath, [cli, ...args], {
    cwd: repoRoot,
    env: { ...process.env, AGENTIC_HOME: home, ...env },
    encoding: 'utf8'
  });
  const ok = (args, env) => {
    const result = run(args, env);
    assert.equal(result.status, 0, `${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
    return result;
  };
  ok(['profile', 'create', 'team', '--scope', 'team']);
  ok(['profile', 'apply', 'team', project]);
  const file = rel => path.join(project, rel);
  const read = rel => fs.readFileSync(file(rel), 'utf8');
  const write = (rel, content) => fs.writeFileSync(file(rel), content);
  return { project, run, ok, file, read, write };
}

function editPointerBlock(fixture) {
  fixture.write('CLAUDE.md', fixture.read('CLAUDE.md').replace(END, `${ADDED}${END}`));
}

function editProfileRegion(fixture) {
  fixture.write('AGENTS.md', fixture.read('AGENTS.md').replace(/^(# .*\n)/, `$1\n${ADDED}`));
}

test('a conflicting sync names every changed managed file and how to see the difference', t => {
  const fixture = makeFixture(t);
  editPointerBlock(fixture);
  editProfileRegion(fixture);
  const before = snapshot(fixture.project);

  const result = fixture.run(['profile', 'sync', fixture.project]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Managed file changed outside Agentic: AGENTS\.md, CLAUDE\.md/);
  assert.match(result.stderr, /profile sync --dry-run/);
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
  assert.match(result.stdout, /^-## Commands$/m);
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
