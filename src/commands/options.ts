import { confirm, isCancel } from '@clack/prompts';
import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { isJsonMode } from './output.ts';
import { GLOBAL_OPTIONS, type CommandSpec } from './registry.ts';

export interface ParsedArguments {
  /** Positional values in order, without option values. */
  positional: string[];
  /** Option values; flags without a value map to true. */
  options: Record<string, string | true>;
  /** The raw tokens after the command words, for handlers that still read flags directly. */
  raw: string[];
}

/**
 * Split the tokens after the command words into positional values and options,
 * rejecting options the command does not take and extra positional values.
 */
export function checkArguments(command: CommandSpec, tokens: readonly string[]): ParsedArguments {
  const known = new Map([...command.options, ...GLOBAL_OPTIONS].map(option => [option.name, option]));
  const positional: string[] = [];
  const options: Record<string, string | true> = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const [name, inlineValue] = token.slice(2).split('=', 2);
    const spec = known.get(name);
    if (!spec) {
      const close = [...known.keys()].filter(candidate => candidate.startsWith(name.slice(0, 3)));
      throw usageError('option.unknown', _('error.option.unknown', { option: token, command: `agctx ${command.words.join(' ')}` }),
        command.misuseHint ? _(command.misuseHint) : close.length ? _('hint.option.suggest', { options: close.map(option => `--${option}`).join(', ') }) : _('hint.command.options', { command: command.words.join(' ') }));
    }
    if (spec.value) {
      const value = inlineValue ?? tokens[index + 1];
      if (value === undefined || (inlineValue === undefined && value.startsWith('--'))) {
        throw usageError('option.missing-value', _('error.option.missing-value', { option: `--${name}`, value: spec.value }), _('hint.command.options', { command: command.words.join(' ') }));
      }
      options[name] = value;
      if (inlineValue === undefined) index += 1;
    } else {
      options[name] = true;
    }
  }
  if (positional.length > command.args.length) {
    throw usageError('argument.extra', _('error.argument.extra', { values: positional.slice(command.args.length).join(' '), command: `agctx ${command.words.join(' ')}` }), command.misuseHint ? _(command.misuseHint) : _('hint.command.options', { command: command.words.join(' ') }));
  }
  return { positional, options, raw: [...tokens] };
}

/** Prompts need a terminal, and a --json run never prompts: scripts and agents read its stdout. */
export function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY) && !isJsonMode();
}

/**
 * Ask before a command changes a repository or sends to a remote. In a terminal
 * the user confirms; elsewhere (CI, bots, agents, --json) `--yes` is required.
 * Returns false when the user declines.
 */
export async function confirmChange(parsed: ParsedArguments, question: string, retry: string): Promise<boolean> {
  if (parsed.options.yes === true) return true;
  if (!canPrompt()) {
    throw usageError('confirm.required', _('error.confirm.required'), _('hint.confirm.yes', { command: retry }));
  }
  const answer = await confirm({ message: question, initialValue: false });
  return !isCancel(answer) && answer === true;
}
