#!/usr/bin/env node

/** Agentic guidance-profile and project manager. */

import fs from 'node:fs';
import path from 'node:path';
import { cancel, confirm, intro, isCancel, note, outro, path as pathPrompt, select, text } from '@clack/prompts';
import { fileURLToPath } from 'node:url';
import { BACKUP_DIR, collectUserEdits, formatDiff, relocateUserEdits } from './conflicts.mjs';
import { writeTextAtomic } from './fs-utils.mjs';
import { mergeInVsCode } from './merge-editor.mjs';
import { managedRegion, planProject, regionHash, writePlan } from './project-plan.mjs';
import { DEFAULT_LOCALE, getSavedLocale, guidanceDescriptions, guidanceLabels, guidanceLevelDefinitions, guidanceSections, levelOptions, PROFILE_METADATA_FILE, profileHome, resolveLocale, saveLocale, scopeOptions, SUPPORTED_LOCALES, t } from './i18n.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCOPES = ['personal', 'company', 'team', 'workspace'];
const rawArgs = process.argv.slice(2);
const langFlag = parseFlag(rawArgs, 'lang');
const args = stripFlag(rawArgs, 'lang');
const command = args[0] || 'help';
const invokedAs = path.basename(process.argv[1] || 'agentic').replace(/\.mjs$/, '');
let locale = DEFAULT_LOCALE;
const _ = (key, vars) => t(locale, key, vars);

function validateProfileName(name) {
  if (!name || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
    throw new Error('Profile name must use 1-64 lowercase letters, numbers, or hyphens.');
  }
}

function isValidProfileMetadata(metadata, expectedName = null) {
  return metadata && typeof metadata === 'object'
    && metadata.schemaVersion === 1
    && typeof metadata.name === 'string'
    && (!expectedName || metadata.name === expectedName)
    && /^[a-z0-9][a-z0-9-]{0,63}$/.test(metadata.name)
    && SCOPES.includes(metadata.scope);
}

function parseFlag(values, flag, fallback = null) {
  const index = values.indexOf(`--${flag}`);
  return index === -1 ? fallback : values[index + 1];
}

function hasFlag(values, flag) {
  return values.includes(`--${flag}`);
}

function stripFlag(values, flag) {
  const index = values.indexOf(`--${flag}`);
  if (index === -1) return values.slice();
  const removed = values.slice();
  removed.splice(index, index + 1 < removed.length ? 2 : 1);
  return removed;
}

function readProfile(name) {
  validateProfileName(name);
  const profileDir = path.join(profileHome(), name);
  const metadataPath = path.join(profileDir, PROFILE_METADATA_FILE);
  const instructionsPath = path.join(profileDir, 'AGENTS.md');
  if (!fs.existsSync(metadataPath) || !fs.existsSync(instructionsPath)) throw new Error(`Profile not found: ${name}`);
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    throw new Error(`Invalid profile metadata: ${name}`);
  }
  if (!isValidProfileMetadata(metadata, name)) throw new Error(`Invalid profile metadata: ${name}`);
  return { profileDir, metadataPath, instructionsPath, metadata };
}

function createProfile(name, scope = 'personal') {
  validateProfileName(name);
  if (!SCOPES.includes(scope)) throw new Error(`Profile scope must be one of: ${SCOPES.join(', ')}.`);
  const profileDir = path.join(profileHome(), name);
  if (fs.existsSync(profileDir)) throw new Error(`Profile already exists: ${name}`);
  fs.mkdirSync(profileDir, { recursive: true });
  writeTextAtomic(path.join(profileDir, PROFILE_METADATA_FILE), JSON.stringify({ schemaVersion: 1, name, scope, createdAt: new Date().toISOString() }, null, 2) + '\n');
  const profileTemplate = fs.readFileSync(path.join(PACKAGE_ROOT, locale === 'en' ? 'templates/profile/AGENTS.en.md' : 'templates/profile/AGENTS.md'), 'utf8');
  writeTextAtomic(path.join(profileDir, 'AGENTS.md'), profileTemplate.replaceAll('{{PROFILE_NAME}}', name));
  console.log(`Created profile: ${name} (${scope})`);
}

async function createProfileTui() {
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
    options: scopeOptions(locale)
  });
  if (isCancel(scope)) return cancel(_('create.cancel'));
  const selectedScope = scopeOptions(locale).find(option => option.value === scope);
  note(`${name.trim()}
${selectedScope.label} — ${selectedScope.hint}`, _('create.note.title'));
  const approved = await confirm({ message: _('create.confirm'), initialValue: true });
  if (isCancel(approved) || !approved) return cancel(_('create.cancel'));
  createProfile(name.trim(), scope);
  outro(_('create.outro'));
}

function getProfiles() {
  const home = profileHome();
  if (!fs.existsSync(home)) return [];
  const profiles = [];
  for (const name of fs.readdirSync(home).sort()) {
    const metadataPath = path.join(home, name, PROFILE_METADATA_FILE);
    if (!fs.existsSync(metadataPath)) continue;
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      if (isValidProfileMetadata(metadata, name)) profiles.push(metadata);
    } catch {}
  }
  return profiles.sort((a, b) => `${a.scope}:${a.name}`.localeCompare(`${b.scope}:${b.name}`));
}

async function listProfiles(scopeFilter = null) {
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
          ...scopeOptions(locale).filter(option => profiles.some(profile => profile.scope === option.value)).map(option => ({
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

async function projectPathTui(message) {
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

async function profileActions(name) {
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
async function resolveProjectTui(target = null) {
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

async function mainTui() {
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
    if (isCancel(action) || action === 'exit') break;
    if (action === 'manage') await listProfiles();
    else if (action === 'create') await createProfileTui();
    else if (action === 'setup') await setupProfileTui();
    else if (action === 'lang') await changeLocaleTui();
    else if (action === 'help') help();
  }
  outro(_('main.outro'));
}

function removeProfile(name) {
  const profile = readProfile(name);
  fs.rmSync(profile.profileDir, { recursive: true, force: true });
  console.log(`Removed profile: ${name}`);
}

function viewProfile(name) {
  const profile = readProfile(name);
  console.log(`${profile.metadata.name}\t${profile.metadata.scope}`);
  console.log(fs.readFileSync(profile.instructionsPath, 'utf8').trim());
}

async function removeProfileTui(name = null) {
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

const guidanceDefaults = { harness: 'recommended', tdd: 'recommended', review: 'recommended', verification: 'recommended', documentation: 'recommended', security: 'recommended' };

function setupProfile(name, values) {
  const profile = readProfile(name);
  const settings = {};
  for (const key of Object.keys(guidanceDefaults)) {
    const value = parseFlag(values, key, profile.metadata.settings?.[key] || guidanceDefaults[key]);
    if (!['off', 'recommended', 'strict'].includes(value)) throw new Error(`--${key} must be off, recommended, or strict.`);
    settings[key] = value;
  }
  const sections = guidanceSections(locale);
  const blocks = Object.entries(settings).filter(([, value]) => value !== 'off').map(([key, value]) => {
    const [title, body] = sections[key];
    return `## ${title}\n\n- ${_('setup.block.level')}: ${value}\n- ${body}`;
  });
  // Define what the levels mean once, from the shared constant, so the produced
  // file explains its own `적용 수준` labels instead of leaving them undefined.
  const definitions = guidanceLevelDefinitions(locale);
  const legend = `## ${_('setup.legend.title')}\n\n- recommended: ${definitions.recommended}\n- strict: ${definitions.strict}\n\n${_('setup.legend.intro')}`;
  const start = '<!-- agentic:guidance:start -->';
  const end = '<!-- agentic:guidance:end -->';
  const body = blocks.length ? [legend, ...blocks].join('\n\n') : '';
  const block = `${start}\n\n${body}\n\n${end}`;
  const current = fs.readFileSync(profile.instructionsPath, 'utf8');
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  writeTextAtomic(profile.instructionsPath, (pattern.test(current) ? current.replace(pattern, block) : `${current.trimEnd()}\n\n${block}\n`));
  writeTextAtomic(profile.metadataPath, JSON.stringify({ ...profile.metadata, settings, updatedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(`Configured profile: ${name}`);
}

async function setupProfileTui(name = null) {
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
  const labels = guidanceLabels(locale);
  const descriptions = guidanceDescriptions(locale);
  const levels = levelOptions(locale);
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

function printProfileChoices(profiles) {
  let previousScope = null;
  for (const [index, metadata] of profiles.entries()) {
    if (metadata.scope !== previousScope) {
      console.log(`\n[${metadata.scope}]`);
      previousScope = metadata.scope;
    }
    console.log(`${index + 1}. ${metadata.name}`);
  }
}

function selectProfile(selection, profiles = getProfiles()) {
  if (!profiles.length) throw new Error('No profiles found. Run `agentic profile create` first.');
  const index = Number.parseInt(selection, 10);
  const selected = Number.isInteger(index) && index >= 1
    ? profiles[index - 1]
    : profiles.find(profile => profile.name === selection);
  if (!selected) throw new Error(`Profile selection not found: ${selection}`);
  return selected.name;
}

function renderProfileAgents(profile, projectName) {
  const content = fs.readFileSync(profile.instructionsPath, 'utf8').trimEnd();
  return `${content}\n\n> Applied from Agentic Profile: ${profile.metadata.name}\n\n## Project context\n\n* **Project:** ${projectName}\n\n${_('scaffold.extHeading')}\n\n${_('scaffold.extBody')}\n`;
}

function getProjectName(targetDir) {
  const packagePath = path.join(targetDir, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (packageJson.name) return packageJson.name;
    } catch {}
  }
  return path.basename(targetDir);
}

function assertProjectDirectory(targetDir) {
  if (!fs.existsSync(targetDir)) throw new Error(`Directory not found: ${targetDir}`);
  try {
    if (!fs.statSync(targetDir).isDirectory()) throw new Error(`Project path is not a directory: ${targetDir}`);
  } catch (error) {
    if (error.message.startsWith('Project path is not a directory:')) throw error;
    throw new Error(`Project path is not a directory: ${targetDir}`);
  }
}

function readProjectConfig(configPath) {
  if (!fs.existsSync(configPath)) return {};
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('not an object');
    return config;
  } catch {
    throw new Error(`Invalid project metadata: ${configPath}`);
  }
}

/** The profile a project is bound to, reading the current key and the pre-rename `core` key. */
function boundProfile(projectConfig) {
  return projectConfig.profile || projectConfig.core || null;
}

/** Positional arguments for `profile apply`: `<name> [<project>]`. */
function applyArgs(values) {
  const positional = values.filter(value => !value.startsWith('--'));
  return { name: positional[0] || null, targetPath: positional[1] || '.' };
}

const CONFLICT_GUIDE = 'https://github.com/IsthisLee/agentic/blob/main/docs/usage-guide.md#관리-영역을-고쳐서-멈췄을-때';

/** Raised when managed areas were edited outside Agentic; carries the conflicting files. */
class ConflictError extends Error {
  constructor(message, conflicts) {
    super(message);
    this.conflicts = conflicts;
  }
}

function cliName() {
  return invokedAs === 'agt' ? 'agt' : 'agentic';
}

function conflictError(conflicts, targetDir) {
  return new ConflictError([
    `Managed file changed outside Agentic: ${conflicts.map(file => file.rel).join(', ')}`,
    `  See the difference:  ${cliName()} profile sync --dry-run ${targetDir}`,
    `  Resolve it:          ${cliName()} profile resolve ${targetDir}`,
    `  Guide: ${CONFLICT_GUIDE}`
  ].join('\n'), conflicts);
}

function planFor(name, targetDir, overrides) {
  const profile = readProfile(name);
  const projectConfig = readProjectConfig(path.join(targetDir, 'agentic.project.json'));
  const projectName = getProjectName(targetDir);
  return planProject({
    packageRoot: PACKAGE_ROOT,
    targetDir,
    projectName,
    profileName: name,
    renderedAgents: renderProfileAgents(profile, projectName),
    projectConfig
  }, overrides);
}

function printPlan(plan, label) {
  const conflicted = new Set(plan.conflicts.map(file => file.rel));
  const changed = plan.changes.filter(change => change.status !== 'unchanged' && !conflicted.has(change.relativePath));
  console.log(`${label}: ${changed.length} file(s) to change.`);
  for (const change of plan.changes) {
    const status = conflicted.has(change.relativePath) ? 'conflict' : change.status;
    console.log(`  ${status.padEnd(9)} ${change.relativePath}`);
  }
}

function printConflicts(conflicts) {
  for (const file of conflicts) {
    console.log(`\nConflict: ${file.rel}`);
    if (file.conflict.kind === 'missing') {
      console.log(`${file.rel} is missing. \`profile resolve\` recreates it.`);
    } else if (file.conflict.base !== null) {
      console.log('Edits inside the managed area since the last apply:');
      console.log(formatDiff(`last-applied/${file.rel}`, `current/${file.rel}`, file.conflict.base, file.currentRegion ?? ''));
      if (file.nextRegion !== file.conflict.base) {
        console.log('Profile or template changes Agentic will write:');
        console.log(formatDiff(`last-applied/${file.rel}`, `next/${file.rel}`, file.conflict.base, file.nextRegion ?? ''));
      }
    } else {
      console.log('The last applied version is unknown. Current managed area compared with what Agentic will write:');
      console.log(formatDiff(`current/${file.rel}`, `next/${file.rel}`, file.currentRegion ?? '', file.nextRegion ?? ''));
    }
  }
}

function applyProfile(values) {
  const { name, targetPath } = applyArgs(values);
  if (!name) throw new Error('profile apply requires <name> <project>.');
  const targetDir = path.resolve(process.cwd(), targetPath);
  assertProjectDirectory(targetDir);
  const plan = planFor(name, targetDir);
  const dryRun = hasFlag(values, 'dry-run');
  if (plan.conflicts.length && !dryRun) throw conflictError(plan.conflicts, targetDir);
  printPlan(plan, dryRun ? 'Dry-run' : 'Plan');
  if (dryRun) {
    printConflicts(plan.conflicts);
    console.log('Dry-run: no files were changed.');
    if (plan.conflicts.length) throw conflictError(plan.conflicts, targetDir);
    return;
  }
  writePlan(plan.changes, targetDir);
  console.log(`Applied profile ${name} to ${targetDir}`);
}

/**
 * Refresh the profile a project is already bound to. `sync` never switches the
 * bound profile: naming a profile (a second positional, or `--profile`/`--core`)
 * is rejected so bulk refreshes cannot silently rebind a project.
 */
function syncProject(values) {
  if (parseFlag(values, 'profile') || parseFlag(values, 'core')) {
    throw new Error('profile sync does not switch profiles. To switch, use `agentic profile apply <name> <project>`.');
  }
  const positional = values.filter(value => !value.startsWith('--'));
  if (positional.length > 1) {
    throw new Error('profile sync takes only <project>. To switch profiles, use `agentic profile apply <name> <project>`.');
  }
  const targetPath = positional[0] || '.';
  const targetDir = path.resolve(process.cwd(), targetPath);
  assertProjectDirectory(targetDir);
  const selectionPath = path.join(targetDir, 'agentic.project.json');
  const selected = boundProfile(readProjectConfig(selectionPath));
  if (!selected) throw new Error('profile sync requires a project already applied with `agentic profile apply <name> <project>`.');
  applyProfile([selected, ...(hasFlag(values, 'dry-run') ? ['--dry-run'] : []), targetDir]);
}

/** The current file with its managed area swapped back to the base, for a three-way merge. */
function withBaseRegion(file) {
  if (file.kind === 'agents') return `${file.conflict.base}${file.existing.slice(file.currentRegion.length)}`;
  return file.existing.replace(file.currentRegion, () => file.conflict.base);
}

function mergeWithEditor(file) {
  const merged = mergeInVsCode({ name: file.rel, current: file.existing, incoming: file.regenerated, base: withBaseRegion(file) });
  if (regionHash(managedRegion(file.kind, merged.content)) !== regionHash(file.nextRegion)) {
    throw new Error(`Merge result for ${file.rel} still changes the managed area. Move your lines outside it and run resolve again. Result kept at ${merged.resultPath}`);
  }
  merged.cleanup();
  return merged.content;
}

/**
 * Resolve managed-area conflicts on a project bound to a profile. Edits made
 * inside a managed area move outside it and the area is regenerated. When the
 * last applied version is unknown, only `--discard` (with a backup) proceeds.
 */
function resolveProject(values) {
  const positional = values.filter(value => !value.startsWith('--'));
  if (positional.length > 1) throw new Error('profile resolve takes only <project>.');
  const targetDir = path.resolve(process.cwd(), positional[0] || '.');
  assertProjectDirectory(targetDir);
  const name = boundProfile(readProjectConfig(path.join(targetDir, 'agentic.project.json')));
  if (!name) throw new Error('profile resolve requires a project already applied with `agentic profile apply <name> <project>`.');
  const dryRun = hasFlag(values, 'dry-run');
  const plan = planFor(name, targetDir);
  if (!plan.conflicts.length) {
    console.log('Nothing to resolve: every managed area matches the last apply.');
    return { conflicts: 0 };
  }

  const stamp = new Date().toISOString().replaceAll(':', '-');
  const will = (past, future) => (dryRun ? future : past);
  const overrides = new Map();
  const backups = [];
  const unresolved = [];
  for (const file of plan.conflicts) {
    if (file.conflict.kind === 'missing') {
      overrides.set(file.rel, null);
      console.log(`${file.rel}: ${will('recreated', 'would recreate')} the missing file.`);
    } else if (file.conflict.base === null) {
      if (!hasFlag(values, 'discard')) {
        unresolved.push(file);
        continue;
      }
      const backup = `${BACKUP_DIR}/${stamp}/${file.rel}`;
      backups.push({ target: path.join(targetDir, backup), relativePath: backup, content: file.existing, status: 'create' });
      overrides.set(file.rel, file.regenerated);
      console.log(`${file.rel}: ${will('backed up', 'would back up')} to ${backup} and ${will('regenerated', 'would regenerate')} the managed area.`);
    } else if (hasFlag(values, 'edit') && !dryRun && file.currentRegion) {
      overrides.set(file.rel, mergeWithEditor(file));
      console.log(`${file.rel}: applied the VS Code merge result.`);
    } else {
      const edits = collectUserEdits(file.conflict.base, file.currentRegion ?? '');
      overrides.set(file.rel, relocateUserEdits(file.regenerated, edits.addedLines, file.kind));
      console.log(`${file.rel}: ${will('moved', 'would move')} ${edits.addedLines.length} line(s) outside the managed area; ${will('restored', 'would restore')} ${edits.removedLines.length} line(s) removed inside it.`);
      if (edits.addedLines.length && edits.removedLines.length) {
        console.log(`  Some lines were changed rather than added. Check ${file.rel} for near-duplicate lines below the managed area.`);
      }
    }
  }

  if (unresolved.length) {
    printConflicts(unresolved);
    throw new Error([
      `Cannot tell your edits from profile changes in: ${unresolved.map(file => file.rel).join(', ')}. The last applied version is unknown.`,
      `  Keep what you need outside the managed area, then run: ${cliName()} profile resolve --discard ${targetDir}`,
      `  --discard backs up each file under ${BACKUP_DIR}/ before regenerating it.`
    ].join('\n'));
  }
  if (dryRun) {
    console.log('Dry-run: no files were changed.');
    return { conflicts: plan.conflicts.length };
  }
  const resolved = planFor(name, targetDir, overrides);
  writePlan([...backups, ...resolved.changes], targetDir);
  console.log(`Resolved ${plan.conflicts.length} conflict(s) in ${targetDir}`);
  return { conflicts: plan.conflicts.length };
}

async function promptLocale() {
  const selected = await select({
    message: t(locale, 'lang.prompt.message'),
    options: [
      { value: 'ko', label: '한국어 (Korean)' },
      { value: 'en', label: 'English (영어)' }
    ]
  });
  if (isCancel(selected)) return null;
  return selected;
}

async function changeLocaleTui() {
  const chosen = await promptLocale();
  if (!chosen) return cancel(_('lang.cancel'));
  locale = saveLocale(chosen);
  note(_('lang.saved', { locale }), _('main.lang.label'));
}

function configLang(value) {
  if (!value) throw new Error(`config lang requires a value. Use: config lang ${SUPPORTED_LOCALES.join('|')}.`);
  const saved = saveLocale(value);
  console.log(`Saved language preference: ${saved}`);
}

function help() {
  const title = invokedAs === 'agt' ? 'agt (agentic)' : 'agentic (agt)';
  const commandName = invokedAs === 'agt' ? 'agt' : 'agentic';
  console.log(`${title} shared project guidance manager\n\n  ${commandName} profile create [<name>] [--scope <scope>]\n  ${commandName} profile list [--scope <scope>]\n  ${commandName} profile view <name>\n  ${commandName} profile setup [<name>] [--tdd <level>] ...\n  ${commandName} profile apply <name> [--dry-run] <project>\n  ${commandName} profile sync [--dry-run] <project>\n  ${commandName} profile resolve [--dry-run] [--discard] [--edit] <project>\n  ${commandName} profile remove [<name>] [--yes]\n  ${commandName} config lang <ko|en>\n\nScopes: ${SCOPES.join(', ')}\nLanguage: ${SUPPORTED_LOCALES.join(', ')} (default ${DEFAULT_LOCALE}). Set with --lang, AGENTIC_LANG, or config lang; on first interactive run you are asked once and the choice is saved.\nUse either agentic or agt. Omit profile create, setup, or remove options to use interactive TUI prompts.`);
}

async function runProfileCommand(profileArgs) {
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

async function main() {
  locale = resolveLocale({
    flag: langFlag,
    env: process.env.AGENTIC_LANG || null,
    saved: getSavedLocale(),
    isTTY: process.stdin.isTTY
  });
  if (locale === null) {
    const chosen = await promptLocale();
    locale = chosen ? saveLocale(chosen) : DEFAULT_LOCALE;
  }
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

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
