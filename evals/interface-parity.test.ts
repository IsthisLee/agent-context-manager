import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS } from '../src/commands/registry.ts';
import { MAIN_ACTIONS, MAIN_MENU_ENTRIES } from '../src/tui/main.ts';
import { MENU_ACTIONS, PROFILE_MENU_COMMANDS } from '../src/tui/profile.ts';
import { PROJECT_MENU_COMMANDS, REPOS_MENU_COMMANDS } from '../src/tui/repository.ts';

test('모든 프로필 명령은 CLI, TUI, 프로필 관리 메뉴에서 닿을 수 있다', () => {
  const profileCommands = COMMANDS.filter(command => command.surface === 'profile');
  assert.ok(profileCommands.length > 0);
  for (const command of profileCommands) {
    assert.equal(command.words[0], 'profile', `${command.id}는 프로필 CLI 명령이어야 한다`);
    assert.ok(command.tui, `${command.id}는 TUI 항목을 지정해야 한다`);
    assert.ok(command.profileMenu, `${command.id}는 프로필 관리 메뉴 항목을 지정해야 한다`);
  }
});

test('프로필 관리 메뉴는 프로필마다 작용하는 명령 모두에 동작을 구현한다', () => {
  assert.deepEqual(
    PROFILE_MENU_COMMANDS.map(command => command.id),
    [
      'profile.view',
      'profile.setup',
      'profile.apply',
      'profile.sync',
      'profile.resolve',
      'profile.remove',
      'profile.status',
      'profile.pull',
      'profile.push',
      'profile.connect'
    ]
  );
  assert.deepEqual(Object.keys(MENU_ACTIONS).sort(), PROFILE_MENU_COMMANDS.map(command => command.id).sort());
});

test('모든 명령은 TUI 메뉴가 보여 주는 TUI 항목을 지정한다', () => {
  const shown = new Set([
    ...MAIN_MENU_ENTRIES.map(entry => entry.label),
    ...PROFILE_MENU_COMMANDS.map(command => command.profileMenu),
    ...PROJECT_MENU_COMMANDS.map(command => command.tui),
    ...REPOS_MENU_COMMANDS.map(command => command.tui)
  ]);
  for (const command of COMMANDS) {
    assert.ok(command.tui, `${command.id}는 TUI 항목을 지정해야 한다`);
    assert.ok(shown.has(command.tui), `${command.id}의 TUI 항목 ${command.tui}는 TUI 메뉴에 나와야 한다`);
  }
});

test('종료를 뺀 첫 화면 메뉴 항목은 모두 동작을 실행한다', () => {
  assert.deepEqual(
    Object.keys(MAIN_ACTIONS).sort(),
    MAIN_MENU_ENTRIES.map(entry => entry.value)
      .filter(value => value !== 'exit')
      .sort()
  );
});

test('저장소 명령은 돌려주는 종료 코드를 밝히고 프로필 메뉴에 들어가지 않는다', () => {
  const repositoryCommands = COMMANDS.filter(command => command.surface === 'repository');
  assert.deepEqual(
    repositoryCommands.map(command => command.id),
    ['check', 'explain', 'verify', 'repos.list', 'repos.status', 'repos.sync', 'repos.pr']
  );
  for (const command of repositoryCommands) {
    assert.ok(command.exitCodes.includes(0), `${command.id}는 success를 밝혀야 한다`);
    assert.equal(command.profileMenu, undefined, `${command.id}는 프로필 메뉴 동작이 아니다`);
  }
});

test('등록부는 명령 전체를 담는다', () => {
  assert.deepEqual(
    COMMANDS.map(command => command.id),
    [
      'profile.create',
      'profile.list',
      'profile.view',
      'profile.setup',
      'profile.apply',
      'profile.sync',
      'profile.resolve',
      'profile.remove',
      'profile.clone',
      'profile.link',
      'profile.status',
      'profile.pull',
      'profile.push',
      'profile.connect',
      'check',
      'explain',
      'verify',
      'repos.list',
      'repos.status',
      'repos.sync',
      'repos.pr',
      'install',
      'uninstall',
      'config.lang',
      'help'
    ]
  );
});
