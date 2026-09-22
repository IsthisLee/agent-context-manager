import { cancel, intro, note, outro, select } from '@clack/prompts';
import { saveLocale } from '../shared/home.ts';
import { _, getLocale, setLocale, t } from '../i18n/index.ts';
import type { Locale } from '../shared/types.ts';
import { cancelled } from './cancel.ts';
import { helpTui, runFromTui } from './commands.ts';
import { cloneProfileTui, createProfileTui, listProfiles, runTuiStep, setupProfileTui } from './profile.ts';
import { projectCheckTui, reposTui } from './repository.ts';
import { skillNotice } from '../skills/install.ts';

/**
 * The main menu, in display order. Labels and hints are message keys; a command's `tui` key in the registry
 * names one of these labels or an entry of a submenu, and the interface-parity evaluation checks that it does.
 */
export const MAIN_MENU_ENTRIES: readonly { value: string; label: string; hint?: string }[] = [
  { value: 'manage', label: 'main.manage.label', hint: 'main.manage.hint' },
  { value: 'project', label: 'main.project.label', hint: 'main.project.hint' },
  { value: 'repos', label: 'main.repos.label', hint: 'main.repos.hint' },
  { value: 'create', label: 'main.create.label', hint: 'main.create.hint' },
  { value: 'clone', label: 'main.clone.label', hint: 'main.clone.hint' },
  { value: 'setup', label: 'main.setup.label', hint: 'main.setup.hint' },
  { value: 'install', label: 'main.install.label', hint: 'main.install.hint' },
  { value: 'uninstall', label: 'main.uninstall.label', hint: 'main.uninstall.hint' },
  { value: 'lang', label: 'main.lang.label', hint: 'main.lang.hint' },
  { value: 'help', label: 'main.help.label', hint: 'main.help.hint' },
  { value: 'exit', label: 'main.exit.label' }
];

/** What each main menu entry runs. Exit ends the loop instead. */
export const MAIN_ACTIONS: Record<string, () => Promise<void>> = {
  manage: () => runTuiStep(() => listProfiles()),
  project: () => runTuiStep(() => projectCheckTui()),
  repos: () => runTuiStep(() => reposTui()),
  create: () => runTuiStep(() => createProfileTui()),
  clone: () => runTuiStep(() => cloneProfileTui()),
  setup: () => runTuiStep(() => setupProfileTui()),
  install: () => runTuiStep(async () => { await runFromTui('install', [], {}); }),
  uninstall: () => runTuiStep(async () => { await runFromTui('uninstall', [], {}); }),
  lang: () => changeLocaleTui(),
  help: () => helpTui()
};

export async function mainTui(): Promise<void> {
  intro(_('main.intro'));
  const notice = skillNotice();
  if (notice) note(notice, _('main.install.label'));
  while (true) {
    const action = await select({
      message: _('main.message'),
      options: MAIN_MENU_ENTRIES.map(entry => ({ value: entry.value, label: _(entry.label), ...(entry.hint ? { hint: _(entry.hint) } : {}) }))
    });
    if (cancelled(action) || action === 'exit') break;
    await MAIN_ACTIONS[action]();
  }
  outro(_('main.outro'));
}

export async function promptLocale(): Promise<Locale | null> {
  const selected = await select<Locale>({
    message: t(getLocale(), 'lang.prompt.message'),
    options: [
      { value: 'en', label: 'English (영어)' },
      { value: 'ko', label: '한국어 (Korean)' }
    ]
  });
  if (cancelled(selected)) return null;
  return selected;
}

export async function changeLocaleTui(): Promise<void> {
  const chosen = await promptLocale();
  if (!chosen) return cancel(_('lang.cancel'));
  const locale = setLocale(saveLocale(chosen));
  note(_('lang.saved', { locale }), _('main.lang.label'));
}
