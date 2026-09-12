import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agentic.mjs');

test('core create creates a named scoped Core in the user Core directory', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-core-test-'));

  try {
    execFileSync(process.execPath, [cli, 'core', 'create', 'company', '--scope', 'company'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });

    const coreDir = path.join(home, '.agentic-cores', 'company');
    const metadata = JSON.parse(fs.readFileSync(path.join(coreDir, 'agentic-core.json'), 'utf8'));
    assert.equal(metadata.name, 'company');
    assert.equal(metadata.scope, 'company');
    assert.equal(metadata.schemaVersion, 1);
    const instructions = fs.readFileSync(path.join(coreDir, 'AGENTS.md'), 'utf8');
    assert.match(instructions, /Agentic Core: company/);
    assert.match(instructions, /공통 에이전틱 개발 지침을 관리한다/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('core list reports registered Cores without exposing paths as the identity', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-core-list-test-'));

  try {
    execFileSync(process.execPath, [cli, 'core', 'create', 'personal', '--scope', 'personal'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });
    const output = execFileSync(process.execPath, [cli, 'core', 'list'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });
    assert.match(output, /personal\s+personal/);
    assert.doesNotMatch(output, new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('setup applies selected guidance to the Core and preserves its project-independent boundary', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-core-setup-test-'));

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'team', '--scope', 'team'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [
      cli, 'setup', '--core', 'team',
      '--harness', 'recommended', '--tdd', 'strict', '--review', 'off',
      '--verification', 'recommended', '--documentation', 'off', '--security', 'strict'
    ], { cwd: repoRoot, env, encoding: 'utf8' });

    const coreDir = path.join(home, '.agentic-cores', 'team');
    const metadata = JSON.parse(fs.readFileSync(path.join(coreDir, 'agentic-core.json'), 'utf8'));
    assert.deepEqual(metadata.settings, {
      harness: 'recommended',
      tdd: 'strict',
      review: 'off',
      verification: 'recommended',
      documentation: 'off',
      security: 'strict'
    });
    const instructions = fs.readFileSync(path.join(coreDir, 'AGENTS.md'), 'utf8');
    assert.match(instructions, /## TDD/);
    assert.match(instructions, /strict/);
    assert.doesNotMatch(instructions, /## 리뷰/);
    assert.doesNotMatch(instructions, /## 문서화/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('init applies the selected Core to a project without changing the Core', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-core-apply-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'sample-project', version: '1.0.0' }));

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'company', '--scope', 'company'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'setup', '--core', 'company', '--tdd', 'strict'], { cwd: repoRoot, env });
    const coreAgentsBefore = fs.readFileSync(path.join(home, '.agentic-cores', 'company', 'AGENTS.md'), 'utf8');

    execFileSync(process.execPath, [cli, 'init', '--core', 'company', project], { cwd: repoRoot, env });

    const projectAgents = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    assert.match(projectAgents, /Agentic Core: company/);
    assert.match(projectAgents, /## TDD/);
    assert.match(projectAgents, /sample-project/);
    const selection = JSON.parse(fs.readFileSync(path.join(project, 'agentic.project.json'), 'utf8'));
    assert.deepEqual(selection, { schemaVersion: 1, core: 'company' });
    execFileSync(process.execPath, [cli, 'sync', project], { cwd: repoRoot, env });
    assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /Applied from Agentic Core: company/);
    assert.equal(fs.readFileSync(path.join(home, '.agentic-cores', 'company', 'AGENTS.md'), 'utf8'), coreAgentsBefore);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('init rejects an unknown Core before changing the target project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-core-invalid-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  const packageJson = JSON.stringify({ name: 'untouched-project', version: '1.0.0' }, null, 2);
  fs.writeFileSync(path.join(project, 'package.json'), packageJson);

  try {
    const result = execFileSync(process.execPath, [cli, 'init', '--core', 'missing', project], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    assert.fail(`expected failure, got ${result}`);
  } catch (error) {
    assert.equal(error.status, 1);
    assert.match(error.stderr, /Core not found: missing/);
  }
  assert.equal(fs.readFileSync(path.join(project, 'package.json'), 'utf8'), packageJson);
  assert.deepEqual(fs.readdirSync(project), ['package.json']);
  fs.rmSync(home, { recursive: true, force: true });
});
