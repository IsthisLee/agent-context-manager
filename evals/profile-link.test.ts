import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gitIn, makeWorkspace, type Person } from './support/git-workspace.ts';

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

const subfolderRules = { 'docs/policy.md': '# Policy for people\n', 'templates/AGENTS.md': '# Team rules\n\n- Keep secrets out of commits.\n' };

function listed(admin: Person) {
  return JSON.parse(admin.ok(['profile', 'list', '--json']).stdout).data;
}

test('link writes profile.json and a pointer for a repository whose rules sit in a subfolder, and apply uses them without a commit', t => {
  const { root, admin, folder, pointer } = setup(t);
  const dir = rulesFolder(root, 'team-rules', subfolderRules);
  const commits = gitIn(dir, 'rev-list', '--count', 'HEAD');

  admin.ok(['profile', 'link', dir, '--yes']);

  const metadata = json(path.join(dir, 'profile.json'));
  assert.deepEqual([metadata.schemaVersion, metadata.name, metadata.scope, metadata.instructions], [2, 'team-rules', 'personal', 'templates/AGENTS.md']);
  assert.equal(json(pointer('team-rules')).path, dir);
  assert.deepEqual(fs.readdirSync(path.dirname(pointer('team-rules'))), ['link.json'], 'the store keeps only the pointer');
  const profiles = listed(admin).profiles;
  assert.deepEqual(profiles.map((profile: { name: string; link?: string }) => [profile.name, profile.link]), [['team-rules', dir]]);
  const project = folder('orders-api');
  admin.ok(['profile', 'apply', 'team-rules', project, '--yes']);
  assert.match(read(path.join(project, 'AGENTS.md')), /^# Team rules/);
  assert.equal(gitIn(dir, 'rev-list', '--count', 'HEAD'), commits, 'link never commits');
});

test('link keeps a rules repository with AGENTS.md at its root on schema version 1', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'root-rules', { 'AGENTS.md': '# Root rules\n', 'docs/AGENTS.md': '# Docs folder notes\n' });

  admin.ok(['profile', 'link', dir, '--yes']);

  const metadata = json(path.join(dir, 'profile.json'));
  assert.equal(metadata.schemaVersion, 1);
  assert.equal(metadata.instructions, undefined);
});

test('link does not guess between several rules files, and takes the one --instructions names', t => {
  const { root, admin } = setup(t);
  const dir = rulesFolder(root, 'many-rules', { 'backend/AGENTS.md': '# Backend\n', 'frontend/AGENTS.md': '# Frontend\n' });

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
  const existing = JSON.stringify({ schemaVersion: 2, name: 'shared-rules', scope: 'company', instructions: 'templates/AGENTS.md' }, null, 2) + '\n';
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

  for (const args of [['profile', 'pull', 'team-rules'], ['profile', 'push', 'team-rules', '--yes'], ['profile', 'connect', 'team-rules', 'https://example.com/acme/other.git']]) {
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

test('a link whose folder moved is listed as broken, names the old path when used, can be removed, and can point at the new place', t => {
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
  assert.ok(fs.existsSync(path.join(admin.home, 'profiles', 'team-rules', 'AGENTS.md')), 'the existing profile is untouched');
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
  const dir = rulesFolder(root, 'shared', { 'profile.json': metadata, 'AGENTS.md': '# Shared rules\n', 'link.json': '{"version":"1.0.0"}\n' });

  admin.ok(['profile', 'clone', dir]);

  const profiles = listed(admin).profiles;
  assert.deepEqual(profiles.map((profile: { name: string; link?: string }) => [profile.name, profile.link]), [['shared', undefined]]);
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
