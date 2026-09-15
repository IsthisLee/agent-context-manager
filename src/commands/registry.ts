import { EXIT } from '../shared/errors.ts';

/**
 * Every command agctx offers, in one place. Help output, `<command> --help`,
 * option checks, the profile management menu, and the interface-parity
 * evaluation all read this list, so a command cannot exist in one path only.
 */

export interface OptionSpec {
  /** Flag name without dashes. */
  name: string;
  /** Placeholder when the flag takes a value, for example `<scope>`. */
  value?: string;
}

/**
 * `profile` commands belong to a profile and must be reachable from the CLI,
 * the TUI, and the profile management menu. `repository` commands work on a
 * repository or CI and need the CLI only.
 */
export type Surface = 'profile' | 'repository' | 'global';

/** What a command may change; commands that change a repository or send to a remote ask before they act. */
export type Changes = 'none' | 'profile-store' | 'repository' | 'remote';

export interface CommandSpec {
  id: string;
  words: readonly string[];
  /** Positional arguments in usage order. */
  args: readonly string[];
  options: readonly OptionSpec[];
  exitCodes: readonly number[];
  surface: Surface;
  changes: Changes;
  /** Message key of the TUI entry that runs this command. */
  tui?: string;
  /** Message key of the action in the profile management menu, for commands that act on one profile. */
  profileMenu?: string;
  /** Message key of the hint shown when the command gets an option or argument it does not take. */
  misuseHint?: string;
}

const common = [EXIT.ok, EXIT.usage, EXIT.software];
const dryRun: OptionSpec = { name: 'dry-run' };
const yes: OptionSpec = { name: 'yes' };
const profileFilter: OptionSpec = { name: 'profile', value: '<name>' };

export const COMMANDS: readonly CommandSpec[] = [
  { id: 'profile.create', words: ['profile', 'create'], args: ['[<name>]'], options: [{ name: 'scope', value: '<scope>' }], exitCodes: common, surface: 'profile', changes: 'profile-store', tui: 'main.create.label', profileMenu: 'list.create.label' },
  { id: 'profile.list', words: ['profile', 'list'], args: [], options: [{ name: 'scope', value: '<scope>' }], exitCodes: common, surface: 'profile', changes: 'none', tui: 'main.manage.label', profileMenu: 'list.intro' },
  { id: 'profile.view', words: ['profile', 'view'], args: ['<name>'], options: [], exitCodes: common, surface: 'profile', changes: 'none', tui: 'actions.view.label', profileMenu: 'actions.view.label' },
  { id: 'profile.setup', words: ['profile', 'setup'], args: ['[<name>]'], options: ['workflow', 'tdd', 'review', 'verification', 'instructions', 'security'].map(name => ({ name, value: '<level>' })), exitCodes: common, surface: 'profile', changes: 'profile-store', tui: 'main.setup.label', profileMenu: 'actions.setup.label' },
  { id: 'profile.apply', words: ['profile', 'apply'], args: ['<name>', '[<project>]'], options: [dryRun, { name: 'pin' }, yes], exitCodes: [...common, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable], surface: 'profile', changes: 'repository', tui: 'actions.apply.label', profileMenu: 'actions.apply.label' },
  { id: 'profile.sync', words: ['profile', 'sync'], args: ['[<project>]'], options: [dryRun, yes], exitCodes: [...common, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable], surface: 'profile', changes: 'repository', tui: 'actions.sync.label', profileMenu: 'actions.sync.label', misuseHint: 'hint.sync.no-switch' },
  { id: 'profile.resolve', words: ['profile', 'resolve'], args: ['[<project>]'], options: [dryRun, { name: 'discard' }, { name: 'edit' }, yes], exitCodes: [...common, EXIT.conflict, EXIT.unavailable], surface: 'profile', changes: 'repository', tui: 'actions.resolve.label', profileMenu: 'actions.resolve.label' },
  { id: 'profile.remove', words: ['profile', 'remove'], args: ['[<name>]'], options: [yes], exitCodes: common, surface: 'profile', changes: 'profile-store', tui: 'actions.remove.label', profileMenu: 'actions.remove.label' },
  { id: 'profile.clone', words: ['profile', 'clone'], args: ['<git-url>'], options: [{ name: 'branch', value: '<branch>' }], exitCodes: [...common, EXIT.hiddenCharacters, EXIT.unavailable], surface: 'profile', changes: 'profile-store', tui: 'main.clone.label', profileMenu: 'list.clone.label' },
  { id: 'profile.status', words: ['profile', 'status'], args: ['[<name>]'], options: [{ name: 'refresh' }], exitCodes: [...common, EXIT.unavailable], surface: 'profile', changes: 'none', tui: 'actions.status.label', profileMenu: 'actions.status.label' },
  { id: 'profile.pull', words: ['profile', 'pull'], args: ['<name>'], options: [dryRun], exitCodes: [...common, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable], surface: 'profile', changes: 'profile-store', tui: 'actions.pull.label', profileMenu: 'actions.pull.label' },
  { id: 'profile.push', words: ['profile', 'push'], args: ['<name>'], options: [dryRun, yes], exitCodes: [...common, EXIT.conflict, EXIT.unavailable], surface: 'profile', changes: 'remote', tui: 'actions.push.label', profileMenu: 'actions.push.label' },
  { id: 'profile.connect', words: ['profile', 'connect'], args: ['<name>', '<git-url>'], options: [{ name: 'branch', value: '<branch>' }], exitCodes: [...common, EXIT.unavailable], surface: 'profile', changes: 'profile-store', tui: 'actions.connect.label', profileMenu: 'actions.connect.label' },
  { id: 'check', words: ['check'], args: ['[<project>]'], options: [{ name: 'refresh' }], exitCodes: [...common, EXIT.behind, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable], surface: 'repository', changes: 'none' },
  { id: 'explain', words: ['explain'], args: ['[<path>]'], options: [{ name: 'agent', value: '<codex|claude|antigravity|all>' }], exitCodes: [...common, EXIT.deliveryMissing], surface: 'repository', changes: 'none' },
  { id: 'verify', words: ['verify'], args: ['[<path>]'], options: [{ name: 'agent', value: '<codex|claude|antigravity|all>' }, { name: 'probe' }, yes], exitCodes: [...common, EXIT.deliveryMissing, EXIT.unavailable], surface: 'repository', changes: 'none' },
  { id: 'repos.list', words: ['repos', 'list'], args: [], options: [profileFilter, { name: 'prune' }], exitCodes: common, surface: 'repository', changes: 'profile-store' },
  { id: 'repos.status', words: ['repos', 'status'], args: [], options: [profileFilter, { name: 'refresh' }], exitCodes: [...common, EXIT.behind, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable], surface: 'repository', changes: 'none', tui: 'main.repos.label' },
  { id: 'repos.sync', words: ['repos', 'sync'], args: [], options: [profileFilter, dryRun, yes], exitCodes: [...common, EXIT.behind, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable], surface: 'repository', changes: 'repository' },
  { id: 'repos.pr', words: ['repos', 'pr'], args: [], options: [profileFilter, { name: 'targets', value: '<file>' }, { name: 'base', value: '<branch>' }, { name: 'draft' }, { name: 'message', value: '<text>' }, dryRun, yes], exitCodes: [...common, EXIT.conflict, EXIT.hiddenCharacters, EXIT.unavailable], surface: 'repository', changes: 'remote' },
  { id: 'config.lang', words: ['config', 'lang'], args: ['<en|ko>'], options: [], exitCodes: common, surface: 'global', changes: 'none', tui: 'main.lang.label' },
  { id: 'help', words: ['help'], args: ['[<command>]'], options: [], exitCodes: [EXIT.ok, EXIT.usage], surface: 'global', changes: 'none', tui: 'main.help.label' }
];

/** Options every command accepts. */
export const GLOBAL_OPTIONS: readonly OptionSpec[] = [{ name: 'json' }, { name: 'lang', value: '<en|ko>' }, { name: 'help' }];

export function usageLine(command: CommandSpec): string {
  const options = command.options.map(option => `[--${option.name}${option.value ? ` ${option.value}` : ''}]`);
  return ['agctx', ...command.words, ...options, ...command.args].join(' ');
}

/** The longest command whose words start `argv`, so `profile apply x` finds `profile.apply`. */
export function findCommand(words: readonly string[]): CommandSpec | null {
  let best: CommandSpec | null = null;
  for (const command of COMMANDS) {
    if (command.words.every((word, index) => words[index] === word) && (!best || command.words.length > best.words.length)) best = command;
  }
  return best;
}

/** Commands whose name is close to what was typed, for "did you mean" hints. */
export function suggestCommands(words: readonly string[]): CommandSpec[] {
  const typed = words.filter(word => !word.startsWith('-')).slice(0, 2).join(' ');
  return COMMANDS
    .map(command => ({ command, distance: editDistance(typed, command.words.join(' ')) }))
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
