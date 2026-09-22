import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkLinkFolder, linkQuestion, MAX_FOLDERS, planLink, ruleFileChoices } from '../src/profile/link.ts';
import { brokenMenuOptions, linkNameStep, linkOutro, linkRuleOptions, menuFor, OTHER_RULES_FILE, removeChoices, removeNote, statusRefreshPrompt } from '../src/tui/profile.ts';
import { gitIn } from './support/git-workspace.ts';

/**
 * What the TUI decides around `profile link`, checked the way `evals/tui-pin.test.ts` checks the pin
 * question: each decision is a function, so it can be run without drawing a terminal screen.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'src', 'agctx.ts');

function workspace(t: TestContext) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-tui-link-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  fs.mkdirSync(home);
  const previousHome = process.env.AGCTX_HOME;
  process.env.AGCTX_HOME = home;
  t.after(() => {
    if (previousHome === undefined) delete process.env.AGCTX_HOME;
    else process.env.AGCTX_HOME = previousHome;
  });
  const env = { ...process.env, AGCTX_HOME: home, AGCTX_LANG: 'en' };
  const agctx = (...args: string[]) => {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}`);
  };
  const folder = (name: string, files: Record<string, string>) => {
    const dir = path.join(root, name);
    for (const [rel, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), content);
    }
    return dir;
  };
  return { root, agctx, folder };
}

test('the TUI offers the rules file link would take, the other AGENTS.md files, and a path of your own', t => {
  const { folder } = workspace(t);
  const root = folder('root-rules', { 'AGENTS.md': '# Root\n', 'docs/AGENTS.md': '# Docs\n' });
  const nested = folder('nested-rules', { 'templates/AGENTS.md': '# Nested\n' });
  const many = folder('many-rules', { 'backend/AGENTS.md': '# Backend\n', 'frontend/AGENTS.md': '# Frontend\n' });
  const none = folder('other-rules', { 'rules/CONVENTIONS.md': '# Conventions\n' });

  const values = (dir: string) => linkRuleOptions(dir).options.map(option => option.value);
  assert.deepEqual(values(root), ['AGENTS.md', 'docs/AGENTS.md', OTHER_RULES_FILE]);
  assert.equal(linkRuleOptions(root).initial, 'AGENTS.md');
  assert.deepEqual(values(nested), ['templates/AGENTS.md', OTHER_RULES_FILE]);
  assert.equal(linkRuleOptions(nested).initial, 'templates/AGENTS.md');
  assert.deepEqual(values(many), ['backend/AGENTS.md', 'frontend/AGENTS.md', OTHER_RULES_FILE]);
  assert.equal(linkRuleOptions(many).initial, undefined, 'several candidates leave the choice to the person');
  assert.deepEqual(values(none), [OTHER_RULES_FILE], 'a folder without AGENTS.md still gets a way to name its rules file');
});

test('the TUI ends a link with what happened: linked, already linked, declined, or failed', () => {
  assert.equal(linkOutro({ exitCode: 0, data: { written: true, link: 'create', metadata: 'create' } }), 'done');
  assert.equal(linkOutro({ exitCode: 0, data: { written: false, link: 'unchanged', metadata: 'keep' } }), 'unchanged');
  assert.equal(linkOutro({ exitCode: 0, data: { written: false, link: 'create', metadata: 'create' } }), 'declined');
  assert.equal(linkOutro({ exitCode: 64 }), 'failed');
});

test('a broken link picked in the TUI list opens its own menu, and removal lists every broken link', t => {
  const { agctx, folder, root } = workspace(t);
  const healthy = folder('healthy-rules', { 'AGENTS.md': '# Healthy\n' });
  const moved = folder('moved-rules', { 'AGENTS.md': '# Moved\n' });
  const emptied = folder('emptied-rules', { 'AGENTS.md': '# Emptied\n' });
  for (const dir of [healthy, moved, emptied]) agctx('profile', 'link', dir, '--yes');
  fs.renameSync(moved, path.join(root, 'elsewhere'));
  fs.rmSync(path.join(emptied, 'profile.json'));

  assert.equal(menuFor('healthy-rules'), 'profile');
  assert.equal(menuFor('moved-rules'), 'broken-link');
  assert.equal(menuFor('emptied-rules'), 'broken-link');
  assert.deepEqual(removeChoices().map(choice => choice.value).sort(), ['emptied-rules', 'healthy-rules', 'moved-rules']);
});

test('the TUI does not offer to fetch before showing the status of a linked profile', t => {
  const { agctx, folder } = workspace(t);
  agctx('profile', 'create', 'copied');
  agctx('profile', 'link', folder('linked-rules', { 'AGENTS.md': '# Linked\n' }), '--yes');

  assert.deepEqual(statusRefreshPrompt('linked-rules'), { ask: false });
  assert.deepEqual(statusRefreshPrompt('copied'), { ask: true });
});

test('moving a link that still works is refused, naming the folder it keeps; a broken link asks, naming its old folder', t => {
  const { agctx, folder, root } = workspace(t);
  const first = folder('a/rules', { 'AGENTS.md': '# First\n' });
  const second = folder('b/rules', { 'AGENTS.md': '# Second\n' });
  agctx('profile', 'link', first, '--yes');

  assert.throws(() => planLink(second), (error: Error) => error.message.includes(first));

  fs.renameSync(first, path.join(root, 'a', 'moved'));
  const plan = planLink(second);
  assert.equal(plan.link, 'relink');
  assert.ok(linkQuestion(plan).includes(first), 'the question names the folder being replaced');
  assert.ok(!linkQuestion(planLink(folder('c/fresh', { 'AGENTS.md': '# Fresh\n' }))).includes(first));
});

test('the TUI rules file list leaves out hidden, dependency, and build folders and very deep files', t => {
  const { folder } = workspace(t);
  const dir = folder('busy-rules', {
    'templates/AGENTS.md': '# Rules\n',
    'node_modules/pkg/AGENTS.md': '# Dependency\n',
    '.cache/AGENTS.md': '# Hidden\n',
    'dist/AGENTS.md': '# Build\n',
    'a/b/c/d/e/AGENTS.md': '# Deep\n'
  });

  assert.deepEqual(linkRuleOptions(dir).options.map(option => option.value), ['templates/AGENTS.md', OTHER_RULES_FILE]);
});

test('a link whose pointer cannot be read can be pointed at a folder again under the same name', t => {
  const { agctx, folder, root } = workspace(t);
  const dir = folder('company-rules', { 'AGENTS.md': '# Company\n' });
  agctx('profile', 'link', dir, '--name', 'company', '--yes');
  fs.writeFileSync(path.join(root, 'home', 'profiles', 'company', 'link.json'), 'not json\n');

  const plan = planLink(dir, { name: 'company' });

  assert.equal(plan.link, 'relink');
  assert.equal(plan.relinkFrom, null, 'an unreadable pointer names no folder it pointed at');
  assert.ok(!linkQuestion(plan).includes('link.json'), 'the question does not call the pointer file a linked folder');
});

test('linking a broken link again from its menu keeps its name instead of asking for one', () => {
  assert.deepEqual(linkNameStep('company', '/work/team-rules'), { ask: false, name: 'company' });
  assert.deepEqual(linkNameStep(null, '/work/team-rules'), { ask: true, name: 'team-rules' });
});

test('the TUI list decides which menu to open from the broken links it already read', t => {
  workspace(t);

  assert.equal(menuFor('ghost', [{ name: 'ghost', path: '/nowhere', reason: 'missing-folder' }]), 'broken-link');
  assert.equal(menuFor('ghost', []), 'profile');
});

test('the rules file search stops after a fixed number of folders and does not guess from a partial search', t => {
  const { folder } = workspace(t);
  const files: Record<string, string> = { 'zzz/AGENTS.md': '# Rules\n' };
  for (let index = 0; index < MAX_FOLDERS; index++) files[`d${String(index).padStart(4, '0')}/.keep`] = '';
  const dir = folder('huge-rules', files);

  assert.equal(ruleFileChoices(dir).complete, false);
  assert.throws(() => planLink(dir), { code: 'link.search-limit' });
});

test('the TUI can remove a store folder that is not a profile, and says what it is', t => {
  const { root } = workspace(t);
  fs.mkdirSync(path.join(root, 'home', 'profiles', 'leftover'), { recursive: true });
  fs.writeFileSync(path.join(root, 'home', 'profiles', 'leftover', 'AGENTS.md'), '# Old\n');

  assert.ok(removeChoices().some(choice => choice.value === 'leftover'));
  assert.match(removeNote('leftover'), /not a profile/);
});

test('the TUI offers a name that fits the naming rules when the folder name does not', () => {
  assert.deepEqual(linkNameStep(null, '/work/Team_Rules'), { ask: true, name: 'team-rules' });
});

test('a broken link whose profile.json names another profile offers only removal in the TUI', () => {
  assert.deepEqual(brokenMenuOptions('invalid-metadata').map(option => option.value), ['remove']);
  assert.deepEqual(brokenMenuOptions('missing-folder').map(option => option.value), ['link', 'remove']);
});

test('the TUI checks a folder before searching it for rules files', t => {
  const { root, folder } = workspace(t);
  const home = path.join(root, 'user-home');
  fs.mkdirSync(home);
  const previousHome = process.env.HOME;
  process.env.HOME = home;
  t.after(() => {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
  });
  const repo = folder('company-configs', { 'agent-rules/AGENTS.md': '# Rules\n' });
  gitIn(repo, 'init', '--quiet');
  gitIn(repo, 'add', '-A');
  gitIn(repo, 'commit', '--quiet', '-m', 'Add rules');

  assert.throws(() => checkLinkFolder(home), { code: 'link.home-folder' });
  assert.throws(() => checkLinkFolder(path.join(repo, 'agent-rules')), { code: 'link.inside-repository' });
  checkLinkFolder(repo);
});
