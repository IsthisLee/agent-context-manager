import { cancel, intro, note, outro, select } from '@clack/prompts';
import { help } from '../commands/help.ts';
import { saveLocale } from '../shared/home.ts';
import { _, getLocale, setLocale, t } from '../i18n/index.ts';
import type { Locale } from '../shared/types.ts';
import { cancelled } from './cancel.ts';
import { createProfileTui, listProfiles, setupProfileTui } from './profile.ts';

export async function mainTui(): Promise<void> {
  intro(_('main.intro'));
  while (true) {
    const action = await select({
      message: _('main.message'),
      options: [
        { value: 'manage', label: _('main.manage.label'), hint: _('main.manage.hint') },
        { value: 'create', label: _('main.create.label'), hint: _('main.create.hint') },
        { value: 'setup', label: _('main.setup.label'), hint: _('main.setup.hint') },
        { value: 'lang', label: _('main.lang.label'), hint: _('main.lang.hint') },
        { value: 'help', label: _('main.help.label'), hint: _('main.help.hint') },
        { value: 'exit', label: _('main.exit.label') }
      ]
    });
    if (cancelled(action) || action === 'exit') break;
    if (action === 'manage') await listProfiles();
    else if (action === 'create') await createProfileTui();
    else if (action === 'setup') await setupProfileTui();
    else if (action === 'lang') await changeLocaleTui();
    else if (action === 'help') help();
  }
  outro(_('main.outro'));
}

export async function promptLocale(): Promise<Locale | null> {
  const selected = await select<Locale>({
    message: t(getLocale(), 'lang.prompt.message'),
    options: [
      { value: 'ko', label: '한국어 (Korean)' },
      { value: 'en', label: 'English (영어)' }
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
