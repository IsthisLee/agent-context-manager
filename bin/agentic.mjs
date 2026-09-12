#!/usr/bin/env node

/** Agentic Core and project guidance manager. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cancel, confirm, intro, isCancel, note, outro, select, text } from '@clack/prompts';
import { fileURLToPath } from 'node:url';
import { mergeAgentsMd } from './analyzer.mjs';

const CORE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const command = args[0] || 'help';
const invokedAs = path.basename(process.argv[1] || 'agentic').replace(/\.mjs$/, '');

function getCoreHome() {
  return path.join(process.env.AGENTIC_HOME || os.homedir(), '.agentic-cores');
}

function validateCoreName(name) {
  if (!name || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
    throw new Error('Core name must use 1-64 lowercase letters, numbers, or hyphens.');
  }
}

function parseFlag(values, flag, fallback = null) {
  const index = values.indexOf(`--${flag}`);
  return index === -1 ? fallback : values[index + 1];
}

function readCore(name) {
  validateCoreName(name);
  const coreDir = path.join(getCoreHome(), name);
  const metadataPath = path.join(coreDir, 'agentic-core.json');
  const instructionsPath = path.join(coreDir, 'AGENTS.md');
  if (!fs.existsSync(metadataPath) || !fs.existsSync(instructionsPath)) throw new Error(`Core not found: ${name}`);
  return { coreDir, metadataPath, instructionsPath, metadata: JSON.parse(fs.readFileSync(metadataPath, 'utf8')) };
}

function createCore(name, scope = 'personal') {
  validateCoreName(name);
  if (!['personal', 'company', 'team', 'workspace'].includes(scope)) throw new Error('Core scope must be personal, company, team, or workspace.');
  const coreDir = path.join(getCoreHome(), name);
  if (fs.existsSync(coreDir)) throw new Error(`Core already exists: ${name}`);
  fs.mkdirSync(coreDir, { recursive: true });
  fs.writeFileSync(path.join(coreDir, 'agentic-core.json'), JSON.stringify({ schemaVersion: 1, name, scope, createdAt: new Date().toISOString() }, null, 2) + '\n');
  const coreTemplate = fs.readFileSync(path.join(CORE_ROOT, 'templates/core/AGENTS.md'), 'utf8');
  fs.writeFileSync(path.join(coreDir, 'AGENTS.md'), coreTemplate.replaceAll('{{CORE_NAME}}', name));
  console.log(`Created Core: ${name} (${scope})`);
}

async function createCoreTui() {
  if (!process.stdin.isTTY) {
    const [name, scope = 'personal'] = fs.readFileSync(0, 'utf8').split(/\r?\n/).map(value => value.trim());
    createCore(name, scope || 'personal');
    return;
  }
  intro('Agentic Core 생성');
  const name = await text({
    message: 'Core 이름을 입력하세요.',
    placeholder: 'company-main',
    validate(value) {
      if (!value.trim() || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.trim())) return '영문 소문자, 숫자, 하이픈으로 1-64자를 입력하세요.';
    }
  });
  if (isCancel(name)) return cancel('Core 생성을 취소했습니다.');
  const scope = await select({
    message: 'Core의 용도를 선택하세요.',
    options: scopeOptions
  });
  if (isCancel(scope)) return cancel('Core 생성을 취소했습니다.');
  const selectedScope = scopeOptions.find(option => option.value === scope);
  note(`${name.trim()}
${selectedScope.label} — ${selectedScope.hint}`, '생성할 Core');
  const approved = await confirm({ message: '이 Core를 생성할까요?', initialValue: true });
  if (isCancel(approved) || !approved) return cancel('Core 생성을 취소했습니다.');
  createCore(name.trim(), scope);
  outro('Core가 생성되었습니다.');
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
      cores.push(metadata);
    } catch {}
  }
  return cores.sort((a, b) => `${a.scope}:${a.name}`.localeCompare(`${b.scope}:${b.name}`));
}

function listCores() {
  const cores = getCores();
  if (!cores.length) {
    console.log('No Cores found. Run `agentic core create` to create one.');
    return;
  }
  const grouped = new Map();
  for (const metadata of cores) {
    if (!grouped.has(metadata.scope)) grouped.set(metadata.scope, []);
    grouped.get(metadata.scope).push(metadata.name);
  }
  if (process.stdout.isTTY) {
    intro('Agentic Cores');
    for (const [scope, names] of grouped) note(names.join('\n'), scope);
    outro(`${cores.length}개의 Core`);
    return;
  }
  for (const [scope, names] of grouped) {
    console.log(`[${scope}]`);
    for (const name of names) console.log(`  ${name}`);
  }
}

function removeCore(name) {
  const core = readCore(name);
  fs.rmSync(core.coreDir, { recursive: true, force: true });
  console.log(`Removed Core: ${name}`);
}

async function removeCoreTui(name = null) {
  if (!process.stdin.isTTY) throw new Error('core remove requires <name> --yes outside a TUI terminal.');
  intro('Agentic Core 삭제');
  const cores = getCores();
  if (!cores.length) throw new Error('No Cores found.');
  if (!name) {
    const selected = await select({
      message: '삭제할 Core를 선택하세요.',
      options: cores.map(core => ({ value: core.name, label: `${core.scope} · ${core.name}`, hint: 'Core 원본과 설정만 삭제' }))
    });
    if (isCancel(selected)) return cancel('Core 삭제를 취소했습니다.');
    name = selected;
  }
  const core = readCore(name);
  note(`${core.metadata.scope} · ${name}\n프로젝트에 이미 적용된 파일은 변경되지 않습니다.`, '삭제 대상');
  const approved = await confirm({ message: '이 Core를 영구 삭제할까요?', initialValue: false });
  if (isCancel(approved) || !approved) return cancel('Core 삭제를 취소했습니다.');
  removeCore(name);
  outro('Core가 삭제되었습니다.');
}

const guidanceDefaults = { harness: 'recommended', tdd: 'recommended', review: 'recommended', verification: 'recommended', documentation: 'recommended', security: 'recommended' };
const guidanceLabels = { harness: '하네스 동작', tdd: 'TDD', review: '리뷰', verification: '검증', documentation: '문서화', security: '보안' };
const guidanceDescriptions = {
  harness: '작업을 계획하고 실제 검증 결과를 보고하는 기본 작업 방식',
  tdd: '실패 테스트부터 시작하는 Red-Green-Refactor 개발 방식',
  review: '변경 범위와 위험을 확인하는 리뷰 방식',
  verification: '프로젝트의 검증 명령을 실행하고 결과를 기록하는 방식',
  documentation: '계약·정책·구조 변경을 정본 문서에 반영하는 방식',
  security: '비밀값 보호와 외부 변경 승인에 관한 규칙'
};
const scopeOptions = [
  { value: 'personal', label: 'Personal', hint: '개인 공통 지침' },
  { value: 'company', label: 'Company', hint: '회사 공통 지침' },
  { value: 'team', label: 'Team', hint: '팀 공통 지침' },
  { value: 'workspace', label: 'Workspace', hint: '작업공간 공통 지침' }
];
const levelOptions = [
  { value: 'off', label: 'Off', hint: '이 지침을 Core에 포함하지 않음' },
  { value: 'recommended', label: 'Recommended', hint: '일반적으로 권장되는 수준' },
  { value: 'strict', label: 'Strict', hint: '항상 엄격하게 적용하는 수준' }
];
const guidanceSections = {
  harness: ['하네스 동작', '작업을 작은 단위로 계획하고, 변경 후 프로젝트의 검증 명령을 실행해 실제 결과를 보고한다.'],
  tdd: ['TDD', 'strict이면 Red-Green-Refactor를 따르고, recommended이면 가능한 경우 실패 테스트부터 작성한다.'],
  review: ['리뷰', '변경 범위와 위험을 검토하고, 설정된 경우 독립적인 리뷰 결과를 남긴다.'],
  verification: ['검증', '프로젝트가 선택한 검증 명령을 실행한다. 실행 결과는 실행 사실이며 품질 전체의 증명이 아님을 명시한다.'],
  documentation: ['문서화', '사용자에게 영향을 주는 계약·정책·구조 변경은 관련 정본 문서와 함께 갱신한다.'],
  security: ['보안', '비밀값을 출력·커밋하지 않고, 외부 변경과 권한이 필요한 작업은 사용자 승인을 받는다.']
};

function setupCore(name, values) {
  const core = readCore(name);
  const settings = {};
  for (const key of Object.keys(guidanceDefaults)) {
    const value = parseFlag(values, key, core.metadata.settings?.[key] || guidanceDefaults[key]);
    if (!['off', 'recommended', 'strict'].includes(value)) throw new Error(`--${key} must be off, recommended, or strict.`);
    settings[key] = value;
  }
  const blocks = Object.entries(settings).filter(([, value]) => value !== 'off').map(([key, value]) => {
    const [title, text] = guidanceSections[key];
    return `## ${title}\n\n- 적용 수준: ${value}\n- ${text}`;
  });
  const start = '<!-- agentic:guidance:start -->';
  const end = '<!-- agentic:guidance:end -->';
  const block = `${start}\n\n${blocks.join('\n\n')}\n\n${end}`;
  const current = fs.readFileSync(core.instructionsPath, 'utf8');
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  fs.writeFileSync(core.instructionsPath, (pattern.test(current) ? current.replace(pattern, block) : `${current.trimEnd()}\n\n${block}\n`));
  fs.writeFileSync(core.metadataPath, JSON.stringify({ ...core.metadata, settings, updatedAt: new Date().toISOString() }, null, 2) + '\n');
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
  intro('Agentic Core 지침 설정');
  const cores = getCores();
  if (!name) {
    if (!cores.length) throw new Error('No Cores found. Run `agentic core create` first.');
    const selected = await select({
      message: '설정할 Core를 선택하세요.',
      options: cores.map(core => ({ value: core.name, label: `${core.scope} · ${core.name}`, hint: '공통 지침을 설정할 Core' }))
    });
    if (isCancel(selected)) return cancel('Core 설정을 취소했습니다.');
    name = selected;
  }
  const core = readCore(name);
  const values = [];
  for (const key of Object.keys(guidanceDefaults)) {
    const current = core.metadata.settings?.[key] || guidanceDefaults[key];
    const value = await select({
      message: `${guidanceLabels[key]} — ${guidanceDescriptions[key]}`,
      options: levelOptions,
      initialValue: current
    });
    if (isCancel(value)) return cancel('Core 설정을 취소했습니다.');
    values.push(`--${key}`, value);
  }
  const summary = Object.keys(guidanceDefaults)
    .map(key => `${guidanceLabels[key]}: ${values[values.indexOf(`--${key}`) + 1]}`)
    .join('\n');
  note(summary, `${name}에 적용할 지침`);
  const approved = await confirm({ message: '이 설정을 Core에 저장할까요?', initialValue: true });
  if (isCancel(approved) || !approved) return cancel('Core 설정을 취소했습니다.');
  setupCore(name, values);
  outro('Core 지침이 설정되었습니다.');
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
  return `${content}\n\n> Applied from Agentic Core: ${core.metadata.name}\n\n## Project context\n\n* **Project:** ${projectName}\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n이 프로젝트에만 적용되는 도메인 규칙은 이 섹션 아래에 추가한다. Core에는 역으로 동기화하지 않는다.\n`;
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

function copyAdapter(template, target, projectName) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fs.readFileSync(template, 'utf8').replaceAll('{{PROJECT_NAME}}', projectName));
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
  if (!fs.existsSync(targetDir)) throw new Error(`Directory not found: ${targetDir}`);
  const core = readCore(coreName);
  const projectName = getProjectName(targetDir);
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  const agents = mergeAgentsMd(renderCoreAgents(core, projectName), fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : null);
  fs.writeFileSync(agentsPath, agents);
  for (const [source, target] of [
    ['templates/CLAUDE.md', 'CLAUDE.md'],
    ['templates/gemini-rules/agentic.md', '.gemini/rules/agentic.md'],
    ['templates/cursor-rules/agentic.mdc', '.cursor/rules/agentic.mdc'],
    ['templates/copilot-instructions.md', '.github/copilot-instructions.md']
  ]) copyAdapter(path.join(CORE_ROOT, source), path.join(targetDir, target), projectName);
  fs.writeFileSync(path.join(targetDir, 'agentic.project.json'), JSON.stringify({ schemaVersion: 1, core: coreName }, null, 2) + '\n');
  console.log(`Applied Core ${coreName} to ${targetDir}`);
}

function syncProject(values) {
  const { coreName, targetPath } = projectArgs(values);
  const targetDir = path.resolve(process.cwd(), targetPath);
  const selectionPath = path.join(targetDir, 'agentic.project.json');
  const selected = coreName || (fs.existsSync(selectionPath) ? JSON.parse(fs.readFileSync(selectionPath, 'utf8')).core : null);
  if (!selected) throw new Error('sync requires --core <name> or an existing agentic.project.json.');
  applyCore(['--core', selected, targetPath]);
}

function help() {
  const title = invokedAs === 'agt' ? 'agt (agentic)' : 'agentic (agt)';
  const commandName = invokedAs === 'agt' ? 'agt' : 'agentic';
  console.log(`${title} shared project guidance manager\n\n  ${commandName} core create [<name>] [--scope <scope>]\n  ${commandName} core list\n  ${commandName} core remove [<name>] [--yes]\n  ${commandName} setup [--core <name>] [--tdd <level>] [--review <level>] ...\n  ${commandName} init --core <name> <project>\n  ${commandName} sync [--core <name>] <project>\n\nUse either agentic or agt. Omit core create, setup, or remove options to use interactive TUI prompts.`);
}

async function main() {
  if (command === 'core' && args[1] === 'create') {
    if (args[2]) createCore(args[2], parseFlag(args.slice(3), 'scope', 'personal'));
    else await createCoreTui();
  } else if (command === 'core' && args[1] === 'remove') {
    const name = args[2];
    if (parseFlag(args.slice(3), 'yes', null) !== null) removeCore(name);
    else await removeCoreTui(name);
  }
  else if (command === 'core' && args[1] === 'list') listCores();
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
