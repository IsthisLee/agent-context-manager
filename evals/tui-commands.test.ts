import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS } from '../src/commands/registry.ts';
import { checkArguments } from '../src/commands/options.ts';
import { commandTokens, helpChoices } from '../src/tui/commands.ts';
import { MENU_ACTIONS } from '../src/tui/profile.ts';
import { PROJECT_MENU_COMMANDS, REPOS_MENU_COMMANDS, REPOSITORY_ACTIONS } from '../src/tui/repository.ts';

const spec = (id: string) => {
  const command = COMMANDS.find(entry => entry.id === id);
  assert.ok(command, `${id} is registered`);
  return command;
};

/** What the CLI would parse from the tokens a TUI answer stands for. */
const parsedFrom = (id: string, positional: string[], options: Record<string, string | boolean | null>) => {
  const parsed = checkArguments(spec(id), commandTokens(id, positional, options));
  return { positional: parsed.positional, options: parsed.options };
};

test('every repository command is reachable from a TUI menu that runs it', () => {
  const repositoryCommands = COMMANDS.filter(command => command.surface === 'repository').map(command => command.id);
  assert.deepEqual([...PROJECT_MENU_COMMANDS, ...REPOS_MENU_COMMANDS].map(command => command.id).sort(), [...repositoryCommands].sort());
  assert.deepEqual(PROJECT_MENU_COMMANDS.map(command => command.id), ['check', 'explain', 'verify']);
  assert.deepEqual(REPOS_MENU_COMMANDS.map(command => command.id), ['repos.list', 'repos.status', 'repos.sync', 'repos.pr']);
  assert.deepEqual(Object.keys(REPOSITORY_ACTIONS).sort(), [...repositoryCommands].sort());
});

test('TUI answers for project checks become the same arguments as the CLI options', () => {
  assert.deepEqual(parsedFrom('check', ['/work/shop'], { refresh: true }), { positional: ['/work/shop'], options: { refresh: true } });
  assert.deepEqual(parsedFrom('check', ['/work/shop'], { refresh: false }), { positional: ['/work/shop'], options: {} });
  assert.deepEqual(parsedFrom('explain', ['/work/shop/packages/web'], { agent: 'claude' }), { positional: ['/work/shop/packages/web'], options: { agent: 'claude' } });
  assert.deepEqual(parsedFrom('explain', ['/work/shop'], { agent: null }), { positional: ['/work/shop'], options: {} });
  assert.deepEqual(parsedFrom('verify', ['/work/shop'], { agent: 'codex', probe: true }), { positional: ['/work/shop'], options: { agent: 'codex', probe: true } });
});

test('TUI answers for repositories become the same arguments as the CLI options', () => {
  assert.deepEqual(parsedFrom('repos.list', [], { profile: 'team-backend', prune: true }), { positional: [], options: { profile: 'team-backend', prune: true } });
  assert.deepEqual(parsedFrom('repos.status', [], { profile: null, refresh: true }), { positional: [], options: { refresh: true } });
  assert.deepEqual(parsedFrom('repos.sync', [], { profile: 'team-backend' }), { positional: [], options: { profile: 'team-backend' } });
  assert.deepEqual(
    parsedFrom('repos.pr', [], { profile: 'team-backend', targets: '/work/targets.txt', base: 'develop', draft: true, message: 'chore: update guidance' }),
    { positional: [], options: { profile: 'team-backend', targets: '/work/targets.txt', base: 'develop', draft: true, message: 'chore: update guidance' } }
  );
  assert.deepEqual(parsedFrom('repos.pr', [], { profile: null, targets: null, base: '', draft: false, message: '' }), { positional: [], options: {} });
});

test('TUI answers for a Git branch become the same arguments as --branch', () => {
  assert.deepEqual(parsedFrom('profile.clone', ['git@example.com:acme/rules.git'], { branch: 'stable' }), { positional: ['git@example.com:acme/rules.git'], options: { branch: 'stable' } });
  assert.deepEqual(parsedFrom('profile.clone', ['git@example.com:acme/rules.git'], { branch: '' }), { positional: ['git@example.com:acme/rules.git'], options: {} });
  assert.deepEqual(parsedFrom('profile.connect', ['team-backend', 'git@example.com:acme/rules.git'], { branch: 'main' }), { positional: ['team-backend', 'git@example.com:acme/rules.git'], options: { branch: 'main' } });
});

test('the TUI Git status answer becomes the same arguments as --refresh', () => {
  assert.deepEqual(parsedFrom('profile.status', ['team-backend'], { refresh: true }), { positional: ['team-backend'], options: { refresh: true } });
  assert.deepEqual(parsedFrom('profile.status', ['team-backend'], { refresh: false }), { positional: ['team-backend'], options: {} });
  assert.match(MENU_ACTIONS['profile.status'].toString(), /runFromTui\('profile\.status'/);
});

test('a TUI answer cannot name an option the command does not take', () => {
  assert.throws(() => commandTokens('check', [], { agent: 'codex' }), /check has no --agent option/);
  assert.throws(() => commandTokens('explain', [], { agent: true }), /--agent needs a value/);
});

test('the help menu offers the overview and every registered command', () => {
  assert.deepEqual(helpChoices(), [null, ...COMMANDS.map(command => command.id)]);
});
