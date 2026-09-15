import { getInvokedAs } from './runtime.mjs';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './i18n/index.mjs';
import { SCOPES } from './profile/store.mjs';

export function help() {
  const title = getInvokedAs() === 'agt' ? 'agt (agentic)' : 'agentic (agt)';
  const commandName = getInvokedAs() === 'agt' ? 'agt' : 'agentic';
  console.log(`${title} shared project guidance manager\n\n  ${commandName} profile create [<name>] [--scope <scope>]\n  ${commandName} profile list [--scope <scope>]\n  ${commandName} profile view <name>\n  ${commandName} profile setup [<name>] [--tdd <level>] ...\n  ${commandName} profile apply <name> [--dry-run] <project>\n  ${commandName} profile sync [--dry-run] <project>\n  ${commandName} profile resolve [--dry-run] [--discard] [--edit] <project>\n  ${commandName} profile remove [<name>] [--yes]\n  ${commandName} config lang <ko|en>\n\nScopes: ${SCOPES.join(', ')}\nLanguage: ${SUPPORTED_LOCALES.join(', ')} (default ${DEFAULT_LOCALE}). Set with --lang, AGENTIC_LANG, or config lang; on first interactive run you are asked once and the choice is saved.\nUse either agentic or agt. Omit profile create, setup, or remove options to use interactive TUI prompts.`);
}
