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

test('core list ignores malformed Core metadata instead of presenting an invalid Core', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-core-invalid-metadata-test-'));

  try {
    const coreDir = path.join(home, '.agentic-cores', 'broken');
    fs.mkdirSync(coreDir, { recursive: true });
    fs.writeFileSync(path.join(coreDir, 'agentic-core.json'), JSON.stringify({ schemaVersion: 1, name: 'broken', scope: 'unknown' }));
    const output = execFileSync(process.execPath, [cli, 'core', 'list'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });
    assert.match(output, /No Cores found/);
    assert.doesNotMatch(output, /broken/);
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
    assert.equal(selection.schemaVersion, 1);
    assert.equal(selection.core, 'company');
    assert.deepEqual(Object.keys(selection.managedHashes).map(file => file.replaceAll(path.sep, '/')).sort(), [
      '.cursor/rules/agentic.mdc',
      '.gemini/rules/agentic.md',
      '.github/copilot-instructions.md',
      'AGENTS.md',
      'CLAUDE.md'
    ]);
    fs.appendFileSync(path.join(project, 'CLAUDE.md'), '\n## Local Claude guidance\n\nKeep this local workflow.\n');
    execFileSync(process.execPath, [cli, 'sync', project], { cwd: repoRoot, env });
    assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /Applied from Agentic Core: company/);
    assert.match(fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8'), /Keep this local workflow/);
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

test('init rejects a file path instead of treating it as a project directory', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-file-target-test-'));
  const target = path.join(home, 'not-a-project-directory');
  fs.writeFileSync(target, 'keep this file\n');

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'directory-check'], { cwd: repoRoot, env });
    const result = spawnSync(process.execPath, [cli, 'init', '--core', 'directory-check', target], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Project path is not a directory/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'keep this file\n');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync reports invalid project metadata without changing the project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-invalid-project-metadata-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'metadata-check'], { cwd: repoRoot, env });
    fs.writeFileSync(path.join(project, 'agentic.project.json'), '{ invalid json\n');
    const result = spawnSync(process.execPath, [cli, 'sync', project], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid project metadata/);
    assert.deepEqual(fs.readdirSync(project), ['agentic.project.json']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
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

test('init dry-run reports planned files without changing the project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-core-dry-run-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'dry-run-core', '--scope', 'workspace'], { cwd: repoRoot, env });
    const output = execFileSync(process.execPath, [cli, 'init', '--core', 'dry-run-core', '--dry-run', project], {
      cwd: repoRoot,
      env,
      encoding: 'utf8'
    });
    assert.match(output, /Dry-run: no files were changed/);
    assert.match(output, /AGENTS\.md/);
    assert.deepEqual(fs.readdirSync(project), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('init preflights all targets and leaves the project unchanged when an adapter is a symbolic link', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-preflight-symlink-test-'));
  const project = path.join(home, 'project');
  const outside = path.join(home, 'outside.md');
  fs.mkdirSync(path.join(project, '.gemini', 'rules'), { recursive: true });
  fs.writeFileSync(outside, 'outside content\n');

  try {
    try {
      fs.symlinkSync(outside, path.join(project, '.gemini', 'rules', 'agentic.md'));
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EACCES') return;
      throw error;
    }
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'preflight-core'], { cwd: repoRoot, env });
    const result = spawnSync(process.execPath, [cli, 'init', '--core', 'preflight-core', project], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /symbolic link/);
    assert.deepEqual(fs.readdirSync(project), ['.gemini']);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'outside content\n');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('init preflights adapter parent paths and leaves the project unchanged when a parent is a file', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-preflight-parent-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, '.gemini'), 'not a directory\n');

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'parent-check'], { cwd: repoRoot, env });
    const result = spawnSync(process.execPath, [cli, 'init', '--core', 'parent-check', project], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Parent path is not a directory/);
    assert.deepEqual(fs.readdirSync(project), ['.gemini']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync stops when an Agentic-managed block was manually changed', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-core-conflict-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'conflict-core'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'init', '--core', 'conflict-core', project], { cwd: repoRoot, env });
    const claudePath = path.join(project, 'CLAUDE.md');
    const original = fs.readFileSync(claudePath, 'utf8');
    fs.writeFileSync(claudePath, original.replace('Follow the selected', 'Manually changed'));
    const result = spawnSync(process.execPath, [cli, 'sync', project], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Managed file changed outside Agentic/);
    assert.match(fs.readFileSync(claudePath, 'utf8'), /Manually changed/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync stops when the Core-owned portion of AGENTS.md was manually changed', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-agents-conflict-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'core', 'create', 'agents-conflict'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'init', '--core', 'agents-conflict', project], { cwd: repoRoot, env });
    const agentsPath = path.join(project, 'AGENTS.md');
    const original = fs.readFileSync(agentsPath, 'utf8');
    fs.writeFileSync(agentsPath, original.replace('공통 에이전틱 개발 지침을 관리한다', 'Manually changed Core guidance'));
    const result = spawnSync(process.execPath, [cli, 'sync', project], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Managed file changed outside Agentic: AGENTS\.md/);
    assert.match(fs.readFileSync(agentsPath, 'utf8'), /Manually changed Core guidance/);
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

test('core remove requires a Core name when confirmation is supplied non-interactively', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-remove-approval-test-'));

  try {
    const result = spawnSync(process.execPath, [cli, 'core', 'remove', '--yes'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /core remove --yes requires <name>/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
