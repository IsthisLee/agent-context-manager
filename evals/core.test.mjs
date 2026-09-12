import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
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
    assert.match(output, /\[personal\]\s+personal/);
    assert.doesNotMatch(output, new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('core list can filter registered Cores by scope', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-core-scope-list-test-'));

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'personal-main', '--scope', 'personal'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'core', 'create', 'company-main', '--scope', 'company'], { cwd: repoRoot, env });
    const output = execFileSync(process.execPath, [cli, 'core', 'list', '--scope', 'company'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8'
    });
    assert.match(output, /\[company\]\s+company-main/);
    assert.doesNotMatch(output, /personal-main/);
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

test('init preserves an existing AGENTS.md that has no Agentic extension section', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-core-existing-agents-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'AGENTS.md'), '# Existing project guidance\n\n- Keep the API backwards compatible.\n');

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'team-core', '--scope', 'team'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'init', '--core', 'team-core', project], { cwd: repoRoot, env });
    const agents = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    assert.match(agents, /Agentic Core: team-core/);
    assert.match(agents, /Existing project guidance/);
    assert.match(agents, /Keep the API backwards compatible/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('core create and setup support interactive TUI input when options are omitted', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-tui-test-'));
  const env = { ...process.env, AGENTIC_HOME: home };

  try {
    const create = spawnSync(process.execPath, [cli, 'core', 'create'], {
      cwd: repoRoot,
      env,
      input: 'company-main\ncompany\n',
      encoding: 'utf8'
    });
    assert.equal(create.status, 0, create.stderr);

    const setup = spawnSync(process.execPath, [cli, 'setup', '--core', 'company-main'], {
      cwd: repoRoot,
      env,
      input: 'recommended\nstrict\noff\nrecommended\noff\nstrict\n',
      encoding: 'utf8'
    });
    assert.equal(setup.status, 0, setup.stderr);

    const metadata = JSON.parse(fs.readFileSync(path.join(home, '.agentic-cores', 'company-main', 'agentic-core.json'), 'utf8'));
    assert.deepEqual(metadata.settings, {
      harness: 'recommended',
      tdd: 'strict',
      review: 'off',
      verification: 'recommended',
      documentation: 'off',
      security: 'strict'
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('setup without a Core option lets the user choose a scope-grouped Core in the TUI', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-tui-select-test-'));
  const env = { ...process.env, AGENTIC_HOME: home };

  try {
    execFileSync(process.execPath, [cli, 'core', 'create', 'personal-main', '--scope', 'personal'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'core', 'create', 'company-main', '--scope', 'company'], { cwd: repoRoot, env });
    const setup = spawnSync(process.execPath, [cli, 'setup'], {
      cwd: repoRoot,
      env,
      input: '1\nrecommended\nrecommended\nrecommended\nstrict\noff\nrecommended\n',
      encoding: 'utf8'
    });
    assert.equal(setup.status, 0, setup.stderr);

    const metadata = JSON.parse(fs.readFileSync(path.join(home, '.agentic-cores', 'company-main', 'agentic-core.json'), 'utf8'));
    assert.equal(metadata.settings.verification, 'strict');
    assert.equal(metadata.settings.documentation, 'off');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('agt is an alias for the agentic CLI', () => {
  const result = spawnSync(process.execPath, [path.join(repoRoot, 'bin', 'agt.mjs'), 'help'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /agt \(agentic\) shared project guidance manager/);
  assert.match(result.stdout, /agt core create/);
  assert.doesNotMatch(result.stdout, /  agentic core create/);

  const primary = spawnSync(process.execPath, [cli, 'help'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(primary.status, 0, primary.stderr);
  assert.match(primary.stdout, /agentic \(agt\) shared project guidance manager/);
  assert.match(primary.stdout, /agentic core create/);
});

test('core remove deletes only the selected Core and preserves an applied project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-core-remove-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'company', '--scope', 'company'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'init', '--core', 'company', project], { cwd: repoRoot, env });
    const view = execFileSync(process.execPath, [cli, 'core', 'view', 'company'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.match(view, /company\s+company/);
    execFileSync(process.execPath, [cli, 'core', 'remove', 'company', '--yes'], { cwd: repoRoot, env });

    assert.equal(fs.existsSync(path.join(home, '.agentic-cores', 'company')), false);
    assert.equal(fs.existsSync(path.join(project, 'AGENTS.md')), true);
    assert.equal(fs.existsSync(path.join(project, 'agentic.project.json')), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
