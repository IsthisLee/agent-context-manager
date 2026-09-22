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

/** 프로필 하나가 든 보관함과 빈 프로젝트 폴더. */
function makeStore(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-tui-pin-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  const env = {
    ...process.env,
    AGCTX_HOME: home,
    AGCTX_LANG: 'en',
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@example.com',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@example.com'
  };
  const created = spawnSync(process.execPath, [cli, 'profile', 'create', 'team-backend', '--scope', 'team'], {
    cwd: root,
    env,
    encoding: 'utf8'
  });
  assert.equal(created.status, 0, created.stderr);
  const previousHome = process.env.AGCTX_HOME;
  process.env.AGCTX_HOME = home;
  t.after(() => {
    if (previousHome === undefined) delete process.env.AGCTX_HOME;
    else process.env.AGCTX_HOME = previousHome;
  });
  const profileDir = path.join(home, 'profiles', 'team-backend');
  const commitProfile = () => {
    for (const gitArgs of [
      ['init', '-b', 'main'],
      ['add', '-A'],
      ['commit', '-m', 'Add profile']
    ]) {
      const result = spawnSync('git', gitArgs, { cwd: profileDir, env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
  };
  return { project, commitProfile };
}

test('TUI는 Git 저장소가 아닌 프로필의 고정 여부를 묻지 않는다', t => {
  const { project } = makeStore(t);
  assert.deepEqual(pinPrompt('team-backend', project), { ask: false, initial: false });
});

test('TUI는 Git 프로필의 고정 여부를 묻고, 새 프로젝트에서는 고정하지 않는 것을 기본으로 고른다', t => {
  const { project, commitProfile } = makeStore(t);
  commitProfile();
  assert.deepEqual(pinPrompt('team-backend', project), { ask: true, initial: false });
});

test('TUI는 이미 고정한 프로젝트의 고정을 유지하는 것을 기본으로 고른다', t => {
  const { project, commitProfile } = makeStore(t);
  commitProfile();
  fs.writeFileSync(
    path.join(project, 'agctx.project.json'),
    JSON.stringify({ profile: 'team-backend', pin: true }) + '\n'
  );
  assert.deepEqual(pinPrompt('team-backend', project), { ask: true, initial: true });
});
