import { EXIT } from '../shared/errors.ts';

/**
 * agctx가 제공하는 모든 명령을 한곳에 둔다. 도움말 출력, `<command> --help`, 옵션 검사, 프로필 관리
 * 메뉴, 인터페이스 동등성 평가가 모두 이 목록을 읽으므로, 한 경로에만 있는 명령은 생길 수 없다.
 */

export interface OptionSpec {
  /** 대시를 뺀 플래그 이름. */
  name: string;
  /** 플래그가 값을 받을 때의 자리 표시. 예: `<scope>`. */
  value?: string;
}

/**
 * 모든 명령은 CLI와 TUI에서 닿을 수 있어야 한다. `profile` 명령은 한 프로필에 속하므로 프로필 관리
 * 메뉴에도 있어야 한다. `repository` 명령은 저장소나 CI에서 동작하고 `global` 명령은 도움말과
 * 언어 설정이라, 둘 다 프로필 메뉴에 두지 않는다.
 */
export type Surface = 'profile' | 'repository' | 'global';

/**
 * 명령이 바꿀 수 있는 것. 저장소를 바꾸거나 원격으로 보내는 명령은 실행 전에 묻는다.
 * `agent-skills`는 agctx install이 에이전트마다 사용자 폴더에 쓰는 스킬 폴더다.
 */
export type Changes = 'none' | 'profile-store' | 'repository' | 'remote' | 'agent-skills';

/**
 * 에이전트 표면이 명령을 제공하는 방식. 에이전트는 설명을 보고 스킬을 불러올지 정하므로, 정책이
 * 없는 명령은 들어갈 길이 없다.
 *
 * - `auto`: 에이전트가 스스로 실행해도 된다. 읽기만 한다.
 * - `ask`: 사용자가 이름으로 요청할 때만. agctx-author 스킬에 있고, 이 스킬은 모델이 스스로
 *   부르지 못하게 막는다.
 * - `never`: 어느 스킬도 제공하지 않는다. 사람이 CLI나 TUI에서 실행한다.
 */
export type AgentPolicy = 'auto' | 'ask' | 'never';

export interface CommandSpec {
  id: string;
  words: readonly string[];
  /** 사용법 순서의 위치 인자. */
  args: readonly string[];
  options: readonly OptionSpec[];
  exitCodes: readonly number[];
  surface: Surface;
  changes: Changes;
  /** 이 명령을 실행하는 TUI 항목의 메시지 키. 모든 명령에 하나씩 있어야 한다. */
  tui: string;
  /** 프로필 관리 메뉴에서 실행하는 동작의 메시지 키. 한 프로필에 작용하는 명령에 쓴다. */
  profileMenu?: string;
  /** 명령이 받지 않는 옵션이나 인자를 받았을 때 보여 줄 안내의 메시지 키. */
  misuseHint?: string;
  /**
   * `changes`에서 나오지 않는 에이전트 정책. 빼 두면 정책을 계산해서 정하므로, 새 명령이 에이전트
   * 표면에서 빠지는 일이 없다.
   */
  agent?: AgentPolicy;
}

/**
 * 아무것도 바꾸지 않는 명령은 에이전트가 시작해도 안전하다. 무언가를 쓰는 명령은 사용자가 요청할
 * 때까지 기다린다. 어느 스킬도 제공하면 안 되는 몇몇 명령은 `agent`가 이 규칙을 덮어쓴다.
 */
export function agentPolicy(command: CommandSpec): AgentPolicy {
  if (command.agent) return command.agent;
  return command.changes === 'none' ? 'auto' : 'ask';
}

const common = [EXIT.ok, EXIT.usage, EXIT.software];
const dryRun: OptionSpec = { name: 'dry-run' };
const yes: OptionSpec = { name: 'yes' };
const profileFilter: OptionSpec = { name: 'profile', value: '<name>' };

export const COMMANDS: readonly CommandSpec[] = [
  {
    id: 'profile.create',
    words: ['profile', 'create'],
    args: ['[<name>]'],
    options: [{ name: 'scope', value: '<scope>' }],
    exitCodes: common,
    surface: 'profile',
    changes: 'profile-store',
    tui: 'main.create.label',
    profileMenu: 'list.create.label'
  },
  {
    id: 'profile.list',
    words: ['profile', 'list'],
    args: [],
    options: [{ name: 'scope', value: '<scope>' }],
    exitCodes: common,
    surface: 'profile',
    changes: 'none',
    tui: 'main.manage.label',
    profileMenu: 'list.intro'
  },
  {
    id: 'profile.view',
    words: ['profile', 'view'],
    args: ['<name>'],
    options: [],
    exitCodes: common,
    surface: 'profile',
    changes: 'none',
    tui: 'actions.view.label',
    profileMenu: 'actions.view.label'
  },
  {
    id: 'profile.setup',
    words: ['profile', 'setup'],
    args: ['[<name>]'],
    options: [
      'workflow',
      'context',
      'tdd',
      'review',
      'verification',
      'instructions',
      'docs',
      'security',
      'untrusted',
      'language'
    ].map(name => ({ name, value: '<on|off>' })),
    exitCodes: common,
    surface: 'profile',
    changes: 'profile-store',
    tui: 'main.setup.label',
    profileMenu: 'actions.setup.label'
  },
  {
    id: 'profile.apply',
    words: ['profile', 'apply'],
    args: ['<name>', '[<project>]'],
    options: [
      dryRun,
      { name: 'agent', value: '<codex|claude|antigravity|all>' },
      { name: 'pin' },
      { name: 'adopt' },
      yes
    ],
    exitCodes: [...common, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable],
    surface: 'profile',
    changes: 'repository',
    tui: 'actions.apply.label',
    profileMenu: 'actions.apply.label'
  },
  {
    id: 'profile.sync',
    words: ['profile', 'sync'],
    args: ['[<project>]'],
    options: [dryRun, { name: 'adopt' }, yes],
    exitCodes: [...common, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable],
    surface: 'profile',
    changes: 'repository',
    tui: 'actions.sync.label',
    profileMenu: 'actions.sync.label',
    misuseHint: 'hint.sync.no-switch'
  },
  {
    id: 'profile.resolve',
    words: ['profile', 'resolve'],
    args: ['[<project>]'],
    options: [dryRun, { name: 'discard' }, { name: 'edit' }, { name: 'adopt' }, yes],
    exitCodes: [...common, EXIT.conflict, EXIT.unavailable],
    surface: 'profile',
    changes: 'repository',
    tui: 'actions.resolve.label',
    profileMenu: 'actions.resolve.label'
  },
  {
    id: 'profile.remove',
    words: ['profile', 'remove'],
    args: ['[<name>]'],
    options: [yes],
    exitCodes: common,
    surface: 'profile',
    changes: 'profile-store',
    tui: 'actions.remove.label',
    profileMenu: 'actions.remove.label',
    agent: 'never'
  },
  {
    id: 'profile.clone',
    words: ['profile', 'clone'],
    args: ['<git-url>'],
    options: [{ name: 'branch', value: '<branch>' }],
    exitCodes: [...common, EXIT.hiddenCharacters, EXIT.unavailable],
    surface: 'profile',
    changes: 'profile-store',
    tui: 'main.clone.label',
    profileMenu: 'list.clone.label'
  },
  {
    id: 'profile.link',
    words: ['profile', 'link'],
    args: ['[<path>]'],
    options: [
      { name: 'name', value: '<name>' },
      { name: 'scope', value: '<scope>' },
      { name: 'instructions', value: '<file>' },
      dryRun,
      yes
    ],
    exitCodes: common,
    surface: 'profile',
    changes: 'repository',
    tui: 'main.link.label',
    profileMenu: 'list.link.label'
  },
  {
    id: 'profile.status',
    words: ['profile', 'status'],
    args: ['[<name>]'],
    options: [{ name: 'refresh' }],
    exitCodes: [...common, EXIT.unavailable],
    surface: 'profile',
    changes: 'none',
    tui: 'actions.status.label',
    profileMenu: 'actions.status.label'
  },
  {
    id: 'profile.pull',
    words: ['profile', 'pull'],
    args: ['<name>'],
    options: [dryRun],
    exitCodes: [...common, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable],
    surface: 'profile',
    changes: 'profile-store',
    tui: 'actions.pull.label',
    profileMenu: 'actions.pull.label'
  },
  {
    id: 'profile.push',
    words: ['profile', 'push'],
    args: ['<name>'],
    options: [dryRun, yes],
    exitCodes: [...common, EXIT.conflict, EXIT.unavailable],
    surface: 'profile',
    changes: 'remote',
    tui: 'actions.push.label',
    profileMenu: 'actions.push.label'
  },
  {
    id: 'profile.connect',
    words: ['profile', 'connect'],
    args: ['<name>', '<git-url>'],
    options: [{ name: 'branch', value: '<branch>' }],
    exitCodes: [...common, EXIT.unavailable],
    surface: 'profile',
    changes: 'profile-store',
    tui: 'actions.connect.label',
    profileMenu: 'actions.connect.label'
  },
  {
    id: 'check',
    words: ['check'],
    args: ['[<project>]'],
    options: [{ name: 'refresh' }],
    exitCodes: [...common, EXIT.behind, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable],
    surface: 'repository',
    changes: 'none',
    tui: 'project.menu.check.label'
  },
  {
    id: 'explain',
    words: ['explain'],
    args: ['[<path>]'],
    options: [{ name: 'agent', value: '<codex|claude|antigravity|all>' }],
    exitCodes: [...common, EXIT.deliveryMissing],
    surface: 'repository',
    changes: 'none',
    tui: 'project.menu.explain.label'
  },
  {
    id: 'verify',
    words: ['verify'],
    args: ['[<path>]'],
    options: [{ name: 'agent', value: '<codex|claude|antigravity|all>' }, { name: 'probe' }, yes],
    exitCodes: [...common, EXIT.deliveryMissing, EXIT.unavailable],
    surface: 'repository',
    changes: 'none',
    tui: 'project.menu.verify.label'
  },
  {
    id: 'repos.list',
    words: ['repos', 'list'],
    args: [],
    options: [profileFilter, { name: 'prune' }],
    exitCodes: common,
    surface: 'repository',
    changes: 'profile-store',
    tui: 'repos.menu.list.label'
  },
  {
    id: 'repos.status',
    words: ['repos', 'status'],
    args: [],
    options: [profileFilter, { name: 'refresh' }],
    exitCodes: [...common, EXIT.behind, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable],
    surface: 'repository',
    changes: 'none',
    tui: 'repos.menu.status.label'
  },
  {
    id: 'repos.sync',
    words: ['repos', 'sync'],
    args: [],
    options: [profileFilter, dryRun, yes],
    exitCodes: [...common, EXIT.behind, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable],
    surface: 'repository',
    changes: 'repository',
    tui: 'repos.menu.sync.label'
  },
  {
    id: 'repos.pr',
    words: ['repos', 'pr'],
    args: [],
    options: [
      profileFilter,
      { name: 'targets', value: '<file>' },
      { name: 'base', value: '<branch>' },
      { name: 'draft' },
      { name: 'message', value: '<text>' },
      dryRun,
      yes
    ],
    exitCodes: [...common, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable],
    surface: 'repository',
    changes: 'remote',
    tui: 'repos.menu.pr.label'
  },
  {
    id: 'install',
    words: ['install'],
    args: [],
    options: [{ name: 'agent', value: '<claude|codex|antigravity|all>' }, { name: 'force' }, dryRun],
    exitCodes: common,
    surface: 'global',
    changes: 'agent-skills',
    tui: 'main.install.label',
    agent: 'never'
  },
  {
    id: 'uninstall',
    words: ['uninstall'],
    args: [],
    options: [{ name: 'agent', value: '<claude|codex|antigravity|all>' }, dryRun],
    exitCodes: common,
    surface: 'global',
    changes: 'agent-skills',
    tui: 'main.uninstall.label',
    agent: 'never'
  },
  {
    id: 'config.lang',
    words: ['config', 'lang'],
    args: ['<en|ko>'],
    options: [],
    exitCodes: common,
    surface: 'global',
    changes: 'none',
    tui: 'main.lang.label',
    agent: 'never'
  },
  {
    id: 'help',
    words: ['help'],
    args: ['[<command>]'],
    options: [],
    exitCodes: [EXIT.ok, EXIT.usage],
    surface: 'global',
    changes: 'none',
    tui: 'main.help.label',
    agent: 'never'
  }
];

/** 모든 명령이 받는 옵션. */
export const GLOBAL_OPTIONS: readonly OptionSpec[] = [
  { name: 'json' },
  { name: 'lang', value: '<en|ko>' },
  { name: 'help' }
];

export function usageLine(command: CommandSpec): string {
  const options = command.options.map(option => `[--${option.name}${option.value ? ` ${option.value}` : ''}]`);
  return ['agctx', ...command.words, ...options, ...command.args].join(' ');
}

/** 단어가 `argv`의 앞부분과 맞는 가장 긴 명령. 그래서 `profile apply x`는 `profile.apply`를 찾는다. */
export function findCommand(words: readonly string[]): CommandSpec | null {
  let best: CommandSpec | null = null;
  for (const command of COMMANDS) {
    if (
      command.words.every((word, index) => words[index] === word) &&
      (!best || command.words.length > best.words.length)
    )
      best = command;
  }
  return best;
}

/** 입력한 것과 이름이 가까운 명령. 「혹시 이것을 찾았나요」 안내에 쓴다. */
export function suggestCommands(words: readonly string[]): CommandSpec[] {
  const typed = words
    .filter(word => !word.startsWith('-'))
    .slice(0, 2)
    .join(' ');
  return COMMANDS.map(command => ({ command, distance: editDistance(typed, command.words.join(' ')) }))
    .filter(entry => entry.distance <= Math.max(2, Math.floor(typed.length / 4)))
    .sort((a, b) => a.distance - b.distance)
    .map(entry => entry.command)
    .slice(0, 3);
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}
