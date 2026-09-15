/** agctx command line: resolve the locale, find the command in the registry, run it, and report the outcome. */

import { hasFlag, parseFlag, stripFlag } from './args.ts';
import { commandHelp, help } from './help.ts';
import { HANDLERS } from './handlers.ts';
import { checkArguments } from './options.ts';
import { COMMANDS, findCommand, suggestCommands, type CommandSpec } from './registry.ts';
import { envelope, isJsonMode, setJsonMode, warn, writeJson, type CommandOutcome } from './output.ts';
import { getSavedLocale, saveLocale } from '../shared/home.ts';
import { CliError, EXIT, usageError } from '../shared/errors.ts';
import { _, DEFAULT_LOCALE, resolveLocale, setLocale } from '../i18n/index.ts';
import { mainTui, promptLocale } from '../tui/main.ts';

async function resolveActiveLocale(langFlag: string | null | undefined): Promise<void> {
  let locale = resolveLocale({ flag: langFlag ?? null, env: process.env.AGCTX_LANG || null, saved: getSavedLocale(), isTTY: Boolean(process.stdin.isTTY) && !isJsonMode() });
  if (locale === null) {
    const chosen = await promptLocale();
    locale = chosen ? saveLocale(chosen) : DEFAULT_LOCALE;
  }
  setLocale(locale);
}

function unknownCommand(args: readonly string[]): CliError {
  const suggestions = suggestCommands(args).map(command => `agctx ${command.words.join(' ')}`);
  return usageError('command.unknown', _('error.command.unknown', { input: args.join(' ') }),
    suggestions.length ? _('hint.command.suggest', { commands: suggestions.join(', ') }) : _('hint.command.help'));
}

export interface Invocation {
  command: CommandSpec | null;
  outcome: CommandOutcome;
}

export async function main(argv: readonly string[] = process.argv): Promise<Invocation> {
  const rawArgs = argv.slice(2);
  setJsonMode(hasFlag(rawArgs, 'json'));
  const langFlag = parseFlag(rawArgs, 'lang');
  const args = stripFlag(stripFlag(rawArgs, 'lang'), 'json').filter(value => value !== '--json');
  await resolveActiveLocale(langFlag);

  if (!args.length || args[0] === '--tui') {
    if (process.stdin.isTTY && !isJsonMode()) await mainTui();
    else help();
    return { command: null, outcome: { exitCode: EXIT.ok } };
  }
  if (args[0] === 'help' || args[0] === '--help') {
    const target = findCommand(args.slice(1));
    if (args.length > 1 && !target) throw unknownCommand(args.slice(1));
    if (target) commandHelp(target);
    else help();
    return { command: target, outcome: { exitCode: EXIT.ok } };
  }

  const command = findCommand(args);
  if (!command) throw unknownCommand(args);
  const rest = args.slice(command.words.length);
  if (hasFlag(rest, 'help')) {
    commandHelp(command);
    return { command, outcome: { exitCode: EXIT.ok } };
  }
  const parsed = checkArguments(command, rest);
  const outcome = await HANDLERS[command.id](parsed);
  return { command, outcome };
}

/** Run the CLI: print or emit the outcome and set the process exit code. */
export async function run(argv: readonly string[] = process.argv): Promise<void> {
  let commandName = '';
  try {
    const { command, outcome } = await main(argv);
    commandName = command ? command.words.join(' ') : '';
    if (isJsonMode()) writeJson(envelope(commandName, outcome));
    else for (const warning of outcome.warnings ?? []) warn(warning);
    process.exitCode = outcome.exitCode;
  } catch (error) {
    const cliError = error instanceof CliError ? error : new CliError('internal', error instanceof Error ? error.message : String(error));
    if (!commandName) commandName = findCommand(argv.slice(2).filter(value => !value.startsWith('--')))?.words.join(' ') ?? '';
    if (isJsonMode()) {
      writeJson(envelope(commandName, { exitCode: cliError.exitCode }, cliError));
    } else {
      process.stderr.write(`${_('output.error')}: ${cliError.message}\n`);
      if (cliError.hint) process.stderr.write(`${_('output.next')}: ${cliError.hint}\n`);
    }
    process.exitCode = cliError.exitCode;
  }
}

export { COMMANDS };
