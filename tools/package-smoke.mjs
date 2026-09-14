#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-package-smoke-'));
const packDir = path.join(smokeRoot, 'pack');
const consumerDir = path.join(smokeRoot, 'consumer');
const profilesHome = path.join(smokeRoot, 'home');
const projectDir = path.join(smokeRoot, 'project');
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

function quoteWindowsArg(value) {
  const text = String(value);
  return /[\s"&|<>^]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function runCommand(command, args, options = {}) {
  if (!isWindows) return execFileSync(command, args, options);
  const commandToken = command.includes(' ') ? quoteWindowsArg(command) : command;
  const commandLine = [commandToken, ...args.map(quoteWindowsArg)].join(' ');
  return execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], options);
}

try {
  fs.mkdirSync(packDir);
  fs.mkdirSync(consumerDir);
  const packOutput = runCommand(npmCommand, ['pack', '--pack-destination', packDir, '--json'], { encoding: 'utf8' });
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = path.join(packDir, filename);
  runCommand(npmCommand, ['install', '--prefix', consumerDir, tarball], { stdio: 'ignore' });
  const agt = path.join(consumerDir, 'node_modules', '.bin', isWindows ? 'agt.cmd' : 'agt');
  const env = { ...process.env, AGENTIC_HOME: profilesHome };
  const help = runCommand(agt, ['help'], { encoding: 'utf8', env });
  assert.match(help, /agt \(agentic\) shared project guidance manager/);
  assert.match(help, /profile list \[--scope <scope>\]/);
  fs.mkdirSync(projectDir);
  runCommand(agt, ['profile', 'create', 'smoke-profile', '--scope', 'workspace'], { env, stdio: 'ignore' });
  runCommand(agt, ['profile', 'setup', 'smoke-profile', '--tdd', 'strict'], { env, stdio: 'ignore' });
  runCommand(agt, ['profile', 'apply', 'smoke-profile', projectDir], { env, stdio: 'ignore' });
  runCommand(agt, ['profile', 'sync', projectDir], { env, stdio: 'ignore' });
  assert(fs.existsSync(path.join(profilesHome, '.agentic', 'profiles', 'smoke-profile', 'AGENTS.md')));
  assert(fs.existsSync(path.join(projectDir, 'AGENTS.md')));
  assert(fs.existsSync(path.join(projectDir, 'CLAUDE.md')));
  assert(fs.existsSync(path.join(projectDir, 'agentic.project.json')));
  console.log('Installed package smoke test passed (help, profile setup, project apply, and sync).');
} finally {
  fs.rmSync(smokeRoot, { recursive: true, force: true });
}
