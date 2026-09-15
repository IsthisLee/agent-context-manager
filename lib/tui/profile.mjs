import fs from 'node:fs';
import path from 'node:path';
import { cancel, confirm, intro, isCancel, note, outro, path as pathPrompt, select, text } from '@clack/prompts';
import { _, getLocale, guidanceDescriptions, guidanceLabels, levelOptions, scopeOptions } from '../i18n/index.mjs';
import { applyProfile, ConflictError, syncProject } from '../project/apply.mjs';
import { resolveProject } from '../project/resolve.mjs';
import { guidanceDefaults, setupProfile } from '../profile/setup.mjs';
import { createProfile, getProfiles, readProfile, removeProfile, SCOPES, selectProfile } from '../profile/store.mjs';

export async function createProfileTui() {
  if (!process.stdin.isTTY) {
    const [name, scope = 'personal'] = fs.readFileSync(0, 'utf8').split(/\r?\n/).map(value => value.trim());
    createProfile(name, scope || 'personal');
    return;
  }
  intro(_('create.intro'));
  const name = await text({
    message: _('create.name.message'),
    placeholder: 'company-main',
    validate(value) {
      if (!value.trim() || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.trim())) return _('create.name.invalid');
    }
  });
  if (isCancel(name)) return cancel(_('create.cancel'));
  const scope = await select({
    message: _('create.scope.message'),
    options: scopeOptions(getLocale())
  });
  if (isCancel(scope)) return cancel(_('create.cancel'));
  const selectedScope = scopeOptions(getLocale()).find(option => option.value === scope);
  note(`${name.trim()}
${selectedScope.label} — ${selectedScope.hint}`, _('create.note.title'));
  const approved = await confirm({ message: _('create.confirm'), initialValue: true });
  if (isCancel(approved) || !approved) return cancel(_('create.cancel'));
  createProfile(name.trim(), scope);
  outro(_('create.outro'));
}

export async function listProfiles(scopeFilter = null) {
  if (scopeFilter !== null && !SCOPES.includes(scopeFilter)) throw new Error(`Profile scope must be one of: ${SCOPES.join(', ')}.`);
  let profiles = getProfiles();
  if (scopeFilter) profiles = profiles.filter(profile => profile.scope === scopeFilter);
  if (!profiles.length) {
    console.log(scopeFilter
      ? `No profiles found in scope '${scopeFilter}'. Run \`agentic profile create <name> --scope ${scopeFilter}\` to create one.`
      : 'No profiles found. Run `agentic profile create` to create one.');
    return;
  }
  const grouped = new Map();
  for (const metadata of profiles) {
    if (!grouped.has(metadata.scope)) grouped.set(metadata.scope, []);
    grouped.get(metadata.scope).push(metadata.name);
  }
  if (process.stdout.isTTY) {
    intro(_('list.intro'));
    if (!scopeFilter) {
      const selectedScope = await select({
        message: _('list.scope.message'),
        options: [
          { value: '__all__', label: _('list.scope.all'), hint: _('list.scope.allHint', { n: profiles.length }) },
          ...scopeOptions(getLocale()).filter(option => profiles.some(profile => profile.scope === option.value)).map(option => ({
            ...option,
            hint: _('list.scope.hint', { n: profiles.filter(profile => profile.scope === option.value).length, hint: option.hint })
          }))
        ]
      });
      if (isCancel(selectedScope)) return cancel(_('list.cancel'));
      if (selectedScope !== '__all__') return listProfiles(selectedScope);
    }
    for (const [scope, names] of grouped) note(names.join('\n'), scope);
    const selected = await select({
      message: _('list.manage.message'),
      options: [
        { value: '__create__', label: _('list.create.label'), hint: _('main.create.hint') },
        ...profiles.map(profile => ({
          value: profile.name,
          label: `${profile.scope} · ${profile.name}`,
          hint: _('list.manage.hint')
        }))
      ]
    });
    if (isCancel(selected)) return cancel(_('list.cancel'));
    if (selected === '__create__') return createProfileTui();
    await profileActions(selected);
    return;
  }
  for (const [scope, names] of grouped) {
    console.log(`[${scope}]`);
    for (const name of names) console.log(`  ${name}`);
  }
}

export async function projectPathTui(message) {
  const target = await pathPrompt({
    message,
    root: process.cwd(),
    directory: true,
    initialValue: process.cwd(),
    validate(value) {
      const targetPath = path.resolve(value.trim() || '.');
      if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) return _('project.path.invalid');
    }
  });
  if (isCancel(target)) return null;
  return target.trim() || process.cwd();
}

export async function profileActions(name) {
  const action = await select({
    message: _('actions.message', { name }),
    options: [
      { value: 'setup', label: _('actions.setup.label'), hint: _('actions.setup.hint') },
      { value: 'apply', label: _('actions.apply.label'), hint: _('actions.apply.hint') },
      { value: 'sync', label: _('actions.sync.label'), hint: _('actions.sync.hint') },
      { value: 'resolve', label: _('actions.resolve.label'), hint: _('actions.resolve.hint') },
      { value: 'view', label: _('actions.view.label'), hint: _('actions.view.hint') },
      { value: 'remove', label: _('actions.remove.label'), hint: _('actions.remove.hint') }
    ]
  });
  if (isCancel(action)) return cancel(_('list.cancel'));

  if (action === 'setup') return setupProfileTui(name);
  if (action === 'remove') return removeProfileTui(name);
  if (action === 'view') {
    const profile = readProfile(name);
    note(`${profile.metadata.scope}\n\n${fs.readFileSync(profile.instructionsPath, 'utf8').trim()}`, name);
    return outro(_('actions.view.outro'));
  }

  if (action === 'resolve') return resolveProjectTui();

  const target = await projectPathTui(action === 'apply' ? _('actions.apply.path') : _('actions.sync.path'));
  if (!target) return cancel(_('actions.project.cancel'));
  const preview = await confirm({ message: _('actions.preview.confirm'), initialValue: false });
  if (isCancel(preview)) return cancel(_('actions.project.cancel'));
  const dryRun = preview ? ['--dry-run'] : [];
  try {
    // apply names the profile to set/switch; sync only refreshes the profile the project is already bound to.
    if (action === 'apply') applyProfile([name, ...dryRun, target]);
    else syncProject([...dryRun, target]);
  } catch (error) {
    if (!(error instanceof ConflictError)) throw error;
    note(error.message, _('resolve.conflict.title'));
    const next = await confirm({ message: _('resolve.offer'), initialValue: true });
    if (isCancel(next) || !next) return cancel(_('actions.project.cancel'));
    return resolveProjectTui(target);
  }
  outro(preview ? _('actions.outro.preview') : (action === 'apply' ? _('actions.outro.apply') : _('actions.outro.sync')));
}

/** Preview the conflicts of a project, then resolve them the way the user picks. */
export async function resolveProjectTui(target = null) {
  const project = target || await projectPathTui(_('resolve.path'));
  if (!project) return cancel(_('actions.project.cancel'));
  let preview = null;
  try {
    preview = resolveProject(['--dry-run', project]);
  } catch (error) {
    note(error.message, _('resolve.conflict.title'));
  }
  if (preview?.conflicts === 0) return outro(_('resolve.nothing'));
  const mode = await select({
    message: _('resolve.mode.message'),
    options: [
      { value: 'auto', label: _('resolve.mode.auto'), hint: _('resolve.mode.auto.hint') },
      { value: 'edit', label: _('resolve.mode.edit'), hint: _('resolve.mode.edit.hint') },
      { value: 'discard', label: _('resolve.mode.discard'), hint: _('resolve.mode.discard.hint') }
    ]
  });
  if (isCancel(mode)) return cancel(_('actions.project.cancel'));
  resolveProject([...(mode === 'auto' ? [] : [`--${mode}`]), project]);
  outro(_('resolve.outro'));
}

export async function removeProfileTui(name = null) {
  if (!process.stdin.isTTY) throw new Error('profile remove requires <name> --yes outside a TUI terminal.');
  intro(_('remove.intro'));
  const profiles = getProfiles();
  if (!profiles.length) throw new Error('No profiles found.');
  if (!name) {
    const selected = await select({
      message: _('remove.select'),
      options: profiles.map(profile => ({ value: profile.name, label: `${profile.scope} · ${profile.name}`, hint: _('remove.select.hint') }))
    });
    if (isCancel(selected)) return cancel(_('remove.cancel'));
    name = selected;
  }
  const profile = readProfile(name);
  note(_('remove.note.body', { scope: profile.metadata.scope, name }), _('remove.note.title'));
  const approved = await confirm({ message: _('remove.confirm'), initialValue: false });
  if (isCancel(approved) || !approved) return cancel(_('remove.cancel'));
  removeProfile(name);
  outro(_('remove.outro'));
}

export async function setupProfileTui(name = null) {
  if (!process.stdin.isTTY) {
    const answers = fs.readFileSync(0, 'utf8').split(/\r?\n/).map(value => value.trim());
    if (!name) name = selectProfile(answers.shift());
    const profile = readProfile(name);
    const values = [];
    for (const [index, key] of Object.keys(guidanceDefaults).entries()) {
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
    if (!profiles.length) throw new Error('No profiles found. Run `agentic profile create` first.');
    const selected = await select({
      message: _('setup.select'),
      options: profiles.map(profile => ({ value: profile.name, label: `${profile.scope} · ${profile.name}`, hint: _('setup.select.hint') }))
    });
    if (isCancel(selected)) return cancel(_('setup.cancel'));
    name = selected;
  }
  const profile = readProfile(name);
  const values = [];
  for (const key of Object.keys(guidanceDefaults)) {
    const current = profile.metadata.settings?.[key] || guidanceDefaults[key];
    const value = await select({
      message: _('setup.item.message', { label: labels[key], description: descriptions[key] }),
      options: levels,
      initialValue: current
    });
    if (isCancel(value)) return cancel(_('setup.cancel'));
    values.push(`--${key}`, value);
  }
  const summary = Object.keys(guidanceDefaults)
    .map(key => `${labels[key]}: ${values[values.indexOf(`--${key}`) + 1]}`)
    .join('\n');
  note(summary, _('setup.note.title', { name }));
  const approved = await confirm({ message: _('setup.confirm'), initialValue: true });
  if (isCancel(approved) || !approved) return cancel(_('setup.cancel'));
  setupProfile(name, values);
  outro(_('setup.outro'));
}
