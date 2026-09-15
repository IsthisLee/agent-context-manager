/** Agentic guidance-profile and project manager. */

import { hasFlag, parseFlag, stripFlag } from './args.ts';
import { help } from './help.ts';
import { getSavedLocale, saveLocale } from '../shared/home.ts';
import { DEFAULT_LOCALE, resolveLocale, setLocale, SUPPORTED_LOCALES } from '../i18n/index.ts';
import { applyProfile, syncProject } from '../profile/apply.ts';
import { resolveProject } from '../profile/resolve.ts';
import { setupProfile } from '../profile/setup.ts';
import { createProfile, removeProfile, viewProfile } from '../profile/store.ts';
import { setInvokedAs } from '../shared/runtime.ts';
import { mainTui, promptLocale } from '../tui/main.ts';
import { createProfileTui, listProfiles, removeProfileTui, setupProfileTui } from '../tui/profile.ts';

function configLang(value: string | undefined): void {
  if (!value) throw new Error(`config lang requires a value. Use: config lang ${SUPPORTED_LOCALES.join('|')}.`);
  const saved = saveLocale(value);
  console.log(`Saved language preference: ${saved}`);
}

async function runProfileCommand(profileArgs: readonly string[]): Promise<void> {
  const sub = profileArgs[0];
  const rest = profileArgs.slice(1);
  if (sub === 'create') {
    const name = rest.find(value => !value.startsWith('--'));
    if (name) createProfile(name, parseFlag(rest, 'scope', 'personal'));
    else await createProfileTui();
  } else if (sub === 'list') {
    await listProfiles(parseFlag(rest, 'scope'));
  } else if (sub === 'view') {
    if (!rest[0]) throw new Error('profile view requires <name>.');
    viewProfile(rest[0]);
  } else if (sub === 'remove') {
    const name = rest.find(value => !value.startsWith('--')) || null;
    if (hasFlag(rest, 'yes')) {
      if (!name) throw new Error('profile remove --yes requires <name>.');
      removeProfile(name);
    } else await removeProfileTui(name);
  } else if (sub === 'setup') {
    const name = rest.find(value => !value.startsWith('--')) || null;
    const optionCount = rest.filter(value => value.startsWith('--')).length;
    if (optionCount <= 0) await setupProfileTui(name);
    else {
      if (!name) throw new Error('profile setup requires <name>.');
      setupProfile(name, rest);
    }
  } else if (sub === 'apply') {
    applyProfile(rest);
  } else if (sub === 'sync') {
    syncProject(rest);
  } else if (sub === 'resolve') {
    resolveProject(rest);
  } else {
    help();
  }
}

export async function main(argv: readonly string[] = process.argv): Promise<void> {
  setInvokedAs(argv[1]);
  const rawArgs = argv.slice(2);
  const langFlag = parseFlag(rawArgs, 'lang');
  const args = stripFlag(rawArgs, 'lang');
  const command = args[0] || 'help';
  let locale = resolveLocale({
    flag: langFlag,
    env: process.env.AGENTIC_LANG || null,
    saved: getSavedLocale(),
    isTTY: process.stdin.isTTY
  });
  if (locale === null) {
    const chosen = await promptLocale();
    locale = chosen ? saveLocale(chosen) : DEFAULT_LOCALE;
  }
  setLocale(locale);
  if ((!args.length || command === '--tui') && process.stdin.isTTY) {
    await mainTui();
  } else if (command === 'config' && args[1] === 'lang') {
    configLang(args[2]);
  } else if (command === 'profile') {
    await runProfileCommand(args.slice(1));
  } else {
    help();
  }
}

/** Run the CLI and turn an uncaught error into a one-line message and exit code 1. */
export function run(argv: readonly string[] = process.argv): Promise<void> {
  return main(argv).catch((error: unknown) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
