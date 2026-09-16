import fs from 'node:fs';
import path from 'node:path';
import { cancel, confirm, intro, note, outro, path as pathPrompt, select, text } from '@clack/prompts';
import { cancelled } from './cancel.ts';
import { HANDLERS } from '../commands/handlers.ts';
import { canPrompt, type ParsedArguments } from '../commands/options.ts';
import { COMMANDS } from '../commands/registry.ts';
import { _, getLocale, guidanceDescriptions, guidanceLabels, levelOptions, scopeOptions } from '../i18n/index.ts';
import { isJsonMode, say } from '../commands/output.ts';
import { resolveProject } from '../profile/resolve.ts';
import { GUIDANCE_KEYS, guidanceDefaults, setupProfile } from '../profile/setup.ts';
import { createProfile, getProfiles, isScope, readProfile, removeProfile, SCOPES, selectProfile } from '../profile/store.ts';
import { CliError, usageError } from '../shared/errors.ts';
import { isGitRoot } from '../shared/git.ts';
import { PROJECT_CONFIG_FILE, readProjectConfig } from '../profile/apply.ts';

const args = (positional: string[], options: ParsedArguments['options'] = {}): ParsedArguments => ({ positional, options, raw: [] });

/** Run one TUI step and show a failure as a note with the next command, instead of leaving the TUI. */
export async function runTuiStep(step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    note(error.hint ? `${error.message}\n\n${_('output.next')}: ${error.hint}` : error.message, _('output.error'));
  }
}

/**
 * Actions on one selected profile, in registry order. A profile command that
 * has a profile-menu entry appears here, so the menu cannot miss a command.
 */
export const PROFILE_MENU_COMMANDS = COMMANDS.filter(command => command.surface === 'profile' && command.profileMenu && !['profile.create', 'profile.list', 'profile.clone'].includes(command.id));

export async function createProfileTui(): Promise<void> {
  if (!process.stdin.isTTY) {
    const [name, scope = 'personal'] = fs.readFileSync(0, 'utf8').split(/\r?\n/).map(value => value.trim());
    if (!name) throw usageError('argument.missing', _('error.argument.missing', { usage: 'agctx profile create <name> [--scope <scope>]' }), _('hint.command.options', { command: 'profile create' }));
    createProfile(name, scope || 'personal');
    return;
  }
  intro(_('create.intro'));
  const name = await text({
    message: _('create.name.message'),
    placeholder: 'company-main',
    validate(value) {
      const trimmed = (value ?? '').trim();
      if (!trimmed || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(trimmed)) return _('create.name.invalid');
    }
  });
  if (cancelled(name)) return cancel(_('create.cancel'));
  const scope = await select({
    message: _('create.scope.message'),
    options: scopeOptions(getLocale())
  });
  if (cancelled(scope)) return cancel(_('create.cancel'));
  const selectedScope = scopeOptions(getLocale()).find(option => option.value === scope);
  note(`${name.trim()}\n${selectedScope?.label}: ${selectedScope?.hint}`, _('create.note.title'));
  const approved = await confirm({ message: _('create.confirm'), initialValue: true });
  if (cancelled(approved) || !approved) return cancel(_('create.cancel'));
  createProfile(name.trim(), scope);
  outro(_('create.outro'));
}

export async function cloneProfileTui(): Promise<void> {
  if (!process.stdin.isTTY) throw usageError('tui.required', _('error.tui.required', { command: 'profile clone' }), _('hint.tui.clone'));
  intro(_('clone.intro'));
  const url = await text({ message: _('clone.url.message'), placeholder: 'git@github.com:acme/agent-profile.git', validate: value => ((value ?? '').trim() ? undefined : _('clone.url.invalid')) });
  if (cancelled(url)) return cancel(_('clone.cancel'));
  await HANDLERS['profile.clone'](args([url.trim()]));
  outro(_('clone.outro'));
}

export async function listProfiles(scopeFilter: string | null = null): Promise<void> {
  if (scopeFilter !== null && !isScope(scopeFilter)) throw usageError('profile.invalid-scope', _('error.profile.invalid-scope', { scope: scopeFilter, scopes: SCOPES.join(', ') }), null);
  let profiles = getProfiles();
  if (scopeFilter) profiles = profiles.filter(profile => profile.scope === scopeFilter);
  const interactive = Boolean(process.stdout.isTTY && process.stdin.isTTY) && !isJsonMode();
  if (!profiles.length && !interactive) {
    say(scopeFilter ? _('list.empty.scope', { scope: scopeFilter }) : _('list.empty'));
    return;
  }
  const grouped = new Map<string, string[]>();
  for (const metadata of profiles) {
    const names = grouped.get(metadata.scope) ?? [];
    names.push(metadata.name);
    grouped.set(metadata.scope, names);
  }
  if (interactive) {
    intro(_('list.intro'));
    if (!scopeFilter && profiles.length) {
      const selectedScope = await select<string>({
        message: _('list.scope.message'),
        options: [
          { value: '__all__', label: _('list.scope.all'), hint: _('list.scope.allHint', { n: profiles.length }) },
          ...scopeOptions(getLocale()).filter(option => profiles.some(profile => profile.scope === option.value)).map(option => ({
            ...option,
            hint: _('list.scope.hint', { n: profiles.filter(profile => profile.scope === option.value).length, hint: option.hint })
          }))
        ]
      });
      if (cancelled(selectedScope)) return cancel(_('list.cancel'));
      if (selectedScope !== '__all__') return listProfiles(selectedScope);
    }
    for (const [scope, names] of grouped) note(names.join('\n'), scope);
    const selected = await select<string>({
      message: _('list.manage.message'),
      options: [
        { value: '__create__', label: _('list.create.label'), hint: _('main.create.hint') },
        { value: '__clone__', label: _('list.clone.label'), hint: _('main.clone.hint') },
        ...profiles.map(profile => ({
          value: profile.name,
          label: `${profile.scope} · ${profile.name}`,
          hint: _('list.manage.hint')
        }))
      ]
    });
    if (cancelled(selected)) return cancel(_('list.cancel'));
    if (selected === '__create__') return createProfileTui();
    if (selected === '__clone__') return cloneProfileTui();
    await profileActions(selected);
    return;
  }
  for (const [scope, names] of grouped) {
    say(`[${scope}]`);
    for (const name of names) say(`  ${name}`);
  }
}

export async function projectPathTui(message: string): Promise<string | null> {
  const target = await pathPrompt({
    message,
    root: process.cwd(),
    directory: true,
    initialValue: process.cwd(),
    validate(value) {
      const targetPath = path.resolve((value ?? '').trim() || '.');
      if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) return _('project.path.invalid');
    }
  });
  if (cancelled(target)) return null;
  return target.trim() || process.cwd();
}

/**
 * Whether the TUI apply flow asks to pin, and which answer it preselects. Only a Git profile can be pinned,
 * and a project that is already pinned keeps its pin unless the person chooses otherwise, so applying from
 * the menu never drops a pin silently.
 */
export function pinPrompt(name: string, targetDir: string): { ask: boolean; initial: boolean } {
  if (!isGitRoot(readProfile(name).profileDir)) return { ask: false, initial: false };
  return { ask: true, initial: readProjectConfig(path.join(targetDir, PROJECT_CONFIG_FILE)).pin === true };
}

/** What each profile-menu entry does. Keys are registry command ids. */
export const MENU_ACTIONS: Record<string, (name: string) => Promise<void>> = {
  'profile.setup': name => setupProfileTui(name),
  'profile.view': async name => {
    const profile = readProfile(name);
    note(`${profile.metadata.scope}\n\n${fs.readFileSync(profile.instructionsPath, 'utf8').trim()}`, name);
    outro(_('actions.view.outro'));
  },
  'profile.apply': async name => {
    const target = await projectPathTui(_('actions.apply.path'));
    if (!target) return cancel(_('actions.project.cancel'));
    const choice = pinPrompt(name, target);
    let pin = false;
    if (choice.ask) {
      const answer = await confirm({ message: _('actions.apply.pin'), initialValue: choice.initial });
      if (cancelled(answer)) return cancel(_('actions.project.cancel'));
      pin = answer;
    }
    await withConflictRecovery(target, () => HANDLERS['profile.apply'](args([name, target], pin ? { pin: true } : {})));
  },
  'profile.sync': async () => {
    const target = await projectPathTui(_('actions.sync.path'));
    if (!target) return cancel(_('actions.project.cancel'));
    await withConflictRecovery(target, () => HANDLERS['profile.sync'](args([target])));
  },
  'profile.resolve': () => resolveProjectTui(),
  'profile.remove': name => removeProfileTui(name),
  'profile.status': async name => {
    await HANDLERS['profile.status'](args([name], { refresh: true }));
  },
  'profile.pull': async name => {
    const preview = await HANDLERS['profile.pull'](args([name], { 'dry-run': true }));
    const commits = (preview.data as { commits?: string[] } | undefined)?.commits ?? [];
    if (!commits.length) return;
    const approved = await confirm({ message: _('confirm.pull', { name, count: commits.length }), initialValue: true });
    if (cancelled(approved) || !approved) return cancel(_('actions.project.cancel'));
    await HANDLERS['profile.pull'](args([name]));
  },
  'profile.push': async name => {
    await HANDLERS['profile.push'](args([name]));
  },
  'profile.connect': async name => {
    const url = await text({ message: _('connect.url.message'), placeholder: 'git@github.com:acme/agent-profile.git', validate: value => ((value ?? '').trim() ? undefined : _('clone.url.invalid')) });
    if (cancelled(url)) return cancel(_('actions.project.cancel'));
    await HANDLERS['profile.connect'](args([name, url.trim()]));
  }
};

export async function profileActions(name: string): Promise<void> {
  const action = await select<string>({
    message: _('actions.message', { name }),
    options: PROFILE_MENU_COMMANDS.map(command => ({ value: command.id, label: _(command.profileMenu as string), hint: _(`${(command.profileMenu as string).replace(/\.label$/, '')}.hint`) }))
  });
  if (cancelled(action)) return cancel(_('list.cancel'));
  await runTuiStep(() => MENU_ACTIONS[action](name));
}

/** Run apply or sync; when a managed area was edited, offer to resolve instead of leaving the user at an error. */
async function withConflictRecovery(target: string, step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch (error) {
    if (!(error instanceof CliError) || error.code !== 'project.conflict') throw error;
    note(`${error.message}\n\n${_('output.next')}: ${error.hint ?? ''}`, _('resolve.conflict.title'));
    const next = await confirm({ message: _('resolve.offer'), initialValue: true });
    if (cancelled(next) || !next) return cancel(_('actions.project.cancel'));
    await resolveProjectTui(target);
  }
}

/** Preview the conflicts of a project, then resolve them the way the user picks. */
export async function resolveProjectTui(target: string | null = null): Promise<void> {
  const project = target || await projectPathTui(_('resolve.path'));
  if (!project) return cancel(_('actions.project.cancel'));
  let preview: { conflicts: number } | null = null;
  try {
    preview = await resolveProject(project, { dryRun: true, discard: false, edit: false }, async () => false);
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    note(error.message, _('resolve.conflict.title'));
  }
  if (preview?.conflicts === 0) return outro(_('resolve.nothing'));
  const mode = await select<string>({
    message: _('resolve.mode.message'),
    options: [
      { value: 'auto', label: _('resolve.mode.auto'), hint: _('resolve.mode.auto.hint') },
      { value: 'edit', label: _('resolve.mode.edit'), hint: _('resolve.mode.edit.hint') },
      { value: 'discard', label: _('resolve.mode.discard'), hint: _('resolve.mode.discard.hint') }
    ]
  });
  if (cancelled(mode)) return cancel(_('actions.project.cancel'));
  await resolveProject(project, { dryRun: false, discard: mode === 'discard', edit: mode === 'edit' }, async () => true);
  outro(_('resolve.outro'));
}

export async function removeProfileTui(name: string | null = null): Promise<void> {
  if (!canPrompt()) throw usageError('confirm.required', _('error.confirm.required'), _('hint.confirm.yes', { command: `agctx profile remove ${name ?? '<name>'} --yes` }));
  intro(_('remove.intro'));
  const profiles = getProfiles();
  if (!profiles.length) throw usageError('profile.none', _('error.profile.none'), _('hint.profile.create'));
  if (!name) {
    const selected = await select<string>({
      message: _('remove.select'),
      options: profiles.map(profile => ({ value: profile.name, label: `${profile.scope} · ${profile.name}`, hint: _('remove.select.hint') }))
    });
    if (cancelled(selected)) return cancel(_('remove.cancel'));
    name = selected;
  }
  const profile = readProfile(name);
  note(_('remove.note.body', { scope: profile.metadata.scope, name }), _('remove.note.title'));
  const approved = await confirm({ message: _('remove.confirm'), initialValue: false });
  if (cancelled(approved) || !approved) return cancel(_('remove.cancel'));
  removeProfile(name);
  outro(_('remove.outro'));
}

export async function setupProfileTui(name: string | null = null): Promise<void> {
  if (!process.stdin.isTTY) {
    const answers = fs.readFileSync(0, 'utf8').split(/\r?\n/).map(value => value.trim());
    if (!name) name = selectProfile(answers.shift());
    const profile = readProfile(name);
    const values: string[] = [];
    for (const [index, key] of GUIDANCE_KEYS.entries()) {
      values.push(`--${key}`, answers[index] || profile.metadata.settings?.[key] || guidanceDefaults[key]);
    }
    setupProfile(name, values);
    return;
  }
  intro(_('setup.intro'));
  const labels = guidanceLabels(getLocale());
  const descriptions = guidanceDescriptions(getLocale());
  const levels = levelOptions(getLocale());
  const profiles = getProfiles();
  if (!name) {
    if (!profiles.length) throw usageError('profile.none', _('error.profile.none'), _('hint.profile.create'));
    const selected = await select<string>({
      message: _('setup.select'),
      options: profiles.map(profile => ({ value: profile.name, label: `${profile.scope} · ${profile.name}`, hint: _('setup.select.hint') }))
    });
    if (cancelled(selected)) return cancel(_('setup.cancel'));
    name = selected;
  }
  const profile = readProfile(name);
  const values: string[] = [];
  for (const key of GUIDANCE_KEYS) {
    const current = profile.metadata.settings?.[key] || guidanceDefaults[key];
    const value = await select({
      message: _('setup.item.message', { label: labels[key], description: descriptions[key] }),
      options: levels,
      initialValue: current
    });
    if (cancelled(value)) return cancel(_('setup.cancel'));
    values.push(`--${key}`, value);
  }
  const summary = GUIDANCE_KEYS
    .map(key => `${labels[key]}: ${values[values.indexOf(`--${key}`) + 1]}`)
    .join('\n');
  note(summary, _('setup.note.title', { name }));
  const approved = await confirm({ message: _('setup.confirm'), initialValue: true });
  if (cancelled(approved) || !approved) return cancel(_('setup.cancel'));
  setupProfile(name, values);
  outro(_('setup.outro'));
}
