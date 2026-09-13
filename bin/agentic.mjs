#!/usr/bin/env node

/** Agentic Core and project guidance manager. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cancel, confirm, intro, isCancel, note, outro, path as pathPrompt, select, text } from '@clack/prompts';
import { fileURLToPath } from 'node:url';
import { extractAgentsManagedDocument, extractManagedDocument, hashAgentsManagedDocument, hashManagedDocument, mergeAgentsMd, mergeManagedDocument } from './analyzer.mjs';
import { assertSafeTextTarget, writeTextAtomic } from './fs-utils.mjs';
import { DEFAULT_LOCALE, getSavedLocale, guidanceDescriptions, guidanceLabels, guidanceSections, levelOptions, resolveLocale, saveLocale, scopeOptions, SUPPORTED_LOCALES, t } from './i18n.mjs';

const CORE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCOPES = ['personal', 'company', 'team', 'workspace'];
const rawArgs = process.argv.slice(2);
const langFlag = parseFlag(rawArgs, 'lang');
const args = stripFlag(rawArgs, 'lang');
const command = args[0] || 'help';
const invokedAs = path.basename(process.argv[1] || 'agentic').replace(/\.mjs$/, '');
let locale = DEFAULT_LOCALE;
const _ = (key, vars) => t(locale, key, vars);

function getCoreHome() {
  return path.join(process.env.AGENTIC_HOME || os.homedir(), '.agentic-cores');
}

function validateCoreName(name) {
  if (!name || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
    throw new Error('Core name must use 1-64 lowercase letters, numbers, or hyphens.');
  }
}

function isValidCoreMetadata(metadata, expectedName = null) {
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

function readCore(name) {
  validateCoreName(name);
  const coreDir = path.join(getCoreHome(), name);
  const metadataPath = path.join(coreDir, 'agentic-core.json');
  const instructionsPath = path.join(coreDir, 'AGENTS.md');
  if (!fs.existsSync(metadataPath) || !fs.existsSync(instructionsPath)) throw new Error(`Core not found: ${name}`);
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    throw new Error(`Invalid Core metadata: ${name}`);
  }
  if (!isValidCoreMetadata(metadata, name)) throw new Error(`Invalid Core metadata: ${name}`);
  return { coreDir, metadataPath, instructionsPath, metadata };
}

function createCore(name, scope = 'personal') {
  validateCoreName(name);
  if (!SCOPES.includes(scope)) throw new Error(`Core scope must be one of: ${SCOPES.join(', ')}.`);
  const coreDir = path.join(getCoreHome(), name);
  if (fs.existsSync(coreDir)) throw new Error(`Core already exists: ${name}`);
  fs.mkdirSync(coreDir, { recursive: true });
  writeTextAtomic(path.join(coreDir, 'agentic-core.json'), JSON.stringify({ schemaVersion: 1, name, scope, createdAt: new Date().toISOString() }, null, 2) + '\n');
  const coreTemplate = fs.readFileSync(path.join(CORE_ROOT, locale === 'en' ? 'templates/core/AGENTS.en.md' : 'templates/core/AGENTS.md'), 'utf8');
  writeTextAtomic(path.join(coreDir, 'AGENTS.md'), coreTemplate.replaceAll('{{CORE_NAME}}', name));
  console.log(`Created Core: ${name} (${scope})`);
}

async function createCoreTui() {
  if (!process.stdin.isTTY) {
    const [name, scope = 'personal'] = fs.readFileSync(0, 'utf8').split(/\r?\n/).map(value => value.trim());
    createCore(name, scope || 'personal');
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
  createCore(name.trim(), scope);
  outro(_('create.outro'));
}

function getCores() {
  const home = getCoreHome();
  if (!fs.existsSync(home)) return [];
  const cores = [];
  for (const name of fs.readdirSync(home).sort()) {
    const metadataPath = path.join(home, name, 'agentic-core.json');
    if (!fs.existsSync(metadataPath)) continue;
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      if (isValidCoreMetadata(metadata, name)) cores.push(metadata);
    } catch {}
  }
  return cores.sort((a, b) => `${a.scope}:${a.name}`.localeCompare(`${b.scope}:${b.name}`));
}

async function listCores(scopeFilter = null) {
  if (scopeFilter !== null && !SCOPES.includes(scopeFilter)) throw new Error(`Core scope must be one of: ${SCOPES.join(', ')}.`);
  let cores = getCores();
  if (scopeFilter) cores = cores.filter(core => core.scope === scopeFilter);
  if (!cores.length) {
    console.log(scopeFilter
      ? `No Cores found in scope '${scopeFilter}'. Run \`agentic core create <name> --scope ${scopeFilter}\` to create one.`
      : 'No Cores found. Run `agentic core create` to create one.');
    return;
  }
  const grouped = new Map();
  for (const metadata of cores) {
    if (!grouped.has(metadata.scope)) grouped.set(metadata.scope, []);
    grouped.get(metadata.scope).push(metadata.name);
  }
  if (process.stdout.isTTY) {
    intro(_('list.intro'));
    if (!scopeFilter) {
      const selectedScope = await select({
        message: _('list.scope.message'),
        options: [
          { value: '__all__', label: _('list.scope.all'), hint: _('list.scope.allHint', { n: cores.length }) },
          ...scopeOptions(locale).filter(option => cores.some(core => core.scope === option.value)).map(option => ({
            ...option,
            hint: _('list.scope.hint', { n: cores.filter(core => core.scope === option.value).length, hint: option.hint })
          }))
        ]
      });
      if (isCancel(selectedScope)) return cancel(_('list.cancel'));
      if (selectedScope !== '__all__') return listCores(selectedScope);
    }
    for (const [scope, names] of grouped) note(names.join('\n'), scope);
    const selected = await select({
      message: _('list.manage.message'),
      options: [
        { value: '__create__', label: _('list.create.label'), hint: _('main.create.hint') },
        ...cores.map(core => ({
          value: core.name,
          label: `${core.scope} · ${core.name}`,
          hint: _('list.manage.hint')
        }))
      ]
    });
    if (isCancel(selected)) return cancel(_('list.cancel'));
    if (selected === '__create__') return createCoreTui();
    await coreActions(selected);
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

async function coreActions(name) {
  const action = await select({
    message: _('actions.message', { name }),
    options: [
      { value: 'setup', label: _('actions.setup.label'), hint: _('actions.setup.hint') },
      { value: 'apply', label: _('actions.apply.label'), hint: _('actions.apply.hint') },
      { value: 'sync', label: _('actions.sync.label'), hint: _('actions.sync.hint') },
      { value: 'view', label: _('actions.view.label'), hint: _('actions.view.hint') },
      { value: 'remove', label: _('actions.remove.label'), hint: _('actions.remove.hint') }
    ]
  });
  if (isCancel(action)) return cancel(_('list.cancel'));

  if (action === 'setup') return setupCoreTui(name);
  if (action === 'remove') return removeCoreTui(name);
  if (action === 'view') {
    const core = readCore(name);
    note(`${core.metadata.scope}\n\n${fs.readFileSync(core.instructionsPath, 'utf8').trim()}`, name);
    return outro(_('actions.view.outro'));
  }

  const target = await projectPathTui(action === 'apply' ? _('actions.apply.path') : _('actions.sync.path'));
  if (!target) return cancel(_('actions.project.cancel'));
  const preview = await confirm({ message: _('actions.preview.confirm'), initialValue: false });
  if (isCancel(preview)) return cancel(_('actions.project.cancel'));
  const operationArgs = ['--core', name, ...(preview ? ['--dry-run'] : []), target];
  if (action === 'apply') applyCore(operationArgs);
  else syncProject(operationArgs);
  outro(preview ? _('actions.outro.preview') : (action === 'apply' ? _('actions.outro.apply') : _('actions.outro.sync')));
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
    if (action === 'manage') await listCores();
    else if (action === 'create') await createCoreTui();
    else if (action === 'setup') await setupCoreTui();
    else if (action === 'lang') await changeLocaleTui();
    else if (action === 'help') help();
  }
  outro(_('main.outro'));
}

function removeCore(name) {
  const core = readCore(name);
  fs.rmSync(core.coreDir, { recursive: true, force: true });
  console.log(`Removed Core: ${name}`);
}

function viewCore(name) {
  const core = readCore(name);
  console.log(`${core.metadata.name}\t${core.metadata.scope}`);
  console.log(fs.readFileSync(core.instructionsPath, 'utf8').trim());
}

async function removeCoreTui(name = null) {
  if (!process.stdin.isTTY) throw new Error('core remove requires <name> --yes outside a TUI terminal.');
  intro(_('remove.intro'));
  const cores = getCores();
  if (!cores.length) throw new Error('No Cores found.');
  if (!name) {
    const selected = await select({
      message: _('remove.select'),
      options: cores.map(core => ({ value: core.name, label: `${core.scope} · ${core.name}`, hint: _('remove.select.hint') }))
    });
    if (isCancel(selected)) return cancel(_('remove.cancel'));
    name = selected;
  }
  const core = readCore(name);
  note(_('remove.note.body', { scope: core.metadata.scope, name }), _('remove.note.title'));
  const approved = await confirm({ message: _('remove.confirm'), initialValue: false });
  if (isCancel(approved) || !approved) return cancel(_('remove.cancel'));
  removeCore(name);
  outro(_('remove.outro'));
}

const guidanceDefaults = { harness: 'recommended', tdd: 'recommended', review: 'recommended', verification: 'recommended', documentation: 'recommended', security: 'recommended' };

function setupCore(name, values) {
  const core = readCore(name);
  const settings = {};
  for (const key of Object.keys(guidanceDefaults)) {
    const value = parseFlag(values, key, core.metadata.settings?.[key] || guidanceDefaults[key]);
    if (!['off', 'recommended', 'strict'].includes(value)) throw new Error(`--${key} must be off, recommended, or strict.`);
    settings[key] = value;
  }
  const sections = guidanceSections(locale);
  const blocks = Object.entries(settings).filter(([, value]) => value !== 'off').map(([key, value]) => {
    const [title, body] = sections[key];
    return `## ${title}\n\n- ${_('setup.block.level')}: ${value}\n- ${body}`;
  });
  const start = '<!-- agentic:guidance:start -->';
  const end = '<!-- agentic:guidance:end -->';
  const block = `${start}\n\n${blocks.join('\n\n')}\n\n${end}`;
  const current = fs.readFileSync(core.instructionsPath, 'utf8');
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  writeTextAtomic(core.instructionsPath, (pattern.test(current) ? current.replace(pattern, block) : `${current.trimEnd()}\n\n${block}\n`));
  writeTextAtomic(core.metadataPath, JSON.stringify({ ...core.metadata, settings, updatedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(`Configured Core: ${name}`);
}

async function setupCoreTui(name = null) {
  if (!process.stdin.isTTY) {
    const answers = fs.readFileSync(0, 'utf8').split(/\r?\n/).map(value => value.trim());
    if (!name) name = selectCore(answers.shift());
    const core = readCore(name);
    const values = [];
    for (const [index, key] of Object.keys(guidanceDefaults).entries()) {
      values.push(`--${key}`, answers[index] || core.metadata.settings?.[key] || guidanceDefaults[key]);
    }
    setupCore(name, values);
    return;
  }
  intro(_('setup.intro'));
  const labels = guidanceLabels(locale);
  const descriptions = guidanceDescriptions(locale);
  const levels = levelOptions(locale);
  const cores = getCores();
  if (!name) {
    if (!cores.length) throw new Error('No Cores found. Run `agentic core create` first.');
    const selected = await select({
      message: _('setup.select'),
      options: cores.map(core => ({ value: core.name, label: `${core.scope} · ${core.name}`, hint: _('setup.select.hint') }))
    });
    if (isCancel(selected)) return cancel(_('setup.cancel'));
    name = selected;
  }
  const core = readCore(name);
  const values = [];
  for (const key of Object.keys(guidanceDefaults)) {
    const current = core.metadata.settings?.[key] || guidanceDefaults[key];
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
  setupCore(name, values);
  outro(_('setup.outro'));
}

function printCoreChoices(cores) {
  let previousScope = null;
  for (const [index, metadata] of cores.entries()) {
    if (metadata.scope !== previousScope) {
      console.log(`\n[${metadata.scope}]`);
      previousScope = metadata.scope;
    }
    console.log(`${index + 1}. ${metadata.name}`);
  }
}

function selectCore(selection, cores = getCores()) {
  if (!cores.length) throw new Error('No Cores found. Run `agentic core create` first.');
  const index = Number.parseInt(selection, 10);
  const selected = Number.isInteger(index) && index >= 1
    ? cores[index - 1]
    : cores.find(core => core.name === selection);
  if (!selected) throw new Error(`Core selection not found: ${selection}`);
  return selected.name;
}

function renderCoreAgents(core, projectName) {
  const content = fs.readFileSync(core.instructionsPath, 'utf8').trimEnd();
  return `${content}\n\n> Applied from Agentic Core: ${core.metadata.name}\n\n## Project context\n\n* **Project:** ${projectName}\n\n${_('scaffold.extHeading')}\n\n${_('scaffold.extBody')}\n`;
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

function renderAdapter(template, target, projectName) {
  const generated = fs.readFileSync(template, 'utf8').replaceAll('{{PROJECT_NAME}}', projectName);
  const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  return mergeManagedDocument(generated, existing);
}

function projectArgs(values) {
  const core = parseFlag(values, 'core');
  const positional = values.filter((value, index) => !value.startsWith('--') && (values.indexOf('--core') === -1 || index !== values.indexOf('--core') + 1));
  return { coreName: core, targetPath: positional[0] || '.' };
}

function applyCore(values) {
  const { coreName, targetPath } = projectArgs(values);
  if (!coreName) throw new Error('init requires --core <name>.');
  const targetDir = path.resolve(process.cwd(), targetPath);
  assertProjectDirectory(targetDir);
  const core = readCore(coreName);
  const projectName = getProjectName(targetDir);
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  const projectConfigPath = path.join(targetDir, 'agentic.project.json');
  let projectConfig = {};
  projectConfig = readProjectConfig(projectConfigPath);
  const changes = [];
  const planFile = (target, content) => {
    const relativePath = path.relative(targetDir, target) || path.basename(target);
    const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    changes.push({ target, relativePath, content, status: existing === null ? 'create' : existing === content ? 'unchanged' : 'update' });
  };
  const existingAgents = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : null;
  const previousAgentsHash = projectConfig.managedHashes?.['AGENTS.md'];
  if (previousAgentsHash && hashAgentsManagedDocument(existingAgents) !== previousAgentsHash) {
    throw new Error('Managed file changed outside Agentic: AGENTS.md');
  }
  const agents = mergeAgentsMd(renderCoreAgents(core, projectName), existingAgents);
  planFile(agentsPath, agents);
  for (const [source, target] of [
    ['templates/CLAUDE.md', 'CLAUDE.md'],
    ['templates/gemini-rules/agentic.md', '.gemini/rules/agentic.md'],
    ['templates/cursor-rules/agentic.mdc', '.cursor/rules/agentic.mdc'],
    ['templates/copilot-instructions.md', '.github/copilot-instructions.md']
  ]) {
    const targetPath = path.join(targetDir, target);
    const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
    const previousHash = projectConfig.managedHashes?.[target];
    if (previousHash && hashManagedDocument(existing) !== previousHash) {
      throw new Error(`Managed file changed outside Agentic: ${target}`);
    }
    planFile(targetPath, renderAdapter(path.join(CORE_ROOT, source), targetPath, projectName));
  }
  const managedHashes = {};
  if (extractAgentsManagedDocument(agents)) managedHashes['AGENTS.md'] = hashAgentsManagedDocument(agents);
  for (const change of changes.filter(change => change.relativePath !== 'AGENTS.md' && change.relativePath !== 'agentic.project.json')) {
    const managed = extractManagedDocument(change.content);
    if (managed) managedHashes[change.relativePath] = hashManagedDocument(change.content);
  }
  planFile(projectConfigPath, JSON.stringify({ ...projectConfig, schemaVersion: 1, core: coreName, managedHashes }, null, 2) + '\n');
  const changed = changes.filter(change => change.status !== 'unchanged');
  console.log(`${hasFlag(values, 'dry-run') ? 'Dry-run' : 'Plan'}: ${changed.length} file(s) to ${hasFlag(values, 'dry-run') ? 'change' : 'change'}.`);
  for (const change of changes) console.log(`  ${change.status.padEnd(9)} ${change.relativePath}`);
  if (hasFlag(values, 'dry-run')) {
    console.log('Dry-run: no files were changed.');
    return;
  }
  for (const change of changed) assertSafeTextTarget(change.target, targetDir);
  for (const change of changed) {
    writeTextAtomic(change.target, change.content);
  }
  console.log(`Applied Core ${coreName} to ${targetDir}`);
}

function syncProject(values) {
  const { coreName, targetPath } = projectArgs(values);
  const targetDir = path.resolve(process.cwd(), targetPath);
  assertProjectDirectory(targetDir);
  const selectionPath = path.join(targetDir, 'agentic.project.json');
  const selected = coreName || readProjectConfig(selectionPath).core;
  if (!selected) throw new Error('sync requires --core <name> or an existing agentic.project.json.');
  applyCore(['--core', selected, ...(hasFlag(values, 'dry-run') ? ['--dry-run'] : []), targetPath]);
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
  console.log(`${title} shared project guidance manager\n\n  ${commandName} core create [<name>] [--scope <scope>]\n  ${commandName} core list [--scope <scope>]\n  ${commandName} core view <name>\n  ${commandName} core remove [<name>] [--yes]\n  ${commandName} setup [--core <name>] [--tdd <level>] ...\n  ${commandName} init --core <name> [--dry-run] <project>\n  ${commandName} sync [--core <name>] [--dry-run] <project>\n  ${commandName} config lang <ko|en>\n\nScopes: ${SCOPES.join(', ')}\nLanguage: ${SUPPORTED_LOCALES.join(', ')} (default ${DEFAULT_LOCALE}). Set with --lang, AGENTIC_LANG, or config lang; on first interactive run you are asked once and the choice is saved.\nUse either agentic or agt. Omit core create, setup, or remove options to use interactive TUI prompts.`);
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
  } else if (command === 'core' && args[1] === 'create') {
    if (args[2]) createCore(args[2], parseFlag(args.slice(3), 'scope', 'personal'));
    else await createCoreTui();
  } else if (command === 'core' && args[1] === 'remove') {
    const removeArgs = args.slice(2);
    const name = removeArgs.find(value => !value.startsWith('--')) || null;
    if (hasFlag(removeArgs, 'yes')) {
      if (!name) throw new Error('core remove --yes requires <name>.');
      removeCore(name);
    }
    else await removeCoreTui(name);
  } else if (command === 'core' && args[1] === 'view') {
    if (!args[2]) throw new Error('core view requires <name>.');
    viewCore(args[2]);
  }
  else if (command === 'core' && args[1] === 'list') await listCores(parseFlag(args.slice(2), 'scope'));
  else if (command === 'setup') {
    const name = parseFlag(args.slice(1), 'core');
    const optionCount = args.slice(1).filter(value => value.startsWith('--')).length;
    if (!name && optionCount > 0) throw new Error('setup requires --core <name>.');
    if (optionCount <= 1) await setupCoreTui(name);
    else setupCore(name, args.slice(1));
  } else if (command === 'init') applyCore(args.slice(1));
  else if (command === 'sync') syncProject(args.slice(1));
  else help();
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
