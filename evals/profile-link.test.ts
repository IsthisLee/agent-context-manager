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

  assert.deepEqual(listed(admin).brokenLinks, [{ name: 'team-rules', path: dir }]);
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
