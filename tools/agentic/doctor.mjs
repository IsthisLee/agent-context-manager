#!/usr/bin/env node

/**
 * doctor.mjs - 프로젝트 환경 및 에이전트 지침 상태 진단 스크립트
 * 민감한 비밀값(토큰, .env)은 절대 출력하지 않음.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const cwd = process.cwd();
const report = {
  timestamp: new Date().toISOString(),
  projectPath: cwd,
  nodeVersion: process.version,
  checks: []
};

function addCheck(name, pass, detail) {
  report.checks.push({ name, status: pass ? 'PASS' : 'WARN', detail });
}

// 1. Git 확인
try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();
  addCheck('Git Repository', true, `On branch: ${branch}`);
} catch {
  addCheck('Git Repository', false, 'Not a git repository or git not found');
}

// 2. 에이전트 지침 파일 확인
const hasAgentsMd = fs.existsSync(path.join(cwd, 'AGENTS.md'));
const hasClaudeMd = fs.existsSync(path.join(cwd, 'CLAUDE.md'));
const hasGeminiRules = fs.existsSync(path.join(cwd, '.gemini', 'rules'));
const hasCursorRules = fs.existsSync(path.join(cwd, '.cursor', 'rules'));
const hasCopilotInstructions = fs.existsSync(path.join(cwd, '.github', 'copilot-instructions.md'));

addCheck('AGENTS.md (Codex)', hasAgentsMd, hasAgentsMd ? 'Present' : 'Missing');
if (hasAgentsMd) {
  const agentsContent = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf-8');
  const lineCount = agentsContent.split(/\r\n|\r|\n/).length;
  if (lineCount > 150) {
    addCheck('AGENTS.md Size', false, `${lineCount} lines (>150 lines: consider splitting detailed domain rules into docs/ to save LLM tokens)`);
  } else {
    addCheck('AGENTS.md Size', true, `${lineCount} lines (optimal)`);
  }
}
addCheck('CLAUDE.md (Claude Code)', hasClaudeMd, hasClaudeMd ? 'Present' : 'Missing');
addCheck('.gemini/rules (Antigravity)', hasGeminiRules, hasGeminiRules ? 'Present' : 'Missing');
addCheck('.cursor/rules (Cursor)', hasCursorRules, hasCursorRules ? 'Present' : 'Missing');
addCheck('.github/copilot-instructions.md (Copilot)', hasCopilotInstructions, hasCopilotInstructions ? 'Present' : 'Missing');

// 3. 의존성 확인 (package.json 있는 경우)
const pkgPath = path.join(cwd, 'package.json');
if (fs.existsSync(pkgPath)) {
  const hasNodeModules = fs.existsSync(path.join(cwd, 'node_modules'));
  addCheck('Dependencies', hasNodeModules, hasNodeModules ? 'node_modules present' : 'Run install command');
}

// 4. 출력
const isJson = process.argv.includes('--json');
if (isJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('=== Project Doctor Diagnostics ===');
  console.log(`Node: ${report.nodeVersion} | CWD: ${report.projectPath}`);
  console.log('-----------------------------------');
  for (const c of report.checks) {
    const icon = c.status === 'PASS' ? '✓' : '⚠';
    console.log(`${icon} [${c.status}] ${c.name}: ${c.detail}`);
  }
}
