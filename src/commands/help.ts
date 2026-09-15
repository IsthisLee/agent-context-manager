import { _, DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../i18n/index.ts';
import { SCOPES } from '../profile/store.ts';
import { say } from './output.ts';
import { COMMANDS, usageLine, type CommandSpec } from './registry.ts';

/** Every command with its usage line, read from the registry. */
export function help(): void {
  say([
    _('help.title'),
    '',
    ...COMMANDS.filter(command => command.id !== 'help').map(command => `  ${usageLine(command)}`),
    '',
    `${_('help.global')}: --json, --lang <${SUPPORTED_LOCALES.join('|')}>, --help`,
    _('help.scopes', { scopes: SCOPES.join(', ') }),
    _('help.language', { locales: SUPPORTED_LOCALES.join(', '), locale: DEFAULT_LOCALE }),
    _('help.more')
  ].join('\n'));
}

/** One command: usage, what it does, and the exit codes it can return. */
export function commandHelp(command: CommandSpec): void {
  say([
    `${_('help.usage')}: ${usageLine(command)}`,
    '',
    _(`command.${command.id}.summary`),
    '',
    `${_('help.exit-codes')}: ${command.exitCodes.map(code => `${code} ${_(`exit.${code}`)}`).join(', ')}`
  ].join('\n'));
}
