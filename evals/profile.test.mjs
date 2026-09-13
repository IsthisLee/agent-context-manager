import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agentic.mjs');

test('profile create creates a named scoped profile in the user profile directory', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-test-'));

  try {
    execFileSync(process.execPath, [cli, 'profile', 'create', 'company', '--scope', 'company'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });

    const profileDir = path.join(home, '.agentic-profiles', 'company');
    const metadata = JSON.parse(fs.readFileSync(path.join(profileDir, 'agentic-profile.json'), 'utf8'));
    assert.equal(metadata.name, 'company');
    assert.equal(metadata.scope, 'company');
    assert.equal(metadata.schemaVersion, 1);
    const instructions = fs.readFileSync(path.join(profileDir, 'AGENTS.md'), 'utf8');
    assert.match(instructions, /Agentic Profile: company/);
    assert.match(instructions, /공통 에이전틱 개발 지침을 관리한다/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('profile list reports registered profiles without exposing paths as the identity', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-list-test-'));

  try {
    execFileSync(process.execPath, [cli, 'profile', 'create', 'personal', '--scope', 'personal'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });
    const output = execFileSync(process.execPath, [cli, 'profile', 'list'], {
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

test('profile list can filter registered profiles by scope', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-scope-list-test-'));

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'personal-main', '--scope', 'personal'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'create', 'company-main', '--scope', 'company'], { cwd: repoRoot, env });
    const output = execFileSync(process.execPath, [cli, 'profile', 'list', '--scope', 'company'], {
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

test('profile list ignores malformed metadata instead of presenting an invalid profile', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-invalid-metadata-test-'));

  try {
    const profileDir = path.join(home, '.agentic-profiles', 'broken');
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(path.join(profileDir, 'agentic-profile.json'), JSON.stringify({ schemaVersion: 1, name: 'broken', scope: 'unknown' }));
    const output = execFileSync(process.execPath, [cli, 'profile', 'list'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });
    assert.match(output, /No profiles found/);
    assert.doesNotMatch(output, /broken/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a legacy .agentic-cores home migrates to .agentic-profiles on first use', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-migrate-test-'));

  try {
    const legacyDir = path.join(home, '.agentic-cores', 'legacy');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'agentic-core.json'), JSON.stringify({ schemaVersion: 1, name: 'legacy', scope: 'team' }, null, 2) + '\n');
    fs.writeFileSync(path.join(legacyDir, 'AGENTS.md'), '# Agentic Profile: legacy\n');

    const output = execFileSync(process.execPath, [cli, 'profile', 'list'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });

    assert.match(output, /\[team\]\s+legacy/);
    assert.equal(fs.existsSync(path.join(home, '.agentic-cores')), false);
    assert.equal(fs.existsSync(path.join(home, '.agentic-profiles', 'legacy', 'agentic-profile.json')), true);
    assert.equal(fs.existsSync(path.join(home, '.agentic-profiles', 'legacy', 'agentic-core.json')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('setup applies selected guidance to the profile and preserves its project-independent boundary', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-setup-test-'));

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'team', '--scope', 'team'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [
      cli, 'profile', 'setup', 'team',
      '--harness', 'recommended', '--tdd', 'strict', '--review', 'off',
      '--verification', 'recommended', '--documentation', 'off', '--security', 'strict'
    ], { cwd: repoRoot, env, encoding: 'utf8' });

    const profileDir = path.join(home, '.agentic-profiles', 'team');
    const metadata = JSON.parse(fs.readFileSync(path.join(profileDir, 'agentic-profile.json'), 'utf8'));
    assert.deepEqual(metadata.settings, {
      harness: 'recommended',
      tdd: 'strict',
      review: 'off',
      verification: 'recommended',
      documentation: 'off',
      security: 'strict'
    });
    const instructions = fs.readFileSync(path.join(profileDir, 'AGENTS.md'), 'utf8');
    assert.match(instructions, /## TDD/);
    assert.match(instructions, /strict/);
    assert.doesNotMatch(instructions, /## 리뷰/);
    assert.doesNotMatch(instructions, /## 문서화/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply applies the selected profile to a project without changing the profile', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-apply-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'sample-project', version: '1.0.0' }));

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'company', '--scope', 'company'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'setup', 'company', '--tdd', 'strict'], { cwd: repoRoot, env });
    const profileAgentsBefore = fs.readFileSync(path.join(home, '.agentic-profiles', 'company', 'AGENTS.md'), 'utf8');

    execFileSync(process.execPath, [cli, 'profile', 'apply', 'company', project], { cwd: repoRoot, env });

    const projectAgents = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    assert.match(projectAgents, /Agentic Profile: company/);
    assert.match(projectAgents, /## TDD/);
    assert.match(projectAgents, /sample-project/);
    const selection = JSON.parse(fs.readFileSync(path.join(project, 'agentic.project.json'), 'utf8'));
    assert.equal(selection.schemaVersion, 1);
    assert.equal(selection.profile, 'company');
    assert.deepEqual(Object.keys(selection.managedHashes).map(file => file.replaceAll(path.sep, '/')).sort(), [
      '.agents/rules/agentic.md',
      '.cursor/rules/agentic.mdc',
      '.github/copilot-instructions.md',
      'AGENTS.md',
      'CLAUDE.md'
    ]);
    fs.appendFileSync(path.join(project, 'CLAUDE.md'), '\n## Local Claude guidance\n\nKeep this local workflow.\n');
    execFileSync(process.execPath, [cli, 'profile', 'sync', project], { cwd: repoRoot, env });
    assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /Applied from Agentic Profile: company/);
    assert.match(fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8'), /Keep this local workflow/);
    assert.equal(fs.readFileSync(path.join(home, '.agentic-profiles', 'company', 'AGENTS.md'), 'utf8'), profileAgentsBefore);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply requires a profile name', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-apply-no-name-test-'));

  try {
    const result = spawnSync(process.execPath, [cli, 'profile', 'apply'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /profile apply requires <name> <project>/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply rejects an unknown profile before changing the target project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-invalid-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  const packageJson = JSON.stringify({ name: 'untouched-project', version: '1.0.0' }, null, 2);
  fs.writeFileSync(path.join(project, 'package.json'), packageJson);

  try {
    const result = execFileSync(process.execPath, [cli, 'profile', 'apply', 'missing', project], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    assert.fail(`expected failure, got ${result}`);
  } catch (error) {
    assert.equal(error.status, 1);
    assert.match(error.stderr, /Profile not found: missing/);
  }
  assert.equal(fs.readFileSync(path.join(project, 'package.json'), 'utf8'), packageJson);
  assert.deepEqual(fs.readdirSync(project), ['package.json']);
  fs.rmSync(home, { recursive: true, force: true });
});

test('apply rejects a file path instead of treating it as a project directory', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-file-target-test-'));
  const target = path.join(home, 'not-a-project-directory');
  fs.writeFileSync(target, 'keep this file\n');

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'directory-check'], { cwd: repoRoot, env });
    const result = spawnSync(process.execPath, [cli, 'profile', 'apply', 'directory-check', target], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Project path is not a directory/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'keep this file\n');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync refuses to switch the bound profile', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-sync-no-switch-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'bound'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'create', 'other'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'apply', 'bound', project], { cwd: repoRoot, env });

    const positional = spawnSync(process.execPath, [cli, 'profile', 'sync', project, 'other'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(positional.status, 1);
    assert.match(positional.stderr, /profile sync takes only <project>/);

    const flagged = spawnSync(process.execPath, [cli, 'profile', 'sync', project, '--profile', 'other'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(flagged.status, 1);
    assert.match(flagged.stderr, /does not switch profiles/);

    const selection = JSON.parse(fs.readFileSync(path.join(project, 'agentic.project.json'), 'utf8'));
    assert.equal(selection.profile, 'bound');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync requires a project that was already applied', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-sync-unapplied-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const result = spawnSync(process.execPath, [cli, 'profile', 'sync', project], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /profile sync requires a project already applied/);
    assert.deepEqual(fs.readdirSync(project), []);
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
    execFileSync(process.execPath, [cli, 'profile', 'create', 'metadata-check'], { cwd: repoRoot, env });
    fs.writeFileSync(path.join(project, 'agentic.project.json'), '{ invalid json\n');
    const result = spawnSync(process.execPath, [cli, 'profile', 'sync', project], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid project metadata/);
    assert.deepEqual(fs.readdirSync(project), ['agentic.project.json']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply preserves an existing AGENTS.md that has no Agentic extension section', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-existing-agents-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'AGENTS.md'), '# Existing project guidance\n\n- Keep the API backwards compatible.\n');

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'team-profile', '--scope', 'team'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'apply', 'team-profile', project], { cwd: repoRoot, env });
    const agents = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    assert.match(agents, /Agentic Profile: team-profile/);
    assert.match(agents, /Existing project guidance/);
    assert.match(agents, /Keep the API backwards compatible/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply dry-run reports planned files without changing the project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-dry-run-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'dry-run-profile', '--scope', 'workspace'], { cwd: repoRoot, env });
    const output = execFileSync(process.execPath, [cli, 'profile', 'apply', 'dry-run-profile', '--dry-run', project], {
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

test('apply preflights all targets and leaves the project unchanged when an adapter is a symbolic link', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-preflight-symlink-test-'));
  const project = path.join(home, 'project');
  const outside = path.join(home, 'outside.md');
  fs.mkdirSync(path.join(project, '.agents', 'rules'), { recursive: true });
  fs.writeFileSync(outside, 'outside content\n');

  try {
    try {
      fs.symlinkSync(outside, path.join(project, '.agents', 'rules', 'agentic.md'));
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EACCES') return;
      throw error;
    }
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'preflight-profile'], { cwd: repoRoot, env });
    const result = spawnSync(process.execPath, [cli, 'profile', 'apply', 'preflight-profile', project], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /symbolic link/);
    assert.deepEqual(fs.readdirSync(project), ['.agents']);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'outside content\n');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply preflights adapter parent paths and leaves the project unchanged when a parent is a file', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-preflight-parent-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, '.agents'), 'not a directory\n');

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'parent-check'], { cwd: repoRoot, env });
    const result = spawnSync(process.execPath, [cli, 'profile', 'apply', 'parent-check', project], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Parent path is not a directory/);
    assert.deepEqual(fs.readdirSync(project), ['.agents']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync stops when an Agentic-managed block was manually changed', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-conflict-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'conflict-profile'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'apply', 'conflict-profile', project], { cwd: repoRoot, env });
    const claudePath = path.join(project, 'CLAUDE.md');
    const original = fs.readFileSync(claudePath, 'utf8');
    fs.writeFileSync(claudePath, original.replace('Follow the selected', 'Manually changed'));
    const result = spawnSync(process.execPath, [cli, 'profile', 'sync', project], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Managed file changed outside Agentic/);
    assert.match(fs.readFileSync(claudePath, 'utf8'), /Manually changed/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync stops when the profile-owned portion of AGENTS.md was manually changed', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-agents-conflict-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'agents-conflict'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'apply', 'agents-conflict', project], { cwd: repoRoot, env });
    const agentsPath = path.join(project, 'AGENTS.md');
    const original = fs.readFileSync(agentsPath, 'utf8');
    fs.writeFileSync(agentsPath, original.replace('공통 에이전틱 개발 지침을 관리한다', 'Manually changed profile guidance'));
    const result = spawnSync(process.execPath, [cli, 'profile', 'sync', project], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Managed file changed outside Agentic: AGENTS\.md/);
    assert.match(fs.readFileSync(agentsPath, 'utf8'), /Manually changed profile guidance/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('profile create and setup support interactive TUI input when options are omitted', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-tui-test-'));
  const env = { ...process.env, AGENTIC_HOME: home };

  try {
    const create = spawnSync(process.execPath, [cli, 'profile', 'create'], {
      cwd: repoRoot,
      env,
      input: 'company-main\ncompany\n',
      encoding: 'utf8'
    });
    assert.equal(create.status, 0, create.stderr);

    const setup = spawnSync(process.execPath, [cli, 'profile', 'setup', 'company-main'], {
      cwd: repoRoot,
      env,
      input: 'recommended\nstrict\noff\nrecommended\noff\nstrict\n',
      encoding: 'utf8'
    });
    assert.equal(setup.status, 0, setup.stderr);

    const metadata = JSON.parse(fs.readFileSync(path.join(home, '.agentic-profiles', 'company-main', 'agentic-profile.json'), 'utf8'));
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

test('setup without a profile name lets the user choose a scope-grouped profile in the TUI', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-tui-select-test-'));
  const env = { ...process.env, AGENTIC_HOME: home };

  try {
    execFileSync(process.execPath, [cli, 'profile', 'create', 'personal-main', '--scope', 'personal'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'create', 'company-main', '--scope', 'company'], { cwd: repoRoot, env });
    const setup = spawnSync(process.execPath, [cli, 'profile', 'setup'], {
      cwd: repoRoot,
      env,
      input: '1\nrecommended\nrecommended\nrecommended\nstrict\noff\nrecommended\n',
      encoding: 'utf8'
    });
    assert.equal(setup.status, 0, setup.stderr);

    const metadata = JSON.parse(fs.readFileSync(path.join(home, '.agentic-profiles', 'company-main', 'agentic-profile.json'), 'utf8'));
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
  assert.match(result.stdout, /agt profile create/);
  assert.doesNotMatch(result.stdout, /  agentic profile create/);

  const primary = spawnSync(process.execPath, [cli, 'help'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(primary.status, 0, primary.stderr);
  assert.match(primary.stdout, /agentic \(agt\) shared project guidance manager/);
  assert.match(primary.stdout, /agentic profile create/);
});

test('profile remove deletes only the selected profile and preserves an applied project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-profile-remove-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGENTIC_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'company', '--scope', 'company'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'apply', 'company', project], { cwd: repoRoot, env });
    const view = execFileSync(process.execPath, [cli, 'profile', 'view', 'company'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.match(view, /company\s+company/);
    execFileSync(process.execPath, [cli, 'profile', 'remove', 'company', '--yes'], { cwd: repoRoot, env });

    assert.equal(fs.existsSync(path.join(home, '.agentic-profiles', 'company')), false);
    assert.equal(fs.existsSync(path.join(project, 'AGENTS.md')), true);
    assert.equal(fs.existsSync(path.join(project, 'agentic.project.json')), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('profile remove requires a name when confirmation is supplied non-interactively', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-remove-approval-test-'));

  try {
    const result = spawnSync(process.execPath, [cli, 'profile', 'remove', '--yes'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /profile remove --yes requires <name>/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
