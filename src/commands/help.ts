import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../i18n/index.ts';
import { SCOPES } from '../profile/store.ts';

const USAGE = [
  'agctx profile create [<name>] [--scope <scope>]',
  'agctx profile list [--scope <scope>]',
  'agctx profile view <name>',
  'agctx profile setup [<name>] [--tdd <level>] ...',
  'agctx profile apply <name> [--dry-run] <project>',
  'agctx profile sync [--dry-run] <project>',
  'agctx profile resolve [--dry-run] [--discard] [--edit] <project>',
  'agctx profile remove [<name>] [--yes]',
  'agctx config lang <ko|en>'
];

export function help(): void {
  console.log([
    'agctx (Agent Context Manager): a profile-based context manager for AI coding agents',
    '',
    ...USAGE.map(line => `  ${line}`),
    '',
    `Scopes: ${SCOPES.join(', ')}`,
    `Language: ${SUPPORTED_LOCALES.join(', ')} (default ${DEFAULT_LOCALE}). Set with --lang, AGCTX_LANG, or config lang; on first interactive run you are asked once and the choice is saved.`,
    'Omit profile create, setup, or remove options to use interactive TUI prompts.'
  ].join('\n'));
}
