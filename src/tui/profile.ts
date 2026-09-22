import fs from 'node:fs';
import path from 'node:path';
import { cancel, confirm, intro, note, outro, path as pathPrompt, select, text } from '@clack/prompts';
import { cancelled } from './cancel.ts';
import { runFromTui } from './commands.ts';
import { canPrompt } from '../commands/options.ts';
import { COMMANDS } from '../commands/registry.ts';
import { _, getLocale, guidanceDescriptions, guidanceLabels, levelOptions, scopeOptions } from '../i18n/index.ts';
import { isJsonMode, say, type CommandOutcome } from '../commands/output.ts';
import { resolveProject } from '../profile/resolve.ts';
import { GUIDANCE_KEYS, guidanceDefaults, setupProfile } from '../profile/setup.ts';
import { createProfile, getProfiles, isInstructionsPath, isProfileName, isScope, profileLocation, readProfile, readStore, regularFileInside, removeProfile, SCOPES, selectProfile, type BrokenLink, type BrokenLinkReason, type StoreContents } from '../profile/store.ts';
import { checkLinkFolder, ruleFileChoices, suggestedName } from '../profile/link.ts';
import { PROFILE_METADATA_FILE } from '../shared/home.ts';
import { CliError, EXIT, usageError } from '../shared/errors.ts';
import { isGitRoot } from '../shared/git.ts';
import { PROJECT_CONFIG_FILE, readProjectConfig } from '../profile/apply.ts';

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
export const PROFILE_MENU_COMMANDS = COMMANDS.filter(command => command.surface === 'profile' && command.profileMenu && !['profile.create', 'profile.list', 'profile.clone', 'profile.link'].includes(command.id));

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
      if (!trimmed || !isProfileName(trimmed)) return _('create.name.invalid');
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
  const branch = await text({ message: _('clone.branch.message') });
  if (cancelled(branch)) return cancel(_('clone.cancel'));
  await runFromTui('profile.clone', [url.trim()], { branch: (branch ?? '').trim() });
  outro(_('clone.outro'));
}

/** The select value that asks for a rules file path instead of a listed AGENTS.md. */
export const OTHER_RULES_FILE = '__other__';

/**
 * The rules files the TUI offers for `dir`: every AGENTS.md that `profile link` finds, the one it would take by
 * itself first and preselected, and then a path of the person's own, so any rules file can be chosen as with
 * `--instructions`.
 */
export function linkRuleOptions(dir: string): { options: { value: string; label: string }[]; initial?: string } {
  const { detected, candidates } = ruleFileChoices(dir);
  const ordered = detected ? [detected, ...candidates.filter(file => file !== detected)] : candidates;
  return {
    options: [...ordered.map(file => ({ value: file, label: file })), { value: OTHER_RULES_FILE, label: _('link.rules.other') }],
    ...(detected ? { initial: detected } : {})
  };
}

/** How a TUI link ended, read from what the command returned: linked, nothing to change, declined, or failed. */
export function linkOutro(outcome: CommandOutcome): 'done' | 'unchanged' | 'declined' | 'failed' {
  if (outcome.exitCode !== EXIT.ok) return 'failed';
  const data = (outcome.data ?? {}) as { written?: boolean; link?: string; metadata?: string };
  if (data.written) return 'done';
  return data.link === 'unchanged' && data.metadata === 'keep' ? 'unchanged' : 'declined';
}

/**
 * Whether the TUI asks for the profile name when linking `dir`, and the name it uses or offers. Linking a broken
 * link again keeps that link's name, so the same profile comes back instead of a new one named after the folder.
 */
export function linkNameStep(name: string | null, dir: string): { ask: boolean; name: string } {
  return name ? { ask: false, name } : { ask: true, name: suggestedName(path.basename(dir)) ?? path.basename(dir) };
}

/**
 * Ask for a rules repository folder and link it as a profile. The folder's own profile.json decides the name,
 * scope, and rules file when it has one; otherwise the person picks them. `name` is given when a broken link is
 * linked again. The command shows the plan and asks before writing, and the TUI ends with what actually happened.
 */
export async function linkProfileTui(options: { name?: string | null } = {}): Promise<void> {
  if (!process.stdin.isTTY) throw usageError('tui.required', _('error.tui.required', { command: 'profile link' }), _('hint.tui.link'));
  intro(_('link.intro'));
  const chosen = await projectPathTui(_('link.path.message'));
  if (!chosen) return cancel(_('link.cancel'));
  // The folder is checked before it is searched for rules files, so the home folder or a folder inside a
  // repository stops with its hint instead of being read.
  const dir = checkLinkFolder(chosen, { name: options.name ?? null });
  const nameStep = linkNameStep(options.name ?? null, dir);
  const answers: Record<string, string | null> = { name: nameStep.ask ? null : nameStep.name, scope: null, instructions: null };
  if (!fs.existsSync(path.join(dir, PROFILE_METADATA_FILE))) {
    const rules = linkRuleOptions(dir);
    let instructions: string | symbol = OTHER_RULES_FILE;
    if (rules.options.length > 1) {
      instructions = await select<string>({ message: _('link.rules.message'), options: rules.options, ...(rules.initial ? { initialValue: rules.initial } : {}) });
      if (cancelled(instructions)) return cancel(_('link.cancel'));
    }
    if (instructions === OTHER_RULES_FILE) {
      const typed = await text({
        message: _('link.rules.path.message'),
        placeholder: 'rules/AGENTS.md',
        validate(value) {
          const file = (value ?? '').trim();
          if (!isInstructionsPath(file) || !regularFileInside(dir, file)) return _('link.rules.path.invalid');
        }
      });
      if (cancelled(typed)) return cancel(_('link.cancel'));
      instructions = typed.trim();
    }
    if (nameStep.ask) {
      const name = await text({
        message: _('link.name.message'),
        initialValue: nameStep.name,
        validate(value) {
          if (!isProfileName((value ?? '').trim())) return _('create.name.invalid');
        }
      });
      if (cancelled(name)) return cancel(_('link.cancel'));
      answers.name = name.trim();
    }
    const scope = await select({ message: _('create.scope.message'), options: scopeOptions(getLocale()) });
    if (cancelled(scope)) return cancel(_('link.cancel'));
    answers.instructions = instructions as string;
    answers.scope = scope;
  }
  const result = linkOutro(await runFromTui('profile.link', [dir], answers));
  if (result === 'done') outro(_('link.outro'));
  else if (result === 'unchanged') outro(_('link.outro.unchanged'));
  else if (result === 'declined') cancel(_('link.cancel'));
}

function brokenLabel(link: BrokenLink): string {
  return _('list.broken', { name: link.name, path: link.path, reason: _(`list.broken.${link.reason}`) });
}

/**
 * Which menu a profile picked in the TUI list opens: its actions, or the two things a broken link allows. The list
 * passes the broken links it already read.
 */
export function menuFor(name: string, broken: readonly BrokenLink[] = readStore().brokenLinks): 'profile' | 'broken-link' {
  return broken.some(link => link.name === name) ? 'broken-link' : 'profile';
}

/**
 * What the TUI offers for a broken link: link it again under the same name, or remove it. A link whose profile.json
 * names another profile cannot be linked again under this name until that file is fixed, so it offers removal only.
 */
export function brokenMenuOptions(reason: BrokenLinkReason): { value: string; label: string; hint: string }[] {
  return [
    ...(reason === 'invalid-metadata' ? [] : [{ value: 'link', label: _('broken.menu.link'), hint: _('broken.menu.link.hint') }]),
    { value: 'remove', label: _('broken.menu.remove'), hint: _('broken.menu.remove.hint') }
  ];
}

async function brokenLinkTui(name: string, broken: readonly BrokenLink[]): Promise<void> {
  const link = broken.find(entry => entry.name === name);
  if (link?.reason === 'invalid-metadata') note(_('broken.menu.invalid-metadata', { name, file: path.join(link.path, PROFILE_METADATA_FILE) }), _('list.broken.title'));
  const action = await select<string>({
    message: _('broken.menu.message', { name, path: link?.path ?? '' }),
    options: brokenMenuOptions(link?.reason ?? 'missing-folder')
  });
  if (cancelled(action)) return cancel(_('list.cancel'));
  if (action === 'link') return linkProfileTui({ name });
  return removeProfileTui(name);
}

/**
 * Every store entry the TUI can remove: profiles, broken links, and folders that are not a profile, so a link that
 * stopped working or a folder left behind can still be cleared.
 */
export function removeChoices(): { value: string; label: string; hint: string }[] {
  const store = readStore();
  return [
    ...store.profiles.map(profile => ({ value: profile.name, label: `${profile.scope} · ${profile.name}`, hint: _('remove.select.hint') })),
    ...store.brokenLinks.map(link => ({ value: link.name, label: brokenLabel(link), hint: _('remove.select.hint') })),
    ...store.unreadable.map(name => ({ value: name, label: _('remove.unreadable', { name }), hint: _('remove.select.hint') }))
  ];
}

/**
 * What the TUI says before removing `name`: a link leaves the folder it points at, a profile goes with its scope,
 * and a store folder that is not a profile is named as such.
 */
export function removeNote(name: string): string {
  const location = profileLocation(name);
  if (location?.link) return _('remove.note.link', { name, path: location.link });
  if (location?.metadata) return _('remove.note.body', { scope: location.metadata.scope, name });
  return _('remove.note.unreadable', { name, path: location?.dir ?? name });
}

/** Whether the TUI asks to fetch before showing a profile's Git status. A linked folder is the person's own and is not fetched. */
export function statusRefreshPrompt(name: string): { ask: boolean } {
  return { ask: !profileLocation(name)?.link };
}

export async function listProfiles(scopeFilter: string | null = null, store: StoreContents = readStore()): Promise<void> {
  if (scopeFilter !== null && !isScope(scopeFilter)) throw usageError('profile.invalid-scope', _('error.profile.invalid-scope', { scope: scopeFilter, scopes: SCOPES.join(', ') }), null);
  let profiles = store.profiles;
  if (scopeFilter) profiles = profiles.filter(profile => profile.scope === scopeFilter);
  const broken = scopeFilter ? [] : store.brokenLinks;
  const interactive = Boolean(process.stdout.isTTY && process.stdin.isTTY) && !isJsonMode();
  if (!profiles.length && !broken.length && !interactive) {
    say(scopeFilter ? _('list.empty.scope', { scope: scopeFilter }) : _('list.empty'));
    return;
  }
  const grouped = new Map<string, string[]>();
  for (const metadata of profiles) {
    const names = grouped.get(metadata.scope) ?? [];
    names.push(metadata.link ? _('list.linked', { name: metadata.name, path: metadata.link }) : metadata.name);
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
      if (selectedScope !== '__all__') return listProfiles(selectedScope, store);
    }
    for (const [scope, names] of grouped) note(names.join('\n'), scope);
    if (broken.length) note(broken.map(brokenLabel).join('\n'), _('list.broken.title'));
    const selected = await select<string>({
      message: _('list.manage.message'),
      options: [
        { value: '__create__', label: _('list.create.label'), hint: _('main.create.hint') },
        { value: '__clone__', label: _('list.clone.label'), hint: _('main.clone.hint') },
        { value: '__link__', label: _('list.link.label'), hint: _('main.link.hint') },
        ...profiles.map(profile => ({
          value: profile.name,
          label: `${profile.scope} · ${profile.name}`,
          hint: profile.link ? _('list.linked.hint', { path: profile.link }) : _('list.manage.hint')
        })),
        ...broken.map(link => ({ value: link.name, label: brokenLabel(link), hint: _('list.broken.hint') }))
      ]
    });
    if (cancelled(selected)) return cancel(_('list.cancel'));
    if (selected === '__create__') return createProfileTui();
    if (selected === '__clone__') return cloneProfileTui();
    if (selected === '__link__') return linkProfileTui();
    if (menuFor(selected, broken) === 'broken-link') return brokenLinkTui(selected, broken);
    await profileActions(selected);
    return;
  }
  for (const [scope, names] of grouped) {
    say(`[${scope}]`);
    for (const name of names) say(`  ${name}`);
  }
  if (broken.length) {
    say(`[${_('list.broken.title')}]`);
    for (const link of broken) say(`  ${brokenLabel(link)}`);
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
    await withConflictRecovery(target, () => runFromTui('profile.apply', [name, target], { pin }));
  },
  'profile.sync': async () => {
    const target = await projectPathTui(_('actions.sync.path'));
    if (!target) return cancel(_('actions.project.cancel'));
    await withConflictRecovery(target, () => runFromTui('profile.sync', [target], {}));
  },
  'profile.resolve': () => resolveProjectTui(),
  'profile.remove': name => removeProfileTui(name),
  'profile.status': async name => {
    let refresh = false;
    if (statusRefreshPrompt(name).ask) {
      const answer = await confirm({ message: _('actions.status.refresh'), initialValue: true });
      if (cancelled(answer)) return cancel(_('actions.project.cancel'));
      refresh = answer;
    }
    await runFromTui('profile.status', [name], { refresh });
  },
  'profile.pull': async name => {
    const preview = await runFromTui('profile.pull', [name], { 'dry-run': true });
    const commits = (preview.data as { commits?: string[] } | undefined)?.commits ?? [];
    if (!commits.length) return;
    const approved = await confirm({ message: _('confirm.pull', { name, count: commits.length }), initialValue: true });
    if (cancelled(approved) || !approved) return cancel(_('actions.project.cancel'));
    await runFromTui('profile.pull', [name], {});
  },
  'profile.push': async name => {
    await runFromTui('profile.push', [name], {});
  },
  'profile.connect': async name => {
    const url = await text({ message: _('connect.url.message'), placeholder: 'git@github.com:acme/agent-profile.git', validate: value => ((value ?? '').trim() ? undefined : _('clone.url.invalid')) });
    if (cancelled(url)) return cancel(_('actions.project.cancel'));
    const branch = await text({ message: _('connect.branch.message') });
    if (cancelled(branch)) return cancel(_('actions.project.cancel'));
    await runFromTui('profile.connect', [name, url.trim()], { branch: (branch ?? '').trim() });
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
  if (!name) {
    const choices = removeChoices();
    if (!choices.length) throw usageError('profile.none', _('error.profile.none'), _('hint.profile.create'));
    const selected = await select<string>({ message: _('remove.select'), options: choices });
    if (cancelled(selected)) return cancel(_('remove.cancel'));
    name = selected;
  }
  if (!profileLocation(name)) throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
  note(removeNote(name), _('remove.note.title'));
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
