#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';

const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-package-smoke-'));
const packDir = path.join(smokeRoot, 'pack');
const consumerDir = path.join(smokeRoot, 'consumer');
const profilesHome = path.join(smokeRoot, 'home');
const projectDir = path.join(smokeRoot, 'project');
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

function quoteWindowsArg(value: string): string {
  return /[\s"&|<>^]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

type RunOptions = Omit<ExecFileSyncOptionsWithStringEncoding, 'encoding'>;

/** Run a command and return its UTF-8 output; on Windows, npm and bin shims are `.cmd` files that need cmd.exe. */
function runCommand(command: string, args: string[], options: RunOptions = {}): string {
  if (!isWindows) return execFileSync(command, args, { ...options, encoding: 'utf8' });
  const commandToken = command.includes(' ') ? quoteWindowsArg(command) : command;
  const commandLine = [commandToken, ...args.map(quoteWindowsArg)].join(' ');
  return execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], {
    ...options,
    encoding: 'utf8'
  });
}

try {
  fs.mkdirSync(packDir);
  fs.mkdirSync(consumerDir);
  const packOutput = runCommand(npmCommand, ['pack', '--pack-destination', packDir, '--json']);
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = path.join(packDir, filename);
  runCommand(npmCommand, ['install', '--prefix', consumerDir, tarball], { stdio: 'ignore' });
  const agctx = path.join(consumerDir, 'node_modules', '.bin', isWindows ? 'agctx.cmd' : 'agctx');
  const env = { ...process.env, AGCTX_HOME: profilesHome };
  const help = runCommand(agctx, ['help'], { env });
  assert.match(help, /^agctx \(Agent Context Manager\)/);
  assert.match(help, /profile list \[--scope <scope>\]/);
  fs.mkdirSync(projectDir);
  runCommand(agctx, ['profile', 'create', 'smoke-profile', '--scope', 'workspace'], { env, stdio: 'ignore' });
  runCommand(agctx, ['profile', 'setup', 'smoke-profile', '--tdd', 'on'], { env, stdio: 'ignore' });
  runCommand(agctx, ['profile', 'apply', 'smoke-profile', projectDir, '--yes'], { env, stdio: 'ignore' });
  runCommand(agctx, ['profile', 'sync', projectDir, '--yes'], { env, stdio: 'ignore' });
  assert(fs.existsSync(path.join(profilesHome, 'profiles', 'smoke-profile', 'AGENTS.md')));
  assert(fs.existsSync(path.join(projectDir, 'AGENTS.md')));
  assert(fs.existsSync(path.join(projectDir, 'CLAUDE.md')));
  assert(fs.existsSync(path.join(projectDir, 'agctx.project.json')));
  // agctx install copies the skills shipped in the package, so they reach an agent's folder from the tarball alone.
  const userHome = path.join(smokeRoot, 'user-home');
  fs.mkdirSync(path.join(userHome, '.claude'), { recursive: true });
  runCommand(agctx, ['install'], { env: { ...env, HOME: userHome, USERPROFILE: userHome }, stdio: 'ignore' });
  assert(fs.existsSync(path.join(userHome, '.claude', 'skills', 'agctx', 'SKILL.md')));
  assert(fs.existsSync(path.join(userHome, '.claude', 'skills', 'agctx-author', '.agctx-install.json')));
  console.log(
    'Installed package smoke test passed (help, profile setup, project apply, sync, and agent skill install).'
  );
} finally {
  fs.rmSync(smokeRoot, { recursive: true, force: true });
}
