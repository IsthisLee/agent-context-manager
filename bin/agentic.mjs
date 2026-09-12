#!/usr/bin/env node

/** Agentic Core and project guidance manager. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeAgentsMd } from './analyzer.mjs';

const CORE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const command = args[0] || 'help';

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

function listCores() {
  const home = getCoreHome();
  if (!fs.existsSync(home)) return;
  for (const name of fs.readdirSync(home).sort()) {
    const metadataPath = path.join(home, name, 'agentic-core.json');
    if (!fs.existsSync(metadataPath)) continue;
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      console.log(`${metadata.name}\t${metadata.scope}`);
    } catch {}
  }
}

const guidanceDefaults = { harness: 'recommended', tdd: 'recommended', review: 'recommended', verification: 'recommended', documentation: 'recommended', security: 'recommended' };
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
  console.log(`Agentic shared project guidance manager\n\n  agentic core create <name> [--scope <scope>]\n  agentic core list\n  agentic setup --core <name> [--tdd <level>] [--review <level>] ...\n  agentic init --core <name> <project>\n  agentic sync [--core <name>] <project>`);
}

try {
  if (command === 'core' && args[1] === 'create') createCore(args[2], parseFlag(args.slice(3), 'scope', 'personal'));
  else if (command === 'core' && args[1] === 'list') listCores();
  else if (command === 'setup') {
    const name = parseFlag(args.slice(1), 'core');
    if (!name) throw new Error('setup requires --core <name>.');
    setupCore(name, args.slice(1));
  } else if (command === 'init') applyCore(args.slice(1));
  else if (command === 'sync') syncProject(args.slice(1));
  else help();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
