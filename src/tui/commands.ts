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
 * TUI 답변이 나타내는 명령줄 토큰. TUI 메뉴는 이것을 CLI와 같은 옵션 검사와 처리기로 실행하므로,
 * 메뉴가 명령이 받지 않는 옵션을 넘길 수 없다. 답하지 않은 값(null, false, 빈 글)은 그 옵션을 뺀다.
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

/** TUI 답변으로 명령을 실행하고, 경고와, 성공하지 못했으면 종료 코드의 뜻을 보여 준다. */
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

/** 도움말 메뉴 항목. null은 개요이고, 나머지는 등록부 순서의 명령 id다. */
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
