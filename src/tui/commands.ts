import { note, select } from '@clack/prompts';
import { HANDLERS } from '../commands/handlers.ts';
import { commandHelp, help } from '../commands/help.ts';
import { checkArguments } from '../commands/options.ts';
import { say, type CommandOutcome } from '../commands/output.ts';
import { COMMANDS } from '../commands/registry.ts';
import { _ } from '../i18n/index.ts';
import { EXIT } from '../shared/errors.ts';
import { cancelled } from './cancel.ts';

type Answers = Readonly<Record<string, string | boolean | null | undefined>>;

function commandById(id: string) {
  const command = COMMANDS.find(entry => entry.id === id);
  if (!command) throw new Error(`Unknown command: ${id}`);
  return command;
}

/**
 * The command-line tokens that TUI answers stand for. A TUI menu runs these through the same
 * option check and handler as the CLI, so a menu cannot pass an option the command does not take.
 * Unanswered values (null, false, empty text) leave their option out.
 */
export function commandTokens(id: string, positional: readonly string[], answers: Answers): string[] {
  const command = commandById(id);
  const tokens = [...positional];
  for (const [name, value] of Object.entries(answers)) {
    const option = command.options.find(entry => entry.name === name);
    if (!option) throw new Error(`${id} has no --${name} option`);
    if (value === null || value === undefined || value === false || value === '') continue;
    if (option.value && typeof value !== 'string') throw new Error(`--${name} needs a value`);
    tokens.push(`--${name}`, ...(option.value ? [value as string] : []));
  }
  return tokens;
}

/** Run a command from TUI answers, then show its warnings and, when it did not succeed, what its exit code means. */
export async function runFromTui(id: string, positional: readonly string[], answers: Answers): Promise<CommandOutcome> {
  const outcome = await HANDLERS[id](checkArguments(commandById(id), commandTokens(id, positional, answers)));
  for (const warning of outcome.warnings ?? []) say(warning);
  if (outcome.exitCode !== EXIT.ok) {
    note(
      _('tui.result.body', { meaning: _(`exit.${outcome.exitCode}`), code: outcome.exitCode }),
      _('tui.result.title')
    );
  }
  return outcome;
}

/** Help menu entries: null is the overview, the rest are command ids in registry order. */
export function helpChoices(): (string | null)[] {
  return [null, ...COMMANDS.map(command => command.id)];
}

export async function helpTui(): Promise<void> {
  const selected = await select<string>({
    message: _('help.select.message'),
    maxItems: 12,
    options: helpChoices().map(id =>
      id === null
        ? { value: '__all__', label: _('help.select.all') }
        : { value: id, label: `agctx ${commandById(id).words.join(' ')}`, hint: _(`command.${id}.summary`) }
    )
  });
  if (cancelled(selected)) return;
  if (selected === '__all__') help();
  else commandHelp(commandById(selected));
}
