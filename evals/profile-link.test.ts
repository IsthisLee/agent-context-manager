import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { commitAndPush, fakeGh, gitIn, makeWorkspace, serviceRepo, type Person } from './support/git-workspace.ts';

/**
 * `profile link` turns a rules repository folder that already exists on this
 * machine into a profile: it writes profile.json there and leaves a pointer in
 * the store, so the folder is applied as it is, before anything is committed.
 */

const read = (file: string) => fs.readFileSync(file, 'utf8');
const json = (file: string) => JSON.parse(read(file));

/** A rules repository with the given files, committed once when `git` is true. */
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

test('link writes profile.json and a pointer for a repository whose rules sit in a subfolder, and apply uses them without a commit', t => {
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
  assert.deepEqual(
    fs.readdirSync(path.dirname(pointer('team-rules'))),
    ['link.json'],
    'the store keeps only the pointer'
  );
  const profiles = listed(admin).profiles;
  assert.deepEqual(
    profiles.map((profile: { name: string; link?: string }) => [profile.name, profile.link]),
    [['team-rules', dir]]
  );
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'team-rules', project, '--yes']);
  assert.match(read(path.join(project, 'AGENTS.md')), /^# Team rules/);
  assert.equal(gitIn(dir, 'rev-list', '--count', 'HEAD'), commits, 'link never commits');
});

test('link keeps a rules repository with AGENTS.md at its root on schema version 1', t => {
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

test('link does not guess between several rules files, and takes the one --instructions names', t => {
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

test('link reuses a profile.json that is already there, and refuses options that disagree with it', t => {
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
  assert.equal(read(path.join(dir, 'profile.json')), existing, 'an existing profile.json is not rewritten');
  assert.equal(json(pointer('shared-rules')).path, dir);
});

test('link --dry-run writes nothing, and outside a terminal it needs --yes', t => {
  const { root, admin, pointer } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);

  const dryRun = admin.ok(['profile', 'link', dir, '--dry-run']);
  assert.match(dryRun.stdout, /profile\.json/);
  const unconfirmed = admin.run(['profile', 'link', dir]);
  assert.equal(unconfirmed.status, 64);

  assert.equal(fs.existsSync(path.join(dir, 'profile.json')), false);
  assert.equal(fs.existsSync(pointer('team-rules')), false);
});

test('an edit in the linked folder applies at once, is recorded as uncommitted, and cannot be pinned', t => {
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

test('pull, push, and connect stop on a linked profile and leave the folder as it was', t => {
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
    assert.ok(result.stderr.includes(dir), `${args[1]} names the linked folder`);
  }

  assert.equal(gitIn(dir, 'rev-parse', 'HEAD'), head);
  assert.equal(read(path.join(dir, '.git', 'config')), config);
  const status = JSON.parse(admin.ok(['profile', 'status', 'team-rules', '--json']).stdout).data.profiles[0];
  assert.equal(status.link, dir);
});

test('remove deletes only the pointer and leaves the linked folder and its history', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);

  admin.ok(['profile', 'remove', 'team-rules', '--yes']);

  assert.equal(fs.existsSync(path.join(admin.home, 'profiles', 'team-rules')), false);
  assert.ok(fs.existsSync(path.join(dir, 'templates', 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(dir, 'profile.json')));
  assert.ok(fs.existsSync(path.join(dir, '.git', 'HEAD')));
});

test('a link whose folder moved is listed as broken, names the old path when used, and is linked again only after it is removed', t => {
  const { root, admin, folder, pointer } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);
  // Commit profile.json so the project records a clean version, and check has only the broken link to report.
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
  assert.ok(apply.stderr.includes(dir), 'the error names the folder the link points at');
  const checked = admin.run(['check', project]);
  assert.equal(checked.status, 0, checked.stderr);
  assert.ok(checked.stdout.includes(dir) || checked.stderr.includes(dir), 'check warns that the link is broken');

  const again = admin.run(['profile', 'link', moved, '--yes']);
  assert.equal(again.status, 64, 'a broken link is not pointed elsewhere by link');
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

test('link refuses a name that a cloned or created profile already has', t => {
  const { root, admin } = setup(t);
  admin.ok(['profile', 'create', 'team-rules']);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.equal(fs.existsSync(path.join(dir, 'profile.json')), false);
  assert.ok(
    fs.existsSync(path.join(admin.home, 'profiles', 'team-rules', 'AGENTS.md')),
    'the existing profile is untouched'
  );
});

test('a folder that is not a Git repository can be linked and applied, but not pinned', t => {
  const { root, admin, folder } = setup(t);
  const dir = rulesFolder(root, 'plain-rules', { 'AGENTS.md': '# Plain rules\n' }, { git: false });
  admin.ok(['profile', 'link', dir, '--yes']);
  const project = folder('orders-api');

  admin.ok(['profile', 'apply', 'plain-rules', project, '--yes']);

  assert.match(read(path.join(project, 'AGENTS.md')), /^# Plain rules/);
  assert.equal(admin.run(['profile', 'apply', 'plain-rules', project, '--pin', '--yes']).status, 64);
});

/** A linked Git folder one commit behind its remote, with profile.json committed. */
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

test('status on a linked profile neither fetches in that folder nor points at pull or push', t => {
  const { admin, dir } = linkedBehindRemote(t);
  const before = gitIn(dir, 'rev-parse', 'refs/remotes/origin/main');

  const result = admin.ok(['profile', 'status', 'team-rules', '--refresh']);

  assert.equal(gitIn(dir, 'rev-parse', 'refs/remotes/origin/main'), before, 'the linked folder is not fetched');
  assert.doesNotMatch(result.stdout, /agctx profile (pull|push)/);

  // Once the person fetches there, status sees the folder behind and still names git, not profile pull.
  gitIn(dir, 'fetch', '--quiet');
  const behind = JSON.parse(admin.ok(['profile', 'status', 'team-rules', '--json']).stdout).data.profiles[0];
  assert.equal(behind.behind, 1);
  assert.doesNotMatch(admin.ok(['profile', 'status', 'team-rules']).stdout, /agctx profile (pull|push)/);
});

test('repos status never tells a pinned project on a linked profile to run profile pull', t => {
  const { admin, folder, dir } = linkedBehindRemote(t);
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'team-rules', project, '--pin', '--yes']);
  gitIn(dir, 'pull', '--quiet');

  const result = admin.run(['repos', 'status']);

  assert.match(result.stdout + result.stderr, /behind/);
  assert.doesNotMatch(result.stdout + result.stderr, /agctx profile pull/);
});

test('a cloned profile whose repository has its own link.json stays a normal profile', t => {
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

test('a link whose folder lost its profile.json is listed as broken, names the folder, and can be removed', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);
  fs.rmSync(path.join(dir, 'profile.json'));

  const data = listed(admin);
  assert.deepEqual(data.profiles, []);
  assert.deepEqual(data.brokenLinks, [{ name: 'team-rules', path: dir, reason: 'missing-metadata' }]);
  const view = admin.run(['profile', 'view', 'team-rules']);
  assert.equal(view.status, 64);
  assert.ok(view.stderr.includes(dir), 'the error names the linked folder');

  admin.ok(['profile', 'remove', 'team-rules', '--yes']);
  assert.equal(fs.existsSync(path.join(admin.home, 'profiles', 'team-rules')), false);
  assert.ok(fs.existsSync(path.join(dir, 'templates', 'AGENTS.md')));
});

test('the hints on a linked profile never point at a command that a link refuses', t => {
  const { root, admin, folder } = setup(t);
  const metadata = JSON.stringify({ schemaVersion: 1, name: 'shared', scope: 'team' }) + '\n';
  const shared = rulesFolder(root, 'shared', { 'profile.json': metadata, 'AGENTS.md': '# Shared rules\n' });
  admin.ok(['profile', 'clone', shared]);
  const taken = admin.run(['profile', 'link', shared, '--yes']);
  assert.equal(taken.status, 64);
  assert.doesNotMatch(taken.stderr, /--name/, 'a folder with profile.json cannot take --name');

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

test('the hint for a linked folder that lost profile.json brings back the same profile', t => {
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

test('check warns instead of stopping on every kind of broken link', t => {
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

test('a linked folder whose rules file is gone is listed as broken and named when used', t => {
  const { root, admin, folder } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--yes']);
  fs.renameSync(path.join(dir, 'templates', 'AGENTS.md'), path.join(dir, 'templates', 'OLD.md'));

  assert.deepEqual(listed(admin).brokenLinks, [{ name: 'team-rules', path: dir, reason: 'missing-rules' }]);
  const apply = admin.run(['profile', 'apply', 'team-rules', folder('orders-api'), '--yes']);
  assert.equal(apply.status, 64);
  assert.ok(apply.stderr.includes('templates/AGENTS.md') && apply.stderr.includes(dir), apply.stderr);
});

test('a folder whose profile.json names a missing rules file is pointed at profile.json, not at --instructions', t => {
  const { root, admin } = setup(t);
  const metadata = JSON.stringify({ schemaVersion: 1, name: 'team-rules', scope: 'team' }) + '\n';
  const dir = rulesFolder(root, 'team-rules', { 'profile.json': metadata, 'templates/AGENTS.md': '# Team rules\n' });

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /profile\.json/);
  assert.doesNotMatch(result.stderr, /--instructions/);
});

test('repos pr lists the commits of a linked profile in the pull request body', t => {
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

test('a symbolic link named AGENTS.md is reported as a link and its target is suggested', { skip: noLinks }, t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', { 'CLAUDE.md': '# Rules\n' }, { git: false });
  fs.symlinkSync('CLAUDE.md', path.join(dir, 'AGENTS.md'));

  const refused = admin.run(['profile', 'link', dir, '--yes']);
  assert.equal(refused.status, 64);
  assert.match(refused.stderr, /symbolic link/i);
  assert.match(refused.stderr, /--instructions CLAUDE\.md/);

  admin.ok(['profile', 'link', dir, '--instructions', 'CLAUDE.md', '--yes']);
});

test('a folder inside a Git repository is linked through the repository root', t => {
  const { root, admin } = setup(t);
  const repo = rulesFolder(root, 'company-configs', {
    'agent-rules/AGENTS.md': '# Rules\n',
    'README.md': '# Configs\n'
  });

  const result = admin.run(['profile', 'link', path.join(repo, 'agent-rules'), '--yes']);

  assert.equal(result.status, 64);
  assert.ok(result.stderr.includes(repo), 'the hint names the repository root');
  assert.match(result.stderr, /--instructions agent-rules\/AGENTS\.md/);
});

test('status on a linked folder that is not a Git repository gives no Git advice', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'plain-rules', { 'AGENTS.md': '# Plain\n' }, { git: false });
  admin.ok(['profile', 'link', dir, '--yes']);

  const status = admin.ok(['profile', 'status', 'plain-rules']);

  assert.ok(status.stdout.includes(dir));
  assert.doesNotMatch(
    status.stdout,
    /pull and push with git|git -C/,
    'a folder outside Git gets no git commands to run'
  );
});

test('a store folder that is not a profile can be removed, as the link hint says', t => {
  const { root, admin } = setup(t);
  fs.mkdirSync(path.join(admin.home, 'profiles', 'ghost'), { recursive: true });
  const dir = rulesFolder(root, 'team-rules', subfolderRules);

  const taken = admin.run(['profile', 'link', dir, '--name', 'ghost', '--yes']);
  assert.equal(taken.status, 64);
  assert.match(taken.stderr, /profile remove ghost/);
  admin.ok(['profile', 'remove', 'ghost', '--yes']);
  admin.ok(['profile', 'link', dir, '--name', 'ghost', '--yes']);
});

test('a folder name that cannot name a profile points at --name with a name that can', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'TeamRules', { 'AGENTS.md': '# Rules\n' }, { git: false });

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /--name teamrules/);
});

test('the retry command for a path with spaces keeps the path in one piece', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team rules', { 'AGENTS.md': '# Rules\n' }, { git: false });

  const result = admin.run(['profile', 'link', dir, '--name', 'team-rules']);

  assert.equal(result.status, 64);
  assert.ok(result.stderr.includes(`"${dir}"`), result.stderr);
});

test('profile list --scope leaves broken links out of JSON as it does out of text', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  admin.ok(['profile', 'link', dir, '--scope', 'team', '--yes']);
  fs.rmSync(dir, { recursive: true, force: true });

  const scoped = JSON.parse(admin.ok(['profile', 'list', '--scope', 'team', '--json']).stdout).data;
  assert.deepEqual(scoped.brokenLinks, []);
  assert.equal(listed(admin).brokenLinks.length, 1);
});

test(
  'a store folder that is an operating system link to a moved folder is a broken link, and check does not stop on it',
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
    assert.ok(fs.existsSync(path.join(moved, 'AGENTS.md')), 'removing the link leaves the folder it pointed at');
    assert.deepEqual(fs.readdirSync(path.join(admin.home, 'profiles')), []);
    admin.ok(['profile', 'link', moved, '--yes']);
    assert.deepEqual(
      listed(admin).profiles.map((profile: { name: string; link?: string }) => [profile.name, profile.link]),
      [['sym', moved]]
    );
  }
);

test('link does not move a working link to another folder of the same name, even with --yes', t => {
  const { root, admin, folder } = setup(t);
  const first = rulesFolder(root, 'a/rules', { 'AGENTS.md': '# A rules\n' }, { git: false });
  const second = rulesFolder(root, 'b/rules', { 'AGENTS.md': '# B rules\n' }, { git: false });
  admin.ok(['profile', 'link', first, '--yes']);
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'rules', project, '--yes']);

  const refused = admin.run(['profile', 'link', second, '--yes']);

  assert.equal(refused.status, 64);
  assert.ok(refused.stderr.includes(first), 'the error names the folder the link keeps');
  assert.match(refused.stderr, /profile remove rules --yes/);
  assert.equal(json(path.join(admin.home, 'profiles', 'rules', 'link.json')).path, first);
  assert.ok(!fs.existsSync(path.join(second, 'profile.json')), 'nothing is written in the other folder');
  admin.ok(['profile', 'sync', project, '--yes']);
  assert.match(read(path.join(project, 'AGENTS.md')), /A rules/);
});

test('a link whose profile.json now names another profile says how to fix the name or drop the link', t => {
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

test('repos status shows that a repository uses a broken link', t => {
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

test('repos status tells a pinned project on a linked profile to bring that folder up to date and push it before opening pull requests', t => {
  const { admin, folder, dir } = linkedBehindRemote(t);
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'team-rules', project, '--pin', '--yes']);
  gitIn(dir, 'pull', '--quiet');

  const result = admin.run(['repos', 'status']);

  const output = result.stdout + result.stderr;
  assert.ok(output.includes(`git -C ${dir} pull`) && output.includes(`git -C ${dir} push`), output);
  assert.match(output, /agctx repos pr --profile team-rules/);
});

test('the hint for a link that lost profile.json names the scope and rules file it was linked with', t => {
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

test('a linked folder whose rules file became a folder is a broken link, not an I/O error', t => {
  const { root, admin, folder } = setup(t);
  const dir = rulesFolder(root, 'rules', { 'AGENTS.md': '# Rules\n' }, { git: false });
  admin.ok(['profile', 'link', dir, '--yes']);
  fs.rmSync(path.join(dir, 'AGENTS.md'));
  fs.mkdirSync(path.join(dir, 'AGENTS.md'));

  assert.deepEqual(listed(admin).brokenLinks, [{ name: 'rules', path: dir, reason: 'missing-rules' }]);
  const apply = admin.run(['profile', 'apply', 'rules', folder('orders-api'), '--yes']);
  assert.equal(apply.status, 64, apply.stderr);
});

test('a symbolic link named AGENTS.md in a subfolder is reported as a link, not as missing', { skip: noLinks }, t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'rules', { 'shared/RULES.md': '# Rules\n', 'sub/.keep': '' }, { git: false });
  fs.symlinkSync('../shared/RULES.md', path.join(dir, 'sub', 'AGENTS.md'));

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /symbolic link/i);
  assert.match(result.stderr, /--instructions shared\/RULES\.md/);
});

test('the hint for a folder inside a Git repository keeps the name and scope given and quotes its paths', t => {
  const { root, admin } = setup(t);
  const repo = rulesFolder(root, 'company-configs', { 'Team Rules/AGENTS.md': '# Rules\n' });

  const result = admin.run(['profile', 'link', path.join(repo, 'Team Rules'), '--scope', 'team', '--yes']);

  assert.equal(result.status, 64);
  assert.ok(result.stderr.includes('--instructions "Team Rules/AGENTS.md"'), result.stderr);
  assert.match(result.stderr, /--name team-rules/);
  assert.match(result.stderr, /--scope team/);
});

test('the hint for a rules file that is a symbolic link quotes a target path with spaces', { skip: noLinks }, t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'rules', { 'real dir/R.md': '# Rules\n' }, { git: false });
  fs.symlinkSync('real dir/R.md', path.join(dir, 'AGENTS.md'));

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.ok(result.stderr.includes('--instructions "real dir/R.md"'), result.stderr);
});

test('link refuses the home folder instead of searching all of it', t => {
  const { root, admin } = setup(t);
  const home = path.join(root, 'user-home');
  fs.mkdirSync(path.join(home, 'Documents', 'notes'), { recursive: true });

  const result = admin.run(['profile', 'link', home, '--yes'], { HOME: home, USERPROFILE: home });

  assert.equal(result.status, 64);
  assert.match(result.stderr, /home folder/);
});

test('a folder that Git does not track is linked even when a repository above it holds other files', t => {
  const { root, admin } = setup(t);
  const home = rulesFolder(root, 'user-home', { '.bashrc': '# shell\n' });
  const dir = path.join(home, 'work', 'rules');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Rules\n');

  admin.ok(['profile', 'link', dir, '--yes']);
});

test('a folder already linked under one name is not linked again under another', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'team-rules', { 'AGENTS.md': '# Rules\n' }, { git: false });
  admin.ok(['profile', 'link', dir, '--yes']);

  // A working link's folder holds profile.json, whose name the option cannot override.
  const healthy = admin.run(['profile', 'link', dir, '--name', 'other', '--yes']);
  assert.equal(healthy.status, 64);

  // Once that link lost its profile.json, it is the link that holds the folder, and the hint brings it back.
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

test('a link whose folder lost profile.json for a while is not moved to another folder of the same name', t => {
  const { root, admin } = setup(t);
  const first = rulesFolder(root, 'a/foo', { 'AGENTS.md': '# A\n' }, { git: false });
  const second = rulesFolder(root, 'b/foo', { 'AGENTS.md': '# B\n' }, { git: false });
  admin.ok(['profile', 'link', first, '--yes']);
  fs.rmSync(path.join(first, 'profile.json'));

  const result = admin.run(['profile', 'link', second, '--yes']);

  assert.equal(result.status, 64);
  assert.equal(json(path.join(admin.home, 'profiles', 'foo', 'link.json')).path, first);
});

test('a path through a symbolic link names the real repository root in the hint', { skip: noLinks }, t => {
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

test('a folder committed in a home folder kept as a dotfiles repository can be linked', t => {
  const { root, admin } = setup(t);
  const home = rulesFolder(root, 'user-home', { 'agent-config/AGENTS.md': '# Rules\n' });

  admin.ok(['profile', 'link', path.join(home, 'agent-config'), '--yes'], { HOME: home, USERPROFILE: home });
});

test('a folder inside a repository without commits is linked through the repository root', t => {
  const { root, admin } = setup(t);
  const repo = rulesFolder(root, 'mono', { 'rules/AGENTS.md': '# Rules\n' }, { git: false });
  gitIn(repo, 'init', '--quiet');

  const result = admin.run(['profile', 'link', path.join(repo, 'rules'), '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /inside the Git repository/);
});

test('the same folder written with other letter case is the same link on a case-insensitive file system', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'Rules', { 'AGENTS.md': '# Rules\n' }, { git: false });
  if (!fs.existsSync(path.join(root, 'rules'))) return t.skip('this file system tells letter case apart');
  admin.ok(['profile', 'link', dir, '--name', 'rules', '--yes']);

  const again = admin.ok(['profile', 'link', path.join(root, 'rules'), '--yes']);

  assert.match(again.stdout, /already links/);
});

test('repos status points a repository on a broken link at bringing the link back, not at repos sync', t => {
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

test(
  'the hint for a rules file that links outside the folder does not suggest that same link',
  { skip: noLinks },
  t => {
    const { root, admin } = setup(t);
    rulesFolder(root, 'shared', { 'AGENTS.md': '# Shared\n' }, { git: false });
    const dir = rulesFolder(root, 'sub', { 'templates/.keep': '' }, { git: false });
    fs.symlinkSync(path.join(root, 'shared', 'AGENTS.md'), path.join(dir, 'templates', 'AGENTS.md'));

    const result = admin.run(['profile', 'link', dir, '--yes']);

    assert.equal(result.status, 64);
    assert.match(result.stderr, /outside the folder/);
    assert.doesNotMatch(result.stderr, /--instructions templates\/AGENTS\.md/);
  }
);

test('a profile that is a working operating system link is named as one when link meets it', { skip: noLinks }, t => {
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

test('the link record follows the profile.json it last saw, so the hint for a lost profile.json is current', t => {
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

test('link does not take a root AGENTS.md that agctx wrote for another profile as the rules file', t => {
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

test('link says so when the only AGENTS.md in a folder is one agctx wrote for another profile', t => {
  const { root, admin } = setup(t);
  admin.ok(['profile', 'create', 'base']);
  const dir = rulesFolder(root, 'applied', { 'README.md': '# Notes\n' }, { git: false });
  admin.ok(['profile', 'apply', 'base', dir, '--yes']);

  const result = admin.run(['profile', 'link', dir, '--yes']);

  assert.equal(result.status, 64);
  assert.match(result.stderr, /agctx wrote when it applied a profile/);
});
