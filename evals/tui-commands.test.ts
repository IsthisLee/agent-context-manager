import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS } from '../src/commands/registry.ts';
import { checkArguments } from '../src/commands/options.ts';
import { commandTokens, helpChoices } from '../src/tui/commands.ts';
import { MENU_ACTIONS } from '../src/tui/profile.ts';
import { PROJECT_MENU_COMMANDS, REPOS_MENU_COMMANDS, REPOSITORY_ACTIONS } from '../src/tui/repository.ts';

const spec = (id: string) => {
  const command = COMMANDS.find(entry => entry.id === id);
  assert.ok(command, `${id}가 등록돼 있다`);
  return command;
};

/** TUI 답변이 나타내는 토큰에서 CLI가 해석할 내용. */
const parsedFrom = (id: string, positional: string[], options: Record<string, string | boolean | null>) => {
  const parsed = checkArguments(spec(id), commandTokens(id, positional, options));
  return { positional: parsed.positional, options: parsed.options };
};

test('모든 저장소 명령은 그것을 실행하는 TUI 메뉴에서 닿을 수 있다', () => {
  const repositoryCommands = COMMANDS.filter(command => command.surface === 'repository').map(command => command.id);
  assert.deepEqual(
    [...PROJECT_MENU_COMMANDS, ...REPOS_MENU_COMMANDS].map(command => command.id).sort(),
    [...repositoryCommands].sort()
  );
  assert.deepEqual(
    PROJECT_MENU_COMMANDS.map(command => command.id),
    ['check', 'explain', 'verify']
  );
  assert.deepEqual(
    REPOS_MENU_COMMANDS.map(command => command.id),
    ['repos.list', 'repos.status', 'repos.sync', 'repos.pr']
  );
  assert.deepEqual(Object.keys(REPOSITORY_ACTIONS).sort(), [...repositoryCommands].sort());
});

test('프로젝트 확인의 TUI 답변은 CLI 옵션과 같은 인자가 된다', () => {
  assert.deepEqual(parsedFrom('check', ['/work/shop'], { refresh: true }), {
    positional: ['/work/shop'],
    options: { refresh: true }
  });
  assert.deepEqual(parsedFrom('check', ['/work/shop'], { refresh: false }), {
    positional: ['/work/shop'],
    options: {}
  });
  assert.deepEqual(parsedFrom('explain', ['/work/shop/packages/web'], { agent: 'claude' }), {
    positional: ['/work/shop/packages/web'],
    options: { agent: 'claude' }
  });
  assert.deepEqual(parsedFrom('explain', ['/work/shop'], { agent: null }), { positional: ['/work/shop'], options: {} });
  assert.deepEqual(parsedFrom('verify', ['/work/shop'], { agent: 'codex', probe: true }), {
    positional: ['/work/shop'],
    options: { agent: 'codex', probe: true }
  });
});

test('저장소 메뉴의 TUI 답변은 CLI 옵션과 같은 인자가 된다', () => {
  assert.deepEqual(parsedFrom('repos.list', [], { profile: 'team-backend', prune: true }), {
    positional: [],
    options: { profile: 'team-backend', prune: true }
  });
  assert.deepEqual(parsedFrom('repos.status', [], { profile: null, refresh: true }), {
    positional: [],
    options: { refresh: true }
  });
  assert.deepEqual(parsedFrom('repos.sync', [], { profile: 'team-backend' }), {
    positional: [],
    options: { profile: 'team-backend' }
  });
  assert.deepEqual(
    parsedFrom('repos.pr', [], {
      profile: 'team-backend',
      targets: '/work/targets.txt',
      base: 'develop',
      draft: true,
      message: 'chore: update guidance'
    }),
    {
      positional: [],
      options: {
        profile: 'team-backend',
        targets: '/work/targets.txt',
        base: 'develop',
        draft: true,
        message: 'chore: update guidance'
      }
    }
  );
  assert.deepEqual(parsedFrom('repos.pr', [], { profile: null, targets: null, base: '', draft: false, message: '' }), {
    positional: [],
    options: {}
  });
});

test('Git 브랜치에 대한 TUI 답변은 --branch와 같은 인자가 된다', () => {
  assert.deepEqual(parsedFrom('profile.clone', ['git@example.com:acme/rules.git'], { branch: 'stable' }), {
    positional: ['git@example.com:acme/rules.git'],
    options: { branch: 'stable' }
  });
  assert.deepEqual(parsedFrom('profile.clone', ['git@example.com:acme/rules.git'], { branch: '' }), {
    positional: ['git@example.com:acme/rules.git'],
    options: {}
  });
  assert.deepEqual(
    parsedFrom('profile.connect', ['team-backend', 'git@example.com:acme/rules.git'], { branch: 'main' }),
    { positional: ['team-backend', 'git@example.com:acme/rules.git'], options: { branch: 'main' } }
  );
});

test('폴더 연결의 TUI 답변은 CLI 옵션과 같은 인자가 된다', () => {
  assert.deepEqual(
    parsedFrom('profile.link', ['/work/team-rules'], {
      name: 'team-rules',
      scope: 'team',
      instructions: 'templates/AGENTS.md'
    }),
    {
      positional: ['/work/team-rules'],
      options: { name: 'team-rules', scope: 'team', instructions: 'templates/AGENTS.md' }
    }
  );
  assert.deepEqual(parsedFrom('profile.link', ['/work/team-rules'], { name: null, scope: null, instructions: null }), {
    positional: ['/work/team-rules'],
    options: {}
  });
});

test('TUI의 Git 상태 답변은 --refresh와 같은 인자가 된다', () => {
  assert.deepEqual(parsedFrom('profile.status', ['team-backend'], { refresh: true }), {
    positional: ['team-backend'],
    options: { refresh: true }
  });
  assert.deepEqual(parsedFrom('profile.status', ['team-backend'], { refresh: false }), {
    positional: ['team-backend'],
    options: {}
  });
  assert.match(MENU_ACTIONS['profile.status'].toString(), /runFromTui\('profile\.status'/);
});

test('TUI 답변은 명령이 받지 않는 옵션을 지정할 수 없다', () => {
  assert.throws(() => commandTokens('check', [], { agent: 'codex' }), /check has no --agent option/);
  assert.throws(() => commandTokens('explain', [], { agent: true }), /--agent needs a value/);
});

test('도움말 메뉴는 개요와 등록된 모든 명령을 제공한다', () => {
  assert.deepEqual(helpChoices(), [null, ...COMMANDS.map(command => command.id)]);
});
