import { confirm, isCancel } from '@clack/prompts';
import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { isJsonMode } from './output.ts';
import { GLOBAL_OPTIONS, type CommandSpec } from './registry.ts';

export interface ParsedArguments {
  /** 옵션 값을 뺀 위치 인자. 순서대로. */
  positional: string[];
  /** 옵션 값. 값이 없는 플래그는 true다. */
  options: Record<string, string | true>;
  /** 명령 단어 뒤의 원래 토큰. 아직 플래그를 직접 읽는 처리기가 쓴다. */
  raw: string[];
}

/**
 * 명령 단어 뒤의 토큰을 위치 인자와 옵션으로 나눈다. 명령이 받지 않는 옵션과 남는 위치 인자는
 * 거부한다.
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
      throw usageError(
        'option.unknown',
        _('error.option.unknown', { option: token, command: `agctx ${command.words.join(' ')}` }),
        command.misuseHint
          ? _(command.misuseHint)
          : close.length
            ? _('hint.option.suggest', { options: close.map(option => `--${option}`).join(', ') })
            : _('hint.command.options', { command: command.words.join(' ') })
      );
    }
    if (spec.value) {
      const value = inlineValue ?? tokens[index + 1];
      if (value === undefined || (inlineValue === undefined && value.startsWith('--'))) {
        throw usageError(
          'option.missing-value',
          _('error.option.missing-value', { option: `--${name}`, value: spec.value }),
          _('hint.command.options', { command: command.words.join(' ') })
        );
      }
      options[name] = value;
      if (inlineValue === undefined) index += 1;
    } else {
      options[name] = true;
    }
  }
  if (positional.length > command.args.length) {
    throw usageError(
      'argument.extra',
      _('error.argument.extra', {
        values: positional.slice(command.args.length).join(' '),
        command: `agctx ${command.words.join(' ')}`
      }),
      command.misuseHint ? _(command.misuseHint) : _('hint.command.options', { command: command.words.join(' ') })
    );
  }
  return { positional, options, raw: [...tokens] };
}

/** 프롬프트에는 터미널이 필요하고, --json 실행은 묻지 않는다. 스크립트와 에이전트가 stdout을 읽기 때문이다. */
export function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY) && !isJsonMode();
}

/**
 * 명령이 저장소를 바꾸거나 원격으로 보내기 전에 묻는다. 터미널에서는 사용자가 확인하고, 그 밖
 * (CI, 봇, 에이전트, --json)에서는 `--yes`가 있어야 한다. 사용자가 거절하면 false를 돌려준다.
 */
export async function confirmChange(parsed: ParsedArguments, question: string, retry: string): Promise<boolean> {
  if (parsed.options.yes === true) return true;
  if (!canPrompt()) {
    throw usageError('confirm.required', _('error.confirm.required'), _('hint.confirm.yes', { command: retry }));
  }
  const answer = await confirm({ message: question, initialValue: false });
  return !isCancel(answer) && answer === true;
}
