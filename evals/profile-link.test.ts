import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { commitAndPush, fakeGh, gitIn, makeWorkspace, serviceRepo, type Person } from './support/git-workspace.ts';

/**
 * `profile link`는 이 컴퓨터에 이미 있는 규칙 저장소 폴더를 프로필로 만든다. 그 폴더에
 * profile.json을 쓰고 보관함에는 포인터를 남겨서, 커밋하기 전에도 폴더를 있는 그대로 적용한다.
 */

const read = (file: string) => fs.readFileSync(file, 'utf8');
const json = (file: string) => JSON.parse(read(file));

/** 주어진 파일로 된 규칙 저장소. `git`이 true이면 한 번 커밋한다. */
function rulesFolder(root: string, name: string, files: Record<string, string>, options: { git?: boolean } = {}) {
  const dir = path.join(root, name);
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  if (options.git !== false) {
    gitIn(dir, 'init', '--quiet', '--initial-branch=main');
    gitIn(dir, 'remote', 'add', 'origin', 'https://example.com/acme/team-rules.git');
    gitIn(dir, 'add', '-A');
    gitIn(dir, 'commit', '--quiet', '-m', 'Add rules');
  }
  return dir;
}

function setup(t: TestContext) {
  const { root, person, folder } = makeWorkspace(t, 'agctx-link-');
  const admin = person('admin');
  const pointer = (name: string) => path.join(admin.home, 'profiles', name, 'link.json');
  return { root, admin, folder, pointer };
}

const subfolderRules = {
  'docs/policy.md': '# Policy for people\n',
  'templates/AGENTS.md': '# Team rules\n\n- Keep secrets out of commits.\n'
};

function listed(admin: Person) {
  return JSON.parse(admin.ok(['profile', 'list', '--json']).stdout).data;
}

test('link는 규칙이 하위 폴더에 있는 저장소에 profile.json과 포인터를 쓰고, apply는 커밋 없이 그것을 쓴다', t => {
  const { root, admin, folder, pointer } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  const commits = gitIn(dir, 'rev-list', '--count', 'HEAD');

  admin.ok(['profile', 'link', dir, '--yes']);

  const metadata = json(path.join(dir, 'profile.json'));
  assert.deepEqual(
    [metadata.schemaVersion, metadata.name, metadata.scope, metadata.instructions],
    [2, 'team-rules', 'personal', 'templates/AGENTS.md']
  );
  assert.equal(json(pointer('team-rules')).path, dir);
  assert.deepEqual(fs.readdirSync(path.dirname(pointer('team-rules'))), ['link.json'], '보관함에는 포인터만 남는다');
  const profiles = listed(admin).profiles;
  assert.deepEqual(
    profiles.map((profile: { name: string; link?: string }) => [profile.name, profile.link]),
    [['team-rules', dir]]
  );
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'team-rules', project, '--yes']);
  assert.match(read(path.join(project, 'AGENTS.md')), /^# Team rules/);
  assert.equal(gitIn(dir, 'rev-list', '--count', 'HEAD'), commits, 'link는 커밋하지 않는다');
});

test('link는 루트에 AGENTS.md가 있는 규칙 저장소를 스키마 버전 1로 둔다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'root-rules', {
    'AGENTS.md': '# Root rules\n',
    'docs/AGENTS.md': '# Docs folder notes\n'
  });

  admin.ok(['profile', 'link', dir, '--yes']);

  const metadata = json(path.join(dir, 'profile.json'));
  assert.equal(metadata.schemaVersion, 1);
  assert.equal(metadata.instructions, undefined);
});

test('link는 여러 규칙 파일 사이에서 추측하지 않고 --instructions가 가리키는 것을 가져간다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'many-rules', {
    'backend/AGENTS.md': '# Backend\n',
    'frontend/AGENTS.md': '# Frontend\n'
  });

  const refused = admin.run(['profile', 'link', dir, '--yes']);
  assert.equal(refused.status, 64);
  assert.match(refused.stderr, /backend\/AGENTS\.md/);
  assert.match(refused.stderr, /frontend\/AGENTS\.md/);
  assert.equal(fs.existsSync(path.join(dir, 'profile.json')), false);

  admin.ok(['profile', 'link', dir, '--instructions', 'frontend/AGENTS.md', '--yes']);
  assert.equal(json(path.join(dir, 'profile.json')).instructions, 'frontend/AGENTS.md');
});

test('link는 이미 있는 profile.json을 그대로 쓰고, 그것과 어긋나는 옵션을 거부한다', t => {
  const { root, admin, pointer } = setup(t);
  const existing =
    JSON.stringify(
      { schemaVersion: 2, name: 'shared-rules', scope: 'company', instructions: 'templates/AGENTS.md' },
      null,
      2
    ) + '\n';
  const dir = rulesFolder(root, 'team-rules', { ...subfolderRules, 'profile.json': existing });

  const mismatch = admin.run(['profile', 'link', dir, '--name', 'other-name', '--yes']);
  assert.equal(mismatch.status, 64);
  assert.equal(fs.existsSync(pointer('other-name')), false);

  admin.ok(['profile', 'link', dir, '--yes']);
  assert.equal(read(path.join(dir, 'profile.json')), existing, '이미 있는 profile.json은 다시 쓰지 않는다');
  assert.equal(json(pointer('shared-rules')).path, dir);
});

test('link --dry-run은 아무것도 쓰지 않고, 터미널 밖에서는 --yes가 필요하다', t => {
  const { root, admin, pointer } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);

  const dryRun = admin.ok(['profile', 'link', dir, '--dry-run']);
  assert.match(dryRun.stdout, /profile\.json/);
  const unconfirmed = admin.run(['profile', 'link', dir]);
  assert.equal(unconfirmed.status, 64);

  assert.equal(fs.existsSync(path.join(dir, 'profile.json')), false);
  assert.equal(fs.existsSync(pointer('team-rules')), false);
});

test('연결된 폴더의 수정은 바로 적용되고, uncommitted로 기록되며, 고정할 수 없다', t => {
  const { root, admin, folder } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);
  fs.appendFileSync(path.join(dir, 'templates', 'AGENTS.md'), '- A rule written a minute ago.\n');
  const project = folder('orders-api');

  admin.ok(['profile', 'apply', 'team-rules', project, '--yes']);

  assert.match(read(path.join(project, 'AGENTS.md')), /A rule written a minute ago/);
  const config = json(path.join(project, 'agctx.project.json'));
  assert.equal(config.uncommitted, true);
  assert.equal(config.source.git, 'https://example.com/acme/team-rules.git');
  assert.equal(admin.run(['profile', 'apply', 'team-rules', project, '--pin', '--yes']).status, 64);
});

test('pull, push, connect는 연결된 프로필에서 멈추고 폴더를 그대로 둔다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);
  gitIn(dir, 'add', 'profile.json');
  gitIn(dir, 'commit', '--quiet', '-m', 'Add profile.json');
  const head = gitIn(dir, 'rev-parse', 'HEAD');
  const config = read(path.join(dir, '.git', 'config'));

  for (const args of [
    ['profile', 'pull', 'team-rules'],
    ['profile', 'push', 'team-rules', '--yes'],
    ['profile', 'connect', 'team-rules', 'https://example.com/acme/other.git']
  ]) {
    const result = admin.run(args);
    assert.equal(result.status, 64, `${args.join(' ')}\n${result.stderr}`);
    assert.ok(result.stderr.includes(dir), `${args[1]}은 연결된 폴더를 알려 준다`);
  }

  assert.equal(gitIn(dir, 'rev-parse', 'HEAD'), head);
  assert.equal(read(path.join(dir, '.git', 'config')), config);
  const status = JSON.parse(admin.ok(['profile', 'status', 'team-rules', '--json']).stdout).data.profiles[0];
  assert.equal(status.link, dir);
});

test('remove는 포인터만 지우고 연결된 폴더와 그 이력은 남긴다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);

  admin.ok(['profile', 'remove', 'team-rules', '--yes']);

  assert.equal(fs.existsSync(path.join(admin.home, 'profiles', 'team-rules')), false);
  assert.ok(fs.existsSync(path.join(dir, 'templates', 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(dir, 'profile.json')));
  assert.ok(fs.existsSync(path.join(dir, '.git', 'HEAD')));
});

test('폴더가 옮겨진 링크는 끊긴 것으로 나열되고, 쓸 때 옛 경로를 알려 주며, 지운 뒤에만 다시 연결된다', t => {
  const { root, admin, folder, pointer } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);
  // profile.json을 커밋해서 프로젝트가 깨끗한 버전을 기록하고, check가 보고할 것은 끊긴 링크뿐이게 한다.
  gitIn(dir, 'add', 'profile.json');
  gitIn(dir, 'commit', '--quiet', '-m', 'Add profile.json');
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'team-rules', project, '--yes']);
  const moved = path.join(root, 'moved', 'team-rules');
  fs.mkdirSync(path.dirname(moved), { recursive: true });
  fs.renameSync(dir, moved);

  assert.deepEqual(listed(admin).brokenLinks, [{ name: 'team-rules', path: dir, reason: 'missing-folder' }]);
  const apply = admin.run(['profile', 'sync', project, '--yes']);
  assert.equal(apply.status, 64);
  assert.ok(apply.stderr.includes(dir), '오류가 링크가 가리키는 폴더를 알려 준다');
  const checked = admin.run(['check', project]);
  assert.equal(checked.status, 0, checked.stderr);
  assert.ok(checked.stdout.includes(dir) || checked.stderr.includes(dir), 'check는 링크가 끊겼다고 경고한다');

  const again = admin.run(['profile', 'link', moved, '--yes']);
  assert.equal(again.status, 64, 'link는 끊긴 링크를 다른 곳으로 옮기지 않는다');
  assert.match(again.stderr, /profile remove team-rules --yes/);
  assert.match(again.stderr, /--name team-rules/);
  assert.equal(json(pointer('team-rules')).path, dir);
  admin.ok(['profile', 'remove', 'team-rules', '--yes']);
  admin.ok(['profile', 'link', moved, '--yes']);
  assert.equal(json(pointer('team-rules')).path, moved);
  admin.ok(['profile', 'sync', project, '--yes']);

  fs.rmSync(moved, { recursive: true, force: true });
  admin.ok(['profile', 'remove', 'team-rules', '--yes']);
  assert.equal(fs.existsSync(path.join(admin.home, 'profiles', 'team-rules')), false);
});

test('link는 clone하거나 만든 프로필이 이미 가진 이름을 거부한다', t => {
  const { root, admin } = setup(t);
  admin.ok(['profile', 'create', 'team-rules']);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.equal(fs.existsSync(path.join(dir, 'profile.json')), false);
  assert.ok(
    fs.existsSync(path.join(admin.home, 'profiles', 'team-rules', 'AGENTS.md')),
    '기존 프로필은 건드리지 않는다'
  );
});

test('Git 저장소가 아닌 폴더도 연결하고 적용할 수 있지만 고정할 수는 없다', t => {
  const { root, admin, folder } = setup(t);
  const dir = rulesFolder(root, 'plain-rules', { 'AGENTS.md': '# Plain rules\n' }, { git: false });
  admin.ok(['profile', 'link', dir, '--yes']);
  const project = folder('orders-api');

  admin.ok(['profile', 'apply', 'plain-rules', project, '--yes']);

  assert.match(read(path.join(project, 'AGENTS.md')), /^# Plain rules/);
  assert.equal(admin.run(['profile', 'apply', 'plain-rules', project, '--pin', '--yes']).status, 64);
});

/** 원격보다 한 커밋 뒤에 있는 연결된 Git 폴더. profile.json은 커밋되어 있다. */
function linkedBehindRemote(t: TestContext) {
  const { root, admin, folder } = setup(t);
  const remote = path.join(root, 'remotes', 'team-rules.git');
  fs.mkdirSync(path.dirname(remote), { recursive: true });
  gitIn(root, 'init', '--bare', '--quiet', '--initial-branch=main', remote);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  gitIn(dir, 'remote', 'set-url', 'origin', remote);
  admin.ok(['profile', 'link', dir, '--yes']);
  gitIn(dir, 'add', 'profile.json');
  gitIn(dir, 'commit', '--quiet', '-m', 'Add profile.json');
  gitIn(dir, 'push', '--quiet', '--set-upstream', 'origin', 'main');
  const other = path.join(root, 'other');
  gitIn(root, 'clone', '--quiet', remote, other);
  fs.appendFileSync(path.join(other, 'templates', 'AGENTS.md'), '- A rule pushed from elsewhere.\n');
  gitIn(other, 'commit', '--quiet', '-am', 'New rule');
  gitIn(other, 'push', '--quiet', 'origin', 'HEAD:main');
  return { root, admin, folder, dir };
}

test('연결된 프로필의 status는 그 폴더에서 fetch하지 않고 pull이나 push를 안내하지도 않는다', t => {
  const { admin, dir } = linkedBehindRemote(t);
  const before = gitIn(dir, 'rev-parse', 'refs/remotes/origin/main');

  const result = admin.ok(['profile', 'status', 'team-rules', '--refresh']);

  assert.equal(gitIn(dir, 'rev-parse', 'refs/remotes/origin/main'), before, '연결된 폴더는 fetch하지 않는다');
  assert.doesNotMatch(result.stdout, /agctx profile (pull|push)/);

  // 그 사람이 거기서 fetch하면 status는 폴더가 뒤처졌다고 보고, 여전히 profile pull이 아니라 git을 안내한다.
  gitIn(dir, 'fetch', '--quiet');
  const behind = JSON.parse(admin.ok(['profile', 'status', 'team-rules', '--json']).stdout).data.profiles[0];
  assert.equal(behind.behind, 1);
  assert.doesNotMatch(admin.ok(['profile', 'status', 'team-rules']).stdout, /agctx profile (pull|push)/);
});

test('repos status는 연결된 프로필의 고정한 프로젝트에 profile pull을 실행하라고 하지 않는다', t => {
  const { admin, folder, dir } = linkedBehindRemote(t);
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'team-rules', project, '--pin', '--yes']);
  gitIn(dir, 'pull', '--quiet');

  const result = admin.run(['repos', 'status']);

  assert.match(result.stdout + result.stderr, /behind/);
  assert.doesNotMatch(result.stdout + result.stderr, /agctx profile pull/);
});

test('저장소에 자기 link.json이 있는 clone 프로필은 평범한 프로필로 남는다', t => {
  const { root, admin, folder } = setup(t);
  const metadata = JSON.stringify({ schemaVersion: 1, name: 'shared', scope: 'team' }) + '\n';
  const dir = rulesFolder(root, 'shared', {
    'profile.json': metadata,
    'AGENTS.md': '# Shared rules\n',
    'link.json': '{"version":"1.0.0"}\n'
  });

  admin.ok(['profile', 'clone', dir]);

  const profiles = listed(admin).profiles;
  assert.deepEqual(
    profiles.map((profile: { name: string; link?: string }) => [profile.name, profile.link]),
    [['shared', undefined]]
  );
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'shared', project, '--yes']);
  assert.match(read(path.join(project, 'AGENTS.md')), /^# Shared rules/);
});

test('폴더가 profile.json을 잃은 링크는 끊긴 것으로 나열되고, 폴더를 알려 주며, 지울 수 있다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);
  fs.rmSync(path.join(dir, 'profile.json'));

  const data = listed(admin);
  assert.deepEqual(data.profiles, []);
  assert.deepEqual(data.brokenLinks, [{ name: 'team-rules', path: dir, reason: 'missing-metadata' }]);
  const view = admin.run(['profile', 'view', 'team-rules']);
  assert.equal(view.status, 64);
  assert.ok(view.stderr.includes(dir), '오류가 연결된 폴더를 알려 준다');

  admin.ok(['profile', 'remove', 'team-rules', '--yes']);
  assert.equal(fs.existsSync(path.join(admin.home, 'profiles', 'team-rules')), false);
  assert.ok(fs.existsSync(path.join(dir, 'templates', 'AGENTS.md')));
});

test('연결된 프로필의 안내는 링크가 거부하는 명령을 가리키지 않는다', t => {
  const { root, admin, folder } = setup(t);
  const metadata = JSON.stringify({ schemaVersion: 1, name: 'shared', scope: 'team' }) + '\n';
  const shared = rulesFolder(root, 'shared', { 'profile.json': metadata, 'AGENTS.md': '# Shared rules\n' });
  admin.ok(['profile', 'clone', shared]);
  const taken = admin.run(['profile', 'link', shared, '--yes']);
  assert.equal(taken.status, 64);
  assert.doesNotMatch(taken.stderr, /--name/, 'profile.json이 있는 폴더는 --name을 받을 수 없다');

  const plain = rulesFolder(root, 'plain-rules', { 'AGENTS.md': '# Plain rules\n' }, { git: false });
  admin.ok(['profile', 'link', plain, '--yes']);
  const project = folder('orders-api');
  const pinPlain = admin.run(['profile', 'apply', 'plain-rules', project, '--pin', '--yes']);
  assert.equal(pinPlain.status, 64);
  assert.doesNotMatch(pinPlain.stderr, /profile connect/);

  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);
  gitIn(dir, 'add', 'profile.json');
  gitIn(dir, 'commit', '--quiet', '-m', 'Add profile.json');
  fs.appendFileSync(path.join(dir, 'templates', 'AGENTS.md'), '- Pinned rule.\n');
  gitIn(dir, 'commit', '--quiet', '-am', 'Pinned rule');
  const pinned = folder('pinned-api');
  admin.ok(['profile', 'apply', 'team-rules', pinned, '--pin', '--yes']);
  gitIn(dir, 'reset', '--quiet', '--hard', 'HEAD~1');
  gitIn(dir, 'reflog', 'expire', '--expire=now', '--all');
  gitIn(dir, 'gc', '--quiet', '--prune=now');
  const missing = admin.run(['profile', 'sync', pinned, '--yes']);
  assert.equal(missing.status, 69);
  assert.doesNotMatch(missing.stderr, /profile pull/);
});

const noLinks = process.platform === 'win32' ? 'symbolic links need extra privileges on Windows' : false;

test('profile.json을 잃은 연결 폴더의 안내는 같은 프로필을 되살린다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--name', 'company', '--yes']);
  fs.rmSync(path.join(dir, 'profile.json'));

  const view = admin.run(['profile', 'view', 'company']);
  assert.equal(view.status, 64);
  assert.match(view.stderr, /profile remove company --yes/);
  assert.match(view.stderr, /--name company/);

  admin.ok(['profile', 'remove', 'company', '--yes']);
  admin.ok(['profile', 'link', dir, '--name', 'company', '--yes']);
  assert.deepEqual(
    listed(admin).profiles.map((profile: { name: string }) => profile.name),
    ['company']
  );
});

test('check는 어떤 종류의 끊긴 링크에서도 멈추지 않고 경고한다', t => {
  const { root, admin, folder } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);
  gitIn(dir, 'add', 'profile.json');
  gitIn(dir, 'commit', '--quiet', '-m', 'Add profile.json');
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'team-rules', project, '--yes']);

  fs.rmSync(path.join(dir, 'profile.json'));
  const lostMetadata = admin.run(['check', project]);
  assert.equal(lostMetadata.status, 0, lostMetadata.stderr);
  assert.ok((lostMetadata.stdout + lostMetadata.stderr).includes(dir));

  fs.writeFileSync(path.join(admin.home, 'profiles', 'team-rules', 'link.json'), 'not json\n');
  const unreadable = admin.run(['check', project]);
  assert.equal(unreadable.status, 0, unreadable.stderr);
});

test('규칙 파일이 사라진 연결 폴더는 끊긴 것으로 나열되고 쓸 때 그 파일을 알려 준다', t => {
  const { root, admin, folder } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);
  fs.renameSync(path.join(dir, 'templates', 'AGENTS.md'), path.join(dir, 'templates', 'OLD.md'));

  assert.deepEqual(listed(admin).brokenLinks, [{ name: 'team-rules', path: dir, reason: 'missing-rules' }]);
  const apply = admin.run(['profile', 'apply', 'team-rules', folder('orders-api'), '--yes']);
  assert.equal(apply.status, 64);
  assert.ok(apply.stderr.includes('templates/AGENTS.md') && apply.stderr.includes(dir), apply.stderr);
});

test('profile.json이 가리키는 규칙 파일이 없는 폴더는 --instructions가 아니라 profile.json을 안내한다', t => {
  const { root, admin } = setup(t);
  const metadata = JSON.stringify({ schemaVersion: 1, name: 'team-rules', scope: 'team' }) + '\n';
  const dir = rulesFolder(root, 'team-rules', { 'profile.json': metadata, 'templates/AGENTS.md': '# Team rules\n' });

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /profile\.json/);
  assert.doesNotMatch(result.stderr, /--instructions/);
});

test('repos pr은 연결된 프로필의 커밋을 pull request 본문에 나열한다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);
  gitIn(dir, 'add', 'profile.json');
  gitIn(dir, 'commit', '--quiet', '-m', 'Add profile.json');
  const service = serviceRepo(root, 'orders-api');
  admin.ok(['profile', 'apply', 'team-rules', service.work, '--pin', '--yes']);
  commitAndPush(service.work, 'Apply team-rules profile');
  fs.appendFileSync(path.join(dir, 'templates', 'AGENTS.md'), '- Require migration tests.\n');
  gitIn(dir, 'commit', '--quiet', '-am', 'Require migration tests');
  const gh = fakeGh(t);

  admin.ok(['repos', 'pr', '--profile', 'team-rules', '--yes'], gh.env);

  const [create] = gh.calls().filter(call => call.args[0] === 'pr' && call.args[1] === 'create');
  assert.match(create?.body ?? '', /Require migration tests/);
});

test('AGENTS.md라는 이름의 심볼릭 링크는 링크로 보고하고 그 대상을 제안한다', { skip: noLinks }, t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', { 'CLAUDE.md': '# Rules\n' }, { git: false });
  fs.symlinkSync('CLAUDE.md', path.join(dir, 'AGENTS.md'));

  const refused = admin.run(['profile', 'link', dir, '--yes']);
  assert.equal(refused.status, 64);
  assert.match(refused.stderr, /symbolic link/i);
  assert.match(refused.stderr, /--instructions CLAUDE\.md/);

  admin.ok(['profile', 'link', dir, '--instructions', 'CLAUDE.md', '--yes']);
});

test('Git 저장소 안의 폴더는 저장소 루트로 연결한다', t => {
  const { root, admin } = setup(t);
  const repo = rulesFolder(root, 'company-configs', {
    'agent-rules/AGENTS.md': '# Rules\n',
    'README.md': '# Configs\n'
  });

  const result = admin.run(['profile', 'link', path.join(repo, 'agent-rules'), '--yes']);

  assert.equal(result.status, 64);
  assert.ok(result.stderr.includes(repo), '안내가 저장소 루트를 알려 준다');
  assert.match(result.stderr, /--instructions agent-rules\/AGENTS\.md/);
});

test('Git 저장소가 아닌 연결 폴더의 status는 Git 조언을 하지 않는다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'plain-rules', { 'AGENTS.md': '# Plain\n' }, { git: false });
  admin.ok(['profile', 'link', dir, '--yes']);

  const status = admin.ok(['profile', 'status', 'plain-rules']);

  assert.ok(status.stdout.includes(dir));
  assert.doesNotMatch(status.stdout, /pull and push with git|git -C/, 'Git 밖의 폴더는 실행할 git 명령을 받지 않는다');
});

test('링크 안내대로, 프로필이 아닌 보관함 폴더는 지울 수 있다', t => {
  const { root, admin } = setup(t);
  fs.mkdirSync(path.join(admin.home, 'profiles', 'ghost'), { recursive: true });
  const dir = rulesFolder(root, 'team-rules', subfolderRules);

  const taken = admin.run(['profile', 'link', dir, '--name', 'ghost', '--yes']);
  assert.equal(taken.status, 64);
  assert.match(taken.stderr, /profile remove ghost/);
  admin.ok(['profile', 'remove', 'ghost', '--yes']);
  admin.ok(['profile', 'link', dir, '--name', 'ghost', '--yes']);
});

test('프로필 이름이 될 수 없는 폴더 이름이면 쓸 수 있는 이름과 함께 --name을 안내한다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'TeamRules', { 'AGENTS.md': '# Rules\n' }, { git: false });

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /--name teamrules/);
});

test('공백이 든 경로의 재시도 명령은 경로를 한 덩어리로 유지한다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team rules', { 'AGENTS.md': '# Rules\n' }, { git: false });

  const result = admin.run(['profile', 'link', dir, '--name', 'team-rules']);

  assert.equal(result.status, 64);
  assert.ok(result.stderr.includes(`"${dir}"`), result.stderr);
});

test('profile list --scope는 텍스트와 마찬가지로 JSON에서도 끊긴 링크를 뺀다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--scope', 'team', '--yes']);
  fs.rmSync(dir, { recursive: true, force: true });

  const scoped = JSON.parse(admin.ok(['profile', 'list', '--scope', 'team', '--json']).stdout).data;
  assert.deepEqual(scoped.brokenLinks, []);
  assert.equal(listed(admin).brokenLinks.length, 1);
});

test(
  '옮겨진 폴더를 가리키는 운영체제 링크인 보관함 폴더는 끊긴 링크이고, check는 거기서 멈추지 않는다',
  { skip: noLinks },
  t => {
    const { root, admin, folder } = setup(t);
    const metadata = JSON.stringify({ schemaVersion: 1, name: 'sym', scope: 'team' }) + '\n';
    const dir = rulesFolder(root, 'sym-rules', { 'profile.json': metadata, 'AGENTS.md': '# Rules\n' }, { git: false });
    fs.mkdirSync(path.join(admin.home, 'profiles'), { recursive: true });
    fs.symlinkSync(dir, path.join(admin.home, 'profiles', 'sym'));
    const project = folder('orders-api');
    admin.ok(['profile', 'apply', 'sym', project, '--yes']);
    const moved = path.join(root, 'moved');
    fs.renameSync(dir, moved);

    const check = admin.run(['check', project]);
    assert.equal(check.status, 0, check.stderr);
    assert.ok((check.stdout + check.stderr).includes(dir));
    assert.deepEqual(listed(admin).brokenLinks, [{ name: 'sym', path: dir, reason: 'missing-folder' }]);

    admin.ok(['profile', 'remove', 'sym', '--yes']);
    assert.ok(fs.existsSync(path.join(moved, 'AGENTS.md')), '링크를 지워도 가리키던 폴더는 남는다');
    assert.deepEqual(fs.readdirSync(path.join(admin.home, 'profiles')), []);
    admin.ok(['profile', 'link', moved, '--yes']);
    assert.deepEqual(
      listed(admin).profiles.map((profile: { name: string; link?: string }) => [profile.name, profile.link]),
      [['sym', moved]]
    );
  }
);

test('link는 --yes가 있어도 동작하는 링크를 같은 이름의 다른 폴더로 옮기지 않는다', t => {
  const { root, admin, folder } = setup(t);
  const first = rulesFolder(root, 'a/rules', { 'AGENTS.md': '# A rules\n' }, { git: false });
  const second = rulesFolder(root, 'b/rules', { 'AGENTS.md': '# B rules\n' }, { git: false });
  admin.ok(['profile', 'link', first, '--yes']);
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'rules', project, '--yes']);

  const refused = admin.run(['profile', 'link', second, '--yes']);

  assert.equal(refused.status, 64);
  assert.ok(refused.stderr.includes(first), '오류가 링크가 붙잡고 있는 폴더를 알려 준다');
  assert.match(refused.stderr, /profile remove rules --yes/);
  assert.equal(json(path.join(admin.home, 'profiles', 'rules', 'link.json')).path, first);
  assert.ok(!fs.existsSync(path.join(second, 'profile.json')), '다른 폴더에는 아무것도 쓰지 않는다');
  admin.ok(['profile', 'sync', project, '--yes']);
  assert.match(read(path.join(project, 'AGENTS.md')), /A rules/);
});

test('profile.json이 이제 다른 프로필 이름을 가진 링크는 이름을 고치거나 링크를 버리는 방법을 알려 준다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'rules', { 'AGENTS.md': '# Rules\n' }, { git: false });
  admin.ok(['profile', 'link', dir, '--yes']);
  const metadataFile = path.join(dir, 'profile.json');
  fs.writeFileSync(metadataFile, JSON.stringify({ ...json(metadataFile), name: 'other' }) + '\n');

  const view = admin.run(['profile', 'view', 'rules']);

  assert.equal(view.status, 64);
  assert.ok(view.stderr.includes(metadataFile), view.stderr);
  assert.match(view.stderr, /"name"/);
  assert.match(view.stderr, /profile remove rules --yes/);
});

test('repos status는 저장소가 끊긴 링크를 쓴다고 보여 준다', t => {
  const { root, admin, folder } = setup(t);
  const dir = rulesFolder(root, 'rules', { 'AGENTS.md': '# Rules\n' }, { git: false });
  admin.ok(['profile', 'link', dir, '--yes']);
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'rules', project, '--yes']);
  fs.renameSync(dir, path.join(root, 'moved'));

  const status = admin.run(['repos', 'status']);

  assert.match(status.stdout + status.stderr, /broken link/);
  assert.ok((status.stdout + status.stderr).includes(dir));
  const repos = JSON.parse(admin.run(['repos', 'status', '--json']).stdout).data.repos;
  assert.ok(repos[0].warnings.some((warning: string) => warning.includes(dir)));
});

test('repos status는 연결된 프로필의 고정한 프로젝트에 pull request를 열기 전에 그 폴더를 최신으로 만들고 push하라고 알려 준다', t => {
  const { admin, folder, dir } = linkedBehindRemote(t);
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'team-rules', project, '--pin', '--yes']);
  gitIn(dir, 'pull', '--quiet');

  const result = admin.run(['repos', 'status']);

  const output = result.stdout + result.stderr;
  assert.ok(output.includes(`git -C ${dir} pull`) && output.includes(`git -C ${dir} push`), output);
  assert.match(output, /agctx repos pr --profile team-rules/);
});

test('profile.json을 잃은 링크의 안내는 연결할 때의 범위와 규칙 파일을 알려 준다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(
    root,
    'team-rules',
    { 'AGENTS.md': '# For contributors\n', 'templates/AGENTS.md': '# Team rules\n' },
    { git: false }
  );
  admin.ok([
    'profile',
    'link',
    dir,
    '--name',
    'company',
    '--scope',
    'company',
    '--instructions',
    'templates/AGENTS.md',
    '--yes'
  ]);
  fs.rmSync(path.join(dir, 'profile.json'));

  const view = admin.run(['profile', 'view', 'company']);
  const command = `agctx profile link ${dir} --name company --scope company --instructions templates/AGENTS.md`;
  assert.ok(view.stderr.includes(command), view.stderr);
  admin.ok(['profile', 'remove', 'company', '--yes']);
  admin.ok([
    'profile',
    'link',
    dir,
    '--name',
    'company',
    '--scope',
    'company',
    '--instructions',
    'templates/AGENTS.md',
    '--yes'
  ]);

  const metadata = json(path.join(dir, 'profile.json'));
  assert.equal(metadata.scope, 'company');
  assert.equal(metadata.instructions, 'templates/AGENTS.md');
});

test('규칙 파일이 폴더가 된 연결 폴더는 입출력 오류가 아니라 끊긴 링크다', t => {
  const { root, admin, folder } = setup(t);
  const dir = rulesFolder(root, 'rules', { 'AGENTS.md': '# Rules\n' }, { git: false });
  admin.ok(['profile', 'link', dir, '--yes']);
  fs.rmSync(path.join(dir, 'AGENTS.md'));
  fs.mkdirSync(path.join(dir, 'AGENTS.md'));

  assert.deepEqual(listed(admin).brokenLinks, [{ name: 'rules', path: dir, reason: 'missing-rules' }]);
  const apply = admin.run(['profile', 'apply', 'rules', folder('orders-api'), '--yes']);
  assert.equal(apply.status, 64, apply.stderr);
});

test('하위 폴더의 AGENTS.md라는 심볼릭 링크는 없는 것이 아니라 링크로 보고한다', { skip: noLinks }, t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'rules', { 'shared/RULES.md': '# Rules\n', 'sub/.keep': '' }, { git: false });
  fs.symlinkSync('../shared/RULES.md', path.join(dir, 'sub', 'AGENTS.md'));

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /symbolic link/i);
  assert.match(result.stderr, /--instructions shared\/RULES\.md/);
});

test('Git 저장소 안 폴더의 안내는 준 이름과 범위를 유지하고 경로를 인용한다', t => {
  const { root, admin } = setup(t);
  const repo = rulesFolder(root, 'company-configs', { 'Team Rules/AGENTS.md': '# Rules\n' });

  const result = admin.run(['profile', 'link', path.join(repo, 'Team Rules'), '--scope', 'team', '--yes']);

  assert.equal(result.status, 64);
  assert.ok(result.stderr.includes('--instructions "Team Rules/AGENTS.md"'), result.stderr);
  assert.match(result.stderr, /--name team-rules/);
  assert.match(result.stderr, /--scope team/);
});

test('심볼릭 링크인 규칙 파일의 안내는 공백이 든 대상 경로를 인용한다', { skip: noLinks }, t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'rules', { 'real dir/R.md': '# Rules\n' }, { git: false });
  fs.symlinkSync('real dir/R.md', path.join(dir, 'AGENTS.md'));

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.ok(result.stderr.includes('--instructions "real dir/R.md"'), result.stderr);
});

test('link는 홈 폴더 전체를 찾지 않고 거부한다', t => {
  const { root, admin } = setup(t);
  const home = path.join(root, 'user-home');
  fs.mkdirSync(path.join(home, 'Documents', 'notes'), { recursive: true });

  const result = admin.run(['profile', 'link', home, '--yes'], { HOME: home, USERPROFILE: home });

  assert.equal(result.status, 64);
  assert.match(result.stderr, /home folder/);
});

test('Git이 추적하지 않는 폴더는 위의 저장소에 다른 파일이 있어도 연결한다', t => {
  const { root, admin } = setup(t);
  const home = rulesFolder(root, 'user-home', { '.bashrc': '# shell\n' });
  const dir = path.join(home, 'work', 'rules');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Rules\n');

  admin.ok(['profile', 'link', dir, '--yes']);
});

test('한 이름으로 이미 연결된 폴더는 다른 이름으로 다시 연결하지 않는다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', { 'AGENTS.md': '# Rules\n' }, { git: false });
  admin.ok(['profile', 'link', dir, '--yes']);

  // 동작하는 링크의 폴더에는 profile.json이 있고, 옵션으로 그 이름을 바꿀 수 없다.
  const healthy = admin.run(['profile', 'link', dir, '--name', 'other', '--yes']);
  assert.equal(healthy.status, 64);

  // 그 링크가 profile.json을 잃으면 폴더를 붙잡고 있는 것은 링크이고, 안내가 그것을 되살린다.
  const company = rulesFolder(root, 'company-rules', { 'AGENTS.md': '# Company\n' }, { git: false });
  admin.ok(['profile', 'link', company, '--name', 'company', '--scope', 'company', '--yes']);
  fs.rmSync(path.join(company, 'profile.json'));
  const broken = admin.run(['profile', 'link', company, '--yes']);
  assert.equal(broken.status, 64);
  assert.match(broken.stderr, /already linked as profile company/);
  assert.match(broken.stderr, /profile remove company --yes/);
  assert.match(broken.stderr, /--name company --scope company/);
  assert.deepEqual(
    listed(admin).profiles.map((profile: { name: string }) => profile.name),
    ['team-rules']
  );
});

test('잠시 profile.json을 잃었던 링크는 같은 이름의 다른 폴더로 옮기지 않는다', t => {
  const { root, admin } = setup(t);
  const first = rulesFolder(root, 'a/foo', { 'AGENTS.md': '# A\n' }, { git: false });
  const second = rulesFolder(root, 'b/foo', { 'AGENTS.md': '# B\n' }, { git: false });
  admin.ok(['profile', 'link', first, '--yes']);
  fs.rmSync(path.join(first, 'profile.json'));

  const result = admin.run(['profile', 'link', second, '--yes']);

  assert.equal(result.status, 64);
  assert.equal(json(path.join(admin.home, 'profiles', 'foo', 'link.json')).path, first);
});

test('심볼릭 링크를 거친 경로는 안내에서 실제 저장소 루트를 가리킨다', { skip: noLinks }, t => {
  const { root, admin } = setup(t);
  const repo = rulesFolder(root, 'code/mono', { 'deep/rules/AGENTS.md': '# Rules\n' });
  fs.mkdirSync(path.join(root, 'elsewhere'));
  fs.symlinkSync(path.join(repo, 'deep', 'rules'), path.join(root, 'elsewhere', 'rules'));

  const result = admin.run(['profile', 'link', path.join(root, 'elsewhere', 'rules'), '--yes']);

  assert.equal(result.status, 64);
  assert.ok(
    result.stderr.includes(`agctx profile link ${fs.realpathSync(repo)} --instructions deep/rules/AGENTS.md`),
    result.stderr
  );
});

test('dotfiles 저장소로 쓰는 홈 폴더에 커밋된 폴더도 연결할 수 있다', t => {
  const { root, admin } = setup(t);
  const home = rulesFolder(root, 'user-home', { 'agent-config/AGENTS.md': '# Rules\n' });

  admin.ok(['profile', 'link', path.join(home, 'agent-config'), '--yes'], { HOME: home, USERPROFILE: home });
});

test('커밋이 없는 저장소 안의 폴더는 저장소 루트로 연결한다', t => {
  const { root, admin } = setup(t);
  const repo = rulesFolder(root, 'mono', { 'rules/AGENTS.md': '# Rules\n' }, { git: false });
  gitIn(repo, 'init', '--quiet');

  const result = admin.run(['profile', 'link', path.join(repo, 'rules'), '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /inside the Git repository/);
});

test('대소문자를 구분하지 않는 파일 시스템에서는 대소문자만 다르게 적은 같은 폴더가 같은 링크다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'Rules', { 'AGENTS.md': '# Rules\n' }, { git: false });
  if (!fs.existsSync(path.join(root, 'rules'))) return t.skip('this file system tells letter case apart');
  admin.ok(['profile', 'link', dir, '--name', 'rules', '--yes']);

  const again = admin.ok(['profile', 'link', path.join(root, 'rules'), '--yes']);

  assert.match(again.stdout, /already links/);
});

test('repos status는 끊긴 링크에 걸린 저장소에 repos sync가 아니라 링크를 되살리라고 안내한다', t => {
  const { root, admin, folder } = setup(t);
  const dir = rulesFolder(root, 'rules', { 'AGENTS.md': '# Rules\n' });
  admin.ok(['profile', 'link', dir, '--yes']);
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'rules', project, '--yes']);
  fs.renameSync(dir, path.join(root, 'moved'));

  const status = admin.run(['repos', 'status']);

  const output = status.stdout + status.stderr;
  assert.match(output, /behind/);
  assert.doesNotMatch(output, /repos sync/);
  assert.match(output, /profile remove rules --yes/);
});

test('폴더 밖으로 이어지는 규칙 파일의 안내는 같은 링크를 제안하지 않는다', { skip: noLinks }, t => {
  const { root, admin } = setup(t);
  rulesFolder(root, 'shared', { 'AGENTS.md': '# Shared\n' }, { git: false });
  const dir = rulesFolder(root, 'sub', { 'templates/.keep': '' }, { git: false });
  fs.symlinkSync(path.join(root, 'shared', 'AGENTS.md'), path.join(dir, 'templates', 'AGENTS.md'));

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /outside the folder/);
  assert.doesNotMatch(result.stderr, /--instructions templates\/AGENTS\.md/);
});

test('link가 동작하는 운영체제 링크 프로필을 만나면 그렇다고 알려 준다', { skip: noLinks }, t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(
    root,
    'foo',
    {
      'profile.json': JSON.stringify({ schemaVersion: 1, name: 'foo', scope: 'team' }) + '\n',
      'AGENTS.md': '# Rules\n'
    },
    { git: false }
  );
  fs.mkdirSync(path.join(admin.home, 'profiles'), { recursive: true });
  fs.symlinkSync(dir, path.join(admin.home, 'profiles', 'foo'));

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /operating system link/);
  assert.doesNotMatch(result.stderr, /is not a link/);
});

test('링크 기록은 마지막으로 본 profile.json을 따르므로, 잃은 profile.json에 대한 안내가 최신이다', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(
    root,
    'team-rules',
    { 'AGENTS.md': '# For contributors\n', 'templates/AGENTS.md': '# Team rules\n' },
    { git: false }
  );
  admin.ok(['profile', 'link', dir, '--yes']);
  const metadataFile = path.join(dir, 'profile.json');
  fs.writeFileSync(
    metadataFile,
    JSON.stringify({ ...json(metadataFile), schemaVersion: 2, scope: 'company', instructions: 'templates/AGENTS.md' }) +
      '\n'
  );

  assert.match(admin.ok(['profile', 'link', dir, '--yes']).stdout, /already links/);
  fs.rmSync(metadataFile);

  const view = admin.run(['profile', 'view', 'team-rules']);
  assert.ok(view.stderr.includes('--scope company --instructions templates/AGENTS.md'), view.stderr);
});

test('link는 agctx가 다른 프로필을 위해 쓴 루트 AGENTS.md를 규칙 파일로 가져가지 않는다', t => {
  const { root, admin, folder } = setup(t);
  admin.ok(['profile', 'create', 'base']);
  const dir = rulesFolder(root, 'rules', { 'templates/AGENTS.md': '# Team rules\n' }, { git: false });
  admin.ok(['profile', 'apply', 'base', dir, '--yes']);

  admin.ok(['profile', 'link', dir, '--yes']);

  assert.equal(json(path.join(dir, 'profile.json')).instructions, 'templates/AGENTS.md');
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'rules', project, '--yes']);
  assert.match(read(path.join(project, 'AGENTS.md')), /# Team rules/);
});

test('폴더의 유일한 AGENTS.md가 agctx가 다른 프로필을 위해 쓴 것이면 link가 그렇다고 알려 준다', t => {
  const { root, admin } = setup(t);
  admin.ok(['profile', 'create', 'base']);
  const dir = rulesFolder(root, 'applied', { 'README.md': '# Notes\n' }, { git: false });
  admin.ok(['profile', 'apply', 'base', dir, '--yes']);

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /agctx wrote when it applied a profile/);
});
