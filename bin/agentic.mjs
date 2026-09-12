#!/usr/bin/env node

/**
 * agentic CLI - Cross-Agent Development Harness & Synchronizer
 * Generates and synchronizes multi-agent directives (Codex, Claude, Antigravity)
 * and deterministic verification tools for any target project.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { detectProjectConstraints, mergeAgentsMd, ensureTestSetup } from './analyzer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORE_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const command = args[0] || 'help';

function printHelp() {
  console.log(`
Agentic CLI - Cross-Agent Harness & Verification Kit
===================================================

사용법:
  agentic init [경로]      대상 프로젝트에 에이전트 지침(AGENTS, CLAUDE, Gemini) 및 검증 도구 설치
  agentic sync [경로]      Core 최신 SSOT 규칙을 대상 프로젝트에 동기화
  agentic doctor [경로]    대상 프로젝트의 에이전트 지침 및 환경 진단
  agentic check [경로]     프로젝트 검증 명령 실행 (TDD 테스트 & 증거 생성)
  agentic help             도움말 출력

예시:
  npx agentic init /Users/isthis/Documents/task/EJE
  node ./bin/agentic.mjs sync .
`);
}

function getProjectMeta(targetDir) {
  const pkgPath = path.join(targetDir, 'package.json');
  let name = path.basename(targetDir);
  let verifyCmd = 'npm test';
  let startCmd = 'npm start';

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) name = pkg.name;
      if (pkg.scripts) {
        if (pkg.scripts.check) verifyCmd = 'npm run check';
        else if (pkg.scripts.test) verifyCmd = 'npm test';
        if (pkg.scripts.dev) startCmd = 'npm run dev';
      }
    } catch {}
  }

  const constraints = detectProjectConstraints(targetDir);

  return { name, verifyCmd, startCmd, constraints };
}

function renderTemplate(templatePath, data) {
  let content = fs.readFileSync(templatePath, 'utf-8');
  content = content.replaceAll('{{PROJECT_NAME}}', data.name);
  content = content.replaceAll('{{VERIFY_COMMAND}}', data.verifyCmd);
  content = content.replaceAll('{{START_COMMAND}}', data.startCmd);
  content = content.replaceAll('{{PROJECT_CONSTRAINTS}}', data.constraints || '* 특별한 제약이 감지되지 않았습니다.');
  return content;
}

function copyOrUpdateFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function ensureGitignore(targetDir) {
  const gitignorePath = path.join(targetDir, '.gitignore');
  const entriesToEnsure = ['.agentic/runs/', '.agentic/last-check.json', '.DS_Store'];
  let current = '';
  if (fs.existsSync(gitignorePath)) {
    current = fs.readFileSync(gitignorePath, 'utf-8');
  }

  const missing = entriesToEnsure.filter(e => !current.includes(e));
  if (missing.length > 0) {
    const toAppend = '\n# Agentic artifacts\n' + missing.join('\n') + '\n';
    fs.appendFileSync(gitignorePath, toAppend);
    console.log(`  ✓ Updated .gitignore in ${targetDir}`);
  }
}

function ensurePackageScripts(targetDir) {
  const pkgPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    if (!pkg.scripts) pkg.scripts = {};
    if (!pkg.scripts.check) {
      pkg.scripts.check = 'node tools/agentic/check.mjs';
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`  ✓ Registered "check": "node tools/agentic/check.mjs" in package.json`);
    }
  } catch {}
}


function syncProject(targetPath = '.') {
  const targetDir = path.resolve(process.cwd(), targetPath);
  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Directory not found: ${targetDir}`);
    process.exit(1);
  }

  // Ensure test framework & scripts setup (Cold Start protection)
  ensureTestSetup(targetDir);
  ensurePackageScripts(targetDir);

  const meta = getProjectMeta(targetDir);
  console.log(`\n🚀 [Agentic] Syncing harness to: ${targetDir} (${meta.name})\n`);

  // 1. AGENTS.md
  const agentsTmpl = path.join(CORE_ROOT, 'templates', 'AGENTS.md');
  const agentsOut = path.join(targetDir, 'AGENTS.md');
  let agentsContent = renderTemplate(agentsTmpl, meta);
  if (fs.existsSync(agentsOut)) {
    const existingContent = fs.readFileSync(agentsOut, 'utf-8');
    agentsContent = mergeAgentsMd(agentsContent, existingContent);
  }
  fs.writeFileSync(agentsOut, agentsContent);
  console.log(`  ✓ Generated AGENTS.md (for Codex / Copilot)`);

  // 2. CLAUDE.md
  const claudeTmpl = path.join(CORE_ROOT, 'templates', 'CLAUDE.md');
  const claudeOut = path.join(targetDir, 'CLAUDE.md');
  fs.writeFileSync(claudeOut, renderTemplate(claudeTmpl, meta));
  console.log(`  ✓ Generated CLAUDE.md (for Claude Code)`);

  // 3. .gemini/rules/agentic.md (Antigravity)
  const geminiTmpl = path.join(CORE_ROOT, 'templates', 'gemini-rules', 'agentic.md');
  const geminiOut = path.join(targetDir, '.gemini', 'rules', 'agentic.md');
  const geminiDir = path.dirname(geminiOut);
  if (!fs.existsSync(geminiDir)) fs.mkdirSync(geminiDir, { recursive: true });
  fs.writeFileSync(geminiOut, renderTemplate(geminiTmpl, meta));
  console.log(`  ✓ Generated .gemini/rules/agentic.md (for Antigravity)`);

  // 4. .cursor/rules/agentic.mdc (Cursor)
  const cursorTmpl = path.join(CORE_ROOT, 'templates', 'cursor-rules', 'agentic.mdc');
  const cursorOut = path.join(targetDir, '.cursor', 'rules', 'agentic.mdc');
  const cursorDir = path.dirname(cursorOut);
  if (!fs.existsSync(cursorDir)) fs.mkdirSync(cursorDir, { recursive: true });
  fs.writeFileSync(cursorOut, renderTemplate(cursorTmpl, meta));
  console.log(`  ✓ Generated .cursor/rules/agentic.mdc (for Cursor)`);

  // 5. .github/copilot-instructions.md (GitHub Copilot)
  const copilotTmpl = path.join(CORE_ROOT, 'templates', 'copilot-instructions.md');
  const copilotOut = path.join(targetDir, '.github', 'copilot-instructions.md');
  const copilotDir = path.dirname(copilotOut);
  if (!fs.existsSync(copilotDir)) fs.mkdirSync(copilotDir, { recursive: true });
  fs.writeFileSync(copilotOut, renderTemplate(copilotTmpl, meta));
  console.log(`  ✓ Generated .github/copilot-instructions.md (for GitHub Copilot)`);

  // 6. tools/agentic/doctor.mjs & check.mjs
  const toolsDir = path.join(targetDir, 'tools', 'agentic');
  copyOrUpdateFile(path.join(CORE_ROOT, 'templates', 'tools', 'doctor.mjs'), path.join(toolsDir, 'doctor.mjs'));
  copyOrUpdateFile(path.join(CORE_ROOT, 'templates', 'tools', 'check.mjs'), path.join(toolsDir, 'check.mjs'));
  console.log(`  ✓ Installed tools/agentic/doctor.mjs & check.mjs`);

  // 7. Update .gitignore
  ensureGitignore(targetDir);

  // 8. Register "check" script in package.json if present
  ensurePackageScripts(targetDir);

  console.log(`\n✨ Successfully initialized multi-agent harness in ${meta.name}!\n`);
}

function runDoctor(targetPath = '.') {
  const targetDir = path.resolve(process.cwd(), targetPath);
  const doctorScript = path.join(targetDir, 'tools', 'agentic', 'doctor.mjs');
  if (!fs.existsSync(doctorScript)) {
    console.error(`Error: tools/agentic/doctor.mjs not found. Run 'agentic init' first.`);
    process.exit(1);
  }
  spawnSync('node', [doctorScript, ...args.slice(1)], { cwd: targetDir, stdio: 'inherit' });
}

function runCheck(targetPath = '.') {
  const targetDir = path.resolve(process.cwd(), targetPath);
  const checkScript = path.join(targetDir, 'tools', 'agentic', 'check.mjs');
  if (!fs.existsSync(checkScript)) {
    console.error(`Error: tools/agentic/check.mjs not found. Run 'agentic init' first.`);
    process.exit(1);
  }
  const res = spawnSync('node', [checkScript, ...args.slice(1)], { cwd: targetDir, stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

switch (command) {
  case 'init':
  case 'sync':
    syncProject(args[1]);
    break;
  case 'doctor':
    runDoctor(args[1]);
    break;
  case 'check':
    runCheck(args[1]);
    break;
  case 'help':
  case '--help':
  case '-h':
  default:
    printHelp();
    break;
}
