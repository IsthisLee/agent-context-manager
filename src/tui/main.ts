import { cancel, intro, note, outro, select } from '@clack/prompts';
import { help } from '../commands/help.ts';
import { saveLocale } from '../shared/home.ts';
import { _, getLocale, setLocale, t } from '../i18n/index.ts';
import type { Locale } from '../shared/types.ts';
import { cancelled } from './cancel.ts';
import { cloneProfileTui, createProfileTui, listProfiles, runTuiStep, setupProfileTui } from './profile.ts';
import { HANDLERS } from '../commands/handlers.ts';
import { say } from '../commands/output.ts';

/** Read-only status of every listed repository, with the next commands to run. */
async function showRepoStatus(): Promise<void> {
  const outcome = await HANDLERS['repos.status']({ positional: [], options: {}, raw: [] });
  for (const hint of outcome.warnings ?? []) say(hint);
}

export async function mainTui(): Promise<void> {
  intro(_('main.intro'));
  while (true) {
    const action = await select({
      message: _('main.message'),
      options: [
        { value: 'manage', label: _('main.manage.label'), hint: _('main.manage.hint') },
        { value: 'repos', label: _('main.repos.label'), hint: _('main.repos.hint') },
        { value: 'create', label: _('main.create.label'), hint: _('main.create.hint') },
        { value: 'clone', label: _('main.clone.label'), hint: _('main.clone.hint') },
        { value: 'setup', label: _('main.setup.label'), hint: _('main.setup.hint') },
        { value: 'lang', label: _('main.lang.label'), hint: _('main.lang.hint') },
        { value: 'help', label: _('main.help.label'), hint: _('main.help.hint') },
        { value: 'exit', label: _('main.exit.label') }
      ]
    });
    if (cancelled(action) || action === 'exit') break;
    if (action === 'manage') await runTuiStep(() => listProfiles());
    else if (action === 'repos') await runTuiStep(() => showRepoStatus());
    else if (action === 'create') await runTuiStep(() => createProfileTui());
    else if (action === 'clone') await runTuiStep(() => cloneProfileTui());
    else if (action === 'setup') await runTuiStep(() => setupProfileTui());
    else if (action === 'lang') await changeLocaleTui();
    else if (action === 'help') help();
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
