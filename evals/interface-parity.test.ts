import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS } from '../src/commands/registry.ts';
import { MAIN_ACTIONS, MAIN_MENU_ENTRIES } from '../src/tui/main.ts';
import { MENU_ACTIONS, PROFILE_MENU_COMMANDS } from '../src/tui/profile.ts';
import { PROJECT_MENU_COMMANDS, REPOS_MENU_COMMANDS } from '../src/tui/repository.ts';

test('every profile command is reachable from the CLI, the TUI, and the profile management menu', () => {
  const profileCommands = COMMANDS.filter(command => command.surface === 'profile');
  assert.ok(profileCommands.length > 0);
  for (const command of profileCommands) {
    assert.equal(command.words[0], 'profile', `${command.id} must be a profile CLI command`);
    assert.ok(command.tui, `${command.id} must name its TUI entry`);
    assert.ok(command.profileMenu, `${command.id} must name its profile management menu entry`);
  }
});

test('the profile management menu implements an action for every per-profile command', () => {
  assert.deepEqual(
    PROFILE_MENU_COMMANDS.map(command => command.id),
    ['profile.view', 'profile.setup', 'profile.apply', 'profile.sync', 'profile.resolve', 'profile.remove', 'profile.status', 'profile.pull', 'profile.push', 'profile.connect']
  );
  assert.deepEqual(Object.keys(MENU_ACTIONS).sort(), PROFILE_MENU_COMMANDS.map(command => command.id).sort());
});

test('every command names a TUI entry that a TUI menu shows', () => {
  const shown = new Set([
    ...MAIN_MENU_ENTRIES.map(entry => entry.label),
    ...PROFILE_MENU_COMMANDS.map(command => command.profileMenu),
    ...PROJECT_MENU_COMMANDS.map(command => command.tui),
    ...REPOS_MENU_COMMANDS.map(command => command.tui)
  ]);
  for (const command of COMMANDS) {
    assert.ok(command.tui, `${command.id} must name its TUI entry`);
    assert.ok(shown.has(command.tui), `${command.id}'s TUI entry ${command.tui} must appear in a TUI menu`);
  }
});

test('every main menu entry except exit runs an action', () => {
  assert.deepEqual(Object.keys(MAIN_ACTIONS).sort(), MAIN_MENU_ENTRIES.map(entry => entry.value).filter(value => value !== 'exit').sort());
});

test('repository commands declare the exit codes they return and stay out of the profile menu', () => {
  const repositoryCommands = COMMANDS.filter(command => command.surface === 'repository');
  assert.deepEqual(repositoryCommands.map(command => command.id), ['check', 'explain', 'verify', 'repos.list', 'repos.status', 'repos.sync', 'repos.pr']);
  for (const command of repositoryCommands) {
    assert.ok(command.exitCodes.includes(0), `${command.id} must declare success`);
    assert.equal(command.profileMenu, undefined, `${command.id} is not a profile menu action`);
  }
});

test('the registry covers the complete command set', () => {
  assert.deepEqual(
    COMMANDS.map(command => command.id),
    ['profile.create', 'profile.list', 'profile.view', 'profile.setup', 'profile.apply', 'profile.sync', 'profile.resolve', 'profile.remove', 'profile.clone', 'profile.status', 'profile.pull', 'profile.push', 'profile.connect', 'check', 'explain', 'verify', 'repos.list', 'repos.status', 'repos.sync', 'repos.pr', 'install', 'uninstall', 'config.lang', 'help']
  );
});
