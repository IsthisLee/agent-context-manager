import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pinPrompt } from '../src/tui/profile.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'src', 'agctx.ts');

/** A profile store with one profile, and an empty project folder. */
function makeStore(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-tui-pin-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  const env = { ...process.env, AGCTX_HOME: home, AGCTX_LANG: 'en', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
  const created = spawnSync(process.execPath, [cli, 'profile', 'create', 'team-backend', '--scope', 'team'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(created.status, 0, created.stderr);
  const previousHome = process.env.AGCTX_HOME;
  process.env.AGCTX_HOME = home;
  t.after(() => {
    if (previousHome === undefined) delete process.env.AGCTX_HOME;
    else process.env.AGCTX_HOME = previousHome;
  });
  const profileDir = path.join(home, 'profiles', 'team-backend');
  const commitProfile = () => {
    for (const gitArgs of [['init', '-b', 'main'], ['add', '-A'], ['commit', '-m', 'Add profile']]) {
      const result = spawnSync('git', gitArgs, { cwd: profileDir, env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
  };
  return { project, commitProfile };
}

test('the TUI does not ask about pinning a profile that is not a Git repository', t => {
  const { project } = makeStore(t);
  assert.deepEqual(pinPrompt('team-backend', project), { ask: false, initial: false });
});

test('the TUI asks about pinning a Git profile and defaults to not pinning a new project', t => {
  const { project, commitProfile } = makeStore(t);
  commitProfile();
  assert.deepEqual(pinPrompt('team-backend', project), { ask: true, initial: false });
});

test('the TUI defaults to keeping the pin of a project that is already pinned', t => {
  const { project, commitProfile } = makeStore(t);
  commitProfile();
  fs.writeFileSync(path.join(project, 'agctx.project.json'), JSON.stringify({ profile: 'team-backend', pin: true }) + '\n');
  assert.deepEqual(pinPrompt('team-backend', project), { ask: true, initial: true });
});
