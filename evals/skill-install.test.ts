import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  applyInstall,
  applyUninstall,
  INSTALL_RECORD,
  outdatedSkills,
  planInstall,
  planUninstall,
  skillNotice
} from '../src/skills/install.ts';
import { packageVersion } from '../src/shared/runtime.ts';

/**
 * `agctx install`은 패키지에 든 스킬을 이 컴퓨터에서 찾은 에이전트마다 사용자 수준 스킬 폴더에
 * 복사하고, 자기가 쓴 것만 바꿀 수 있게 기록을 남긴다. 모든 경우를 임시 HOME에서 실행한다.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => fs.readFileSync(file, 'utf8');

function home(t: TestContext, folders: string[] = []) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-skill-install-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, CODEX_HOME: process.env.CODEX_HOME };
  process.env.HOME = dir;
  process.env.USERPROFILE = dir;
  delete process.env.CODEX_HOME;
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  for (const folder of folders) fs.mkdirSync(path.join(dir, folder), { recursive: true });
  return dir;
}

const states = (plan: ReturnType<typeof planInstall>) =>
  plan.items.map(item => `${item.target}:${item.skill}:${item.state}`).sort();

test('install은 이 컴퓨터에서 찾은 에이전트에 두 스킬을 복사하고 쓴 것을 기록한다', t => {
  const dir = home(t, ['.claude', '.codex']);

  const plan = planInstall({});

  assert.deepEqual(states(plan), [
    'claude:agctx-author:create',
    'claude:agctx:create',
    'codex:agctx-author:create',
    'codex:agctx:create'
  ]);
  assert.deepEqual(
    plan.skipped.map(target => target.id),
    ['antigravity', 'antigravity-cli']
  );
  applyInstall(plan);
  assert.equal(
    read(path.join(dir, '.claude', 'skills', 'agctx', 'SKILL.md')),
    read(path.join(repoRoot, 'skills', 'agctx', 'SKILL.md'))
  );
  assert.ok(fs.existsSync(path.join(dir, '.agents', 'skills', 'agctx-author', 'agents', 'openai.yaml')));
  const record = JSON.parse(read(path.join(dir, '.claude', 'skills', 'agctx', INSTALL_RECORD)));
  assert.equal(record.version, packageVersion());
  assert.match(record.files['SKILL.md'], /^[0-9a-f]{64}$/);
});

test('다시 install해도 바뀌는 것이 없고, 기록이 다른 버전인 폴더는 바꾼다', t => {
  const dir = home(t, ['.claude']);
  applyInstall(planInstall({}));

  assert.deepEqual(states(planInstall({})), ['claude:agctx-author:unchanged', 'claude:agctx:unchanged']);

  const recordFile = path.join(dir, '.claude', 'skills', 'agctx', INSTALL_RECORD);
  fs.writeFileSync(recordFile, JSON.stringify({ ...JSON.parse(read(recordFile)), version: '0.0.1' }));
  const plan = planInstall({});
  assert.deepEqual(states(plan), ['claude:agctx-author:unchanged', 'claude:agctx:update']);
  applyInstall(plan);
  assert.equal(JSON.parse(read(recordFile)).version, packageVersion());
});

test('install은 파일을 고친 스킬을 남기고 멈춘다. --force면 바꾼다', t => {
  const dir = home(t, ['.claude']);
  applyInstall(planInstall({}));
  fs.appendFileSync(path.join(dir, '.claude', 'skills', 'agctx', 'SKILL.md'), '\nmy note\n');

  const plan = planInstall({});

  assert.equal(plan.blocked, true);
  const item = plan.items.find(entry => entry.skill === 'agctx');
  assert.equal(item?.state, 'blocked');
  assert.match(item?.reason ?? '', /SKILL\.md/);
  assert.equal(planInstall({ force: true }).items.find(entry => entry.skill === 'agctx')?.state, 'update');
});

test(
  'install은 자기가 쓰지 않은 폴더와 심볼릭 링크를 남긴다. --force면 바꾼다',
  { skip: process.platform === 'win32' ? 'symbolic links need extra privileges on Windows' : false },
  t => {
    const dir = home(t, ['.claude']);
    fs.mkdirSync(path.join(dir, '.claude', 'skills', 'agctx'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'skills', 'agctx', 'SKILL.md'), '# someone else\n');
    fs.mkdirSync(path.join(dir, 'elsewhere', 'agctx-author'), { recursive: true });
    fs.symlinkSync(path.join(dir, 'elsewhere', 'agctx-author'), path.join(dir, '.claude', 'skills', 'agctx-author'));

    assert.deepEqual(states(planInstall({})), ['claude:agctx-author:blocked', 'claude:agctx:blocked']);

    const forced = planInstall({ force: true });
    assert.deepEqual(states(forced), ['claude:agctx-author:update', 'claude:agctx:update']);
    applyInstall(forced);
    assert.equal(fs.lstatSync(path.join(dir, '.claude', 'skills', 'agctx-author')).isSymbolicLink(), false);
    assert.ok(fs.existsSync(path.join(dir, 'elsewhere', 'agctx-author')), '링크가 가리키던 폴더는 남는다');
  }
);

test('--agent antigravity는 폴더가 없어도 Antigravity 폴더 두 곳에 모두 설치한다', t => {
  home(t);

  const plan = planInstall({ agent: 'antigravity' });

  assert.deepEqual(states(plan), [
    'antigravity-cli:agctx-author:create',
    'antigravity-cli:agctx:create',
    'antigravity:agctx-author:create',
    'antigravity:agctx:create'
  ]);
  assert.deepEqual(
    plan.items
      .map(item => item.dir)
      .filter((dir, index, all) => all.indexOf(dir) === index)
      .map(dir => path.relative(os.homedir(), dir))
      .sort(),
    [
      path.join('.gemini', 'antigravity-cli', 'skills', 'agctx'),
      path.join('.gemini', 'antigravity-cli', 'skills', 'agctx-author'),
      path.join('.gemini', 'config', 'skills', 'agctx'),
      path.join('.gemini', 'config', 'skills', 'agctx-author')
    ].sort()
  );
});

test('찾은 에이전트도 지정한 에이전트도 없으면 install이 멈춘다', t => {
  home(t);

  assert.throws(() => planInstall({}), { code: 'install.none-found' });
});

test('uninstall은 install이 쓴 폴더를 지우고 나머지는 남긴다', t => {
  const dir = home(t, ['.claude', '.codex']);
  applyInstall(planInstall({}));
  fs.rmSync(path.join(dir, '.agents', 'skills', 'agctx', INSTALL_RECORD));

  const plan = planUninstall({});

  assert.deepEqual(plan.items.map(item => `${item.target}:${item.skill}:${item.state}`).sort(), [
    'claude:agctx-author:remove',
    'claude:agctx:remove',
    'codex:agctx-author:remove',
    'codex:agctx:kept'
  ]);
  applyUninstall(plan);
  assert.equal(fs.existsSync(path.join(dir, '.claude', 'skills', 'agctx')), false);
  assert.ok(fs.existsSync(path.join(dir, '.agents', 'skills', 'agctx', 'SKILL.md')));
});

test('오래된 스킬은 기록이 다른 버전을 가리키는 설치된 스킬이다', t => {
  const dir = home(t, ['.claude']);
  assert.deepEqual(outdatedSkills(), []);
  applyInstall(planInstall({}));
  assert.deepEqual(outdatedSkills(), []);

  const recordFile = path.join(dir, '.claude', 'skills', 'agctx', INSTALL_RECORD);
  fs.writeFileSync(recordFile, JSON.stringify({ ...JSON.parse(read(recordFile)), version: '0.0.1' }));

  assert.deepEqual(outdatedSkills(), [{ dir: path.join(dir, '.claude', 'skills', 'agctx'), version: '0.0.1' }]);
});

const cli = path.join(repoRoot, 'src', 'agctx.ts');

function agctx(dir: string, args: string[]) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: dir,
    USERPROFILE: dir,
    AGCTX_HOME: path.join(dir, '.agctx'),
    AGCTX_LANG: 'en'
  };
  delete env.CODEX_HOME;
  return spawnSync(process.execPath, [cli, ...args], { cwd: dir, env, encoding: 'utf8' });
}

test('agctx install은 쓰는 스킬 폴더와 건너뛰는 에이전트를 하나씩 나열한다', t => {
  const dir = home(t, ['.claude']);

  const result = agctx(dir, ['install']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    new RegExp(`create\\s+${path.join(dir, '.claude', 'skills', 'agctx').replace(/[.\\]/g, '\\$&')}`)
  );
  assert.match(result.stdout, /skipped\s+.*\.agents.skills/);
  assert.ok(fs.existsSync(path.join(dir, '.claude', 'skills', 'agctx-author', 'SKILL.md')));
  const again = agctx(dir, ['install']).stdout;
  assert.match(again, /unchanged/);
  assert.match(again, /already up to date/);
  assert.doesNotMatch(again, /Installed the agctx skills/);
});

test('스킬 폴더를 고쳤으면 agctx install은 아무것도 쓰지 않고 멈추고, --force는 그것을 바꾼다', t => {
  const dir = home(t, ['.claude']);
  agctx(dir, ['install']);
  const skill = path.join(dir, '.claude', 'skills', 'agctx', 'SKILL.md');
  fs.appendFileSync(skill, '\nmy note\n');

  const result = agctx(dir, ['install']);

  assert.equal(result.status, 64);
  assert.match(result.stdout + result.stderr, /SKILL\.md/);
  assert.match(result.stderr, /--force/);
  assert.match(read(skill), /my note/);
  assert.equal(agctx(dir, ['install', '--force']).status, 0);
  assert.doesNotMatch(read(skill), /my note/);
});

test('agctx install --dry-run은 계획을 보여 주고 아무것도 쓰지 않는다', t => {
  const dir = home(t, ['.claude']);

  const result = agctx(dir, ['install', '--dry-run']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /create/);
  assert.equal(fs.existsSync(path.join(dir, '.claude', 'skills')), false);
});

test('에이전트를 찾지 못하면 agctx install이 확인한 폴더를 알려 준다', t => {
  const dir = home(t);

  const result = agctx(dir, ['install']);

  assert.equal(result.status, 64);
  assert.ok(result.stderr.includes(path.join(dir, '.claude')), result.stderr);
  assert.match(result.stderr, /--agent/);
});

test('agctx install --json은 모든 항목과 건너뛴 대상을 보고한다', t => {
  const dir = home(t, ['.codex']);

  const data = JSON.parse(agctx(dir, ['install', '--json']).stdout).data;

  assert.deepEqual(
    data.items
      .map((item: { target: string; skill: string; state: string }) => `${item.target}:${item.skill}:${item.state}`)
      .sort(),
    ['codex:agctx-author:create', 'codex:agctx:create']
  );
  assert.deepEqual(
    data.skipped.map((target: { target: string }) => target.target),
    ['claude', 'antigravity', 'antigravity-cli']
  );
  assert.equal(data.written, true);
});

test('agctx uninstall은 install이 쓴 스킬 폴더를 지우고 남기는 폴더를 알려 준다', t => {
  const dir = home(t, ['.claude']);
  agctx(dir, ['install']);
  fs.appendFileSync(path.join(dir, '.claude', 'skills', 'agctx', 'SKILL.md'), '\nmy note\n');

  const result = agctx(dir, ['uninstall']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /remove\s+.*agctx-author/);
  assert.match(result.stdout, /kept\s+.*agctx\b/);
  assert.equal(fs.existsSync(path.join(dir, '.claude', 'skills', 'agctx-author')), false);
  assert.ok(fs.existsSync(path.join(dir, '.claude', 'skills', 'agctx', 'SKILL.md')));
});

function outdated(t: TestContext) {
  const dir = home(t, ['.claude']);
  agctx(dir, ['install']);
  const recordFile = path.join(dir, '.claude', 'skills', 'agctx', INSTALL_RECORD);
  fs.writeFileSync(recordFile, JSON.stringify({ ...JSON.parse(read(recordFile)), version: '0.0.1' }));
  return dir;
}

test('설치된 스킬이 다른 agctx 버전이면 모든 명령이 그렇다고 한 줄로 알린다', t => {
  const dir = outdated(t);

  const list = agctx(dir, ['profile', 'list']);
  const lines = list.stderr.split('\n').filter(line => line.includes('agctx install'));
  assert.equal(lines.length, 1, list.stderr);
  assert.ok(lines[0].includes('0.0.1') && lines[0].includes(packageVersion()), lines[0]);

  const unknown = agctx(dir, ['profile', 'frobnicate']);
  assert.equal(unknown.status, 64);
  assert.match(unknown.stderr, /agctx install/);

  const json = JSON.parse(agctx(dir, ['profile', 'list', '--json']).stdout);
  assert.ok(
    json.warnings.some((warning: string) => warning.includes('agctx install')),
    JSON.stringify(json.warnings)
  );
});

test('install과 uninstall은 버전 알림을 되풀이하지 않고, 설치된 스킬이 없으면 아무 말도 하지 않는다', t => {
  const dir = outdated(t);
  assert.doesNotMatch(agctx(dir, ['install', '--dry-run']).stderr, /agctx install/);

  const fresh = home(t, ['.claude']);
  assert.doesNotMatch(agctx(fresh, ['profile', 'list']).stderr, /agctx install/);
});

test('알림은 오래된 폴더와 두 버전을 알려 준다', t => {
  const dir = home(t, ['.claude']);
  assert.equal(skillNotice(), null);
  applyInstall(planInstall({}));
  const recordFile = path.join(dir, '.claude', 'skills', 'agctx', INSTALL_RECORD);
  fs.writeFileSync(recordFile, JSON.stringify({ ...JSON.parse(read(recordFile)), version: '0.0.1' }));

  const notice = skillNotice() ?? '';

  assert.ok(notice.includes(path.join(dir, '.claude', 'skills', 'agctx')) && notice.includes('0.0.1'), notice);
  const otherRecord = path.join(dir, '.claude', 'skills', 'agctx-author', INSTALL_RECORD);
  fs.writeFileSync(otherRecord, JSON.stringify({ ...JSON.parse(read(otherRecord)), version: '0.0.1' }));
  assert.match(skillNotice() ?? '', /1 more folder/);
});
