import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashManagedDocument } from '../src/project/analyzer.ts';
import { makeWorkspace } from './support/git-workspace.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'src', 'agctx.ts');

test('profile create creates a named scoped profile in the user profile directory', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-profile-test-'));

  try {
    execFileSync(process.execPath, [cli, 'profile', 'create', 'company', '--scope', 'company'], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home, AGCTX_LANG: 'ko' },
      encoding: 'utf8'
    });

    const profileDir = path.join(home, 'profiles', 'company');
    const metadata = JSON.parse(fs.readFileSync(path.join(profileDir, 'profile.json'), 'utf8'));
    assert.equal(metadata.name, 'company');
    assert.equal(metadata.scope, 'company');
    assert.equal(metadata.schemaVersion, 1);
    const instructions = fs.readFileSync(path.join(profileDir, 'AGENTS.md'), 'utf8');
    assert.match(instructions, /# Profile: company/);
    assert.match(instructions, /공통 에이전틱 개발 지침을 관리한다/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('profile list reports registered profiles without exposing paths as the identity', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-profile-list-test-'));

  try {
    execFileSync(process.execPath, [cli, 'profile', 'create', 'personal', '--scope', 'personal'], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home },
      encoding: 'utf8'
    });
    const output = execFileSync(process.execPath, [cli, 'profile', 'list'], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home },
      encoding: 'utf8'
    });
    assert.match(output, /\[personal\]\s+personal/);
    assert.doesNotMatch(output, new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('profile list can filter registered profiles by scope', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-profile-scope-list-test-'));

  try {
    const env = { ...process.env, AGCTX_HOME: home };
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
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-profile-invalid-metadata-test-'));

  try {
    const profileDir = path.join(home, 'profiles', 'broken');
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(path.join(profileDir, 'profile.json'), JSON.stringify({ schemaVersion: 1, name: 'broken', scope: 'unknown' }));
    const output = execFileSync(process.execPath, [cli, 'profile', 'list'], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home },
      encoding: 'utf8'
    });
    assert.match(output, /No profiles found/);
    assert.doesNotMatch(output, /broken/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('profiles and the language setting live directly under AGCTX_HOME', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-home-layout-test-'));

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'layout', '--scope', 'team'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'config', 'lang', 'en'], { cwd: repoRoot, env });

    assert.equal(fs.existsSync(path.join(home, 'profiles', 'layout', 'profile.json')), true);
    assert.equal(fs.existsSync(path.join(home, 'profiles', 'layout', 'AGENTS.md')), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8')), { locale: 'en' });
    assert.equal(fs.existsSync(path.join(home, '.agctx')), false, 'AGCTX_HOME is the agctx folder itself, not a home directory');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('without AGCTX_HOME, agctx uses ~/.agctx and leaves an old ~/.agentic home untouched', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-default-home-test-'));

  try {
    const oldProfile = path.join(home, 'profiles', 'legacy');
    fs.mkdirSync(oldProfile, { recursive: true });
    fs.writeFileSync(path.join(oldProfile, 'profile.json'), JSON.stringify({ schemaVersion: 1, name: 'legacy', scope: 'team' }) + '\n');
    fs.writeFileSync(path.join(oldProfile, 'AGENTS.md'), '# legacy\n');
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home };
    delete env.AGCTX_HOME;

    const output = execFileSync(process.execPath, [cli, 'profile', 'list'], { cwd: repoRoot, env, encoding: 'utf8' });
    execFileSync(process.execPath, [cli, 'profile', 'create', 'fresh'], { cwd: repoRoot, env });

    assert.match(output, /No profiles found/);
    assert.doesNotMatch(output, /legacy/);
    assert.equal(fs.existsSync(path.join(oldProfile, 'profile.json')), true);
    assert.equal(fs.existsSync(path.join(home, '.agctx', 'profiles', 'legacy')), false);
    assert.equal(fs.existsSync(path.join(home, '.agctx', 'profiles', 'fresh', 'profile.json')), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('setup applies selected guidance to the profile and preserves its project-independent boundary', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-profile-setup-test-'));

  try {
    const env = { ...process.env, AGCTX_HOME: home, AGCTX_LANG: 'ko' };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'team', '--scope', 'team'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [
      cli, 'profile', 'setup', 'team',
      '--workflow', 'on', '--context', 'on', '--tdd', 'on', '--review', 'off',
      '--verification', 'on', '--instructions', 'off', '--docs', 'on',
      '--security', 'on', '--untrusted', 'on', '--language', 'off'
    ], { cwd: repoRoot, env, encoding: 'utf8' });

    const profileDir = path.join(home, 'profiles', 'team');
    const metadata = JSON.parse(fs.readFileSync(path.join(profileDir, 'profile.json'), 'utf8'));
    assert.deepEqual(metadata.settings, {
      workflow: 'on',
      context: 'on',
      tdd: 'on',
      review: 'off',
      verification: 'on',
      instructions: 'off',
      docs: 'on',
      security: 'on',
      untrusted: 'on',
      language: 'off'
    });
    const instructions = fs.readFileSync(path.join(profileDir, 'AGENTS.md'), 'utf8');
    assert.match(instructions, /## TDD/);
    assert.doesNotMatch(instructions, /## 변경 검토/);
    assert.doesNotMatch(instructions, /## 지침 파일/);
    assert.doesNotMatch(instructions, /## 응답 언어/, 'a level of off keeps the item out of the block');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply applies the selected profile to a project without changing the profile', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-profile-apply-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'sample-project', version: '1.0.0' }));

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'company', '--scope', 'company'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'setup', 'company', '--tdd', 'on'], { cwd: repoRoot, env });
    const profileAgentsBefore = fs.readFileSync(path.join(home, 'profiles', 'company', 'AGENTS.md'), 'utf8');

    execFileSync(process.execPath, [cli, 'profile', 'apply', 'company', project, '--yes'], { cwd: repoRoot, env });

    const projectAgents = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    assert.match(projectAgents, /# Profile: company/);
    assert.match(projectAgents, /## TDD/);
    assert.match(projectAgents, /sample-project/);
    const selection = JSON.parse(fs.readFileSync(path.join(project, 'agctx.project.json'), 'utf8'));
    assert.equal(selection.schemaVersion, 2);
    assert.equal(selection.profile, 'company');
    assert.equal(selection.source, undefined, 'a profile that is not a Git repository records no source');
    assert.deepEqual(Object.keys(selection.managedHashes).map(file => file.replaceAll(path.sep, '/')).sort(), [
      '.agents/rules/agctx.md',
      'AGENTS.md',
      'CLAUDE.md'
    ]);
    assert.equal(fs.existsSync(path.join(project, '.cursor')), false, 'Cursor is not a supported agent');
    assert.equal(fs.existsSync(path.join(project, '.github', 'copilot-instructions.md')), false, 'Copilot is not a supported agent');
    fs.appendFileSync(path.join(project, 'CLAUDE.md'), '\n## Local Claude guidance\n\nKeep this local workflow.\n');
    execFileSync(process.execPath, [cli, 'profile', 'sync', project, '--yes'], { cwd: repoRoot, env });
    assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /Applied from agctx profile: company/);
    assert.match(fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8'), /Keep this local workflow/);
    assert.equal(fs.readFileSync(path.join(home, 'profiles', 'company', 'AGENTS.md'), 'utf8'), profileAgentsBefore);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply puts agent rule frontmatter first and sync repairs rule files an earlier version wrapped in the managed block', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-rule-frontmatter-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'sample-project', version: '1.0.0' }));

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'company', '--scope', 'company'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'setup', 'company', '--tdd', 'on'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'apply', 'company', project, '--yes'], { cwd: repoRoot, env });

    const ruleRelativePath = '.agents/rules/agctx.md';
    const rulePath = path.join(project, '.agents', 'rules', 'agctx.md');
    const rule = fs.readFileSync(rulePath, 'utf8');
    assert.ok(rule.startsWith('---\ntrigger: always_on\n---\n'),
      'Antigravity reads rule frontmatter only from the first line and loads a workspace rule on every task only with trigger: always_on');
    assert.match(rule, /^---\ntrigger: always_on\n---\n\n<!-- agctx:managed:start -->\n/, 'the managed block starts right after the frontmatter');

    const layout = rule.match(/^(---\n[\s\S]*?\n---\n)\n?([\s\S]*)$/);
    assert.ok(layout, 'the rule file starts with frontmatter');
    const [, frontmatter, rest] = layout;
    const earlierLayout = rest.replace('<!-- agctx:managed:start -->\n', `<!-- agctx:managed:start -->\n${frontmatter}\n`);
    fs.writeFileSync(rulePath, earlierLayout);
    const configPath = path.join(project, 'agctx.project.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.managedHashes[ruleRelativePath] = hashManagedDocument(earlierLayout);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    execFileSync(process.execPath, [cli, 'profile', 'sync', project, '--yes'], { cwd: repoRoot, env });

    const repaired = fs.readFileSync(rulePath, 'utf8');
    assert.ok(repaired.startsWith('---\ntrigger: always_on\n---\n'));
    assert.equal((repaired.match(/trigger: always_on/g) || []).length, 1);
    const repairedMatch = repaired.match(/<!-- agctx:managed:start -->[\s\S]*?<!-- agctx:managed:end -->/);
    assert.ok(repairedMatch, 'the repaired rule keeps its managed block');
    const repairedBlock = repairedMatch[0];
    assert.doesNotMatch(repairedBlock, /^---$/m, 'sync moves frontmatter an earlier version wrapped in the managed block out of it');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply requires a profile name', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-apply-no-name-test-'));

  try {
    const result = spawnSync(process.execPath, [cli, 'profile', 'apply', '--yes'], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home },
      encoding: 'utf8'
    });
    assert.equal(result.status, 64);
    assert.match(result.stderr, /Missing argument\. Usage: agctx profile apply <name> \[<project>\]/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply rejects an unknown profile before changing the target project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-profile-invalid-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  const packageJson = JSON.stringify({ name: 'untouched-project', version: '1.0.0' }, null, 2);
  fs.writeFileSync(path.join(project, 'package.json'), packageJson);

  try {
    const result = execFileSync(process.execPath, [cli, 'profile', 'apply', 'missing', project, '--yes'], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    assert.fail(`expected failure, got ${result}`);
  } catch (error) {
    const failure = error as { status: number; stderr: string };
    assert.equal(failure.status, 64);
    assert.match(failure.stderr, /Profile not found: missing/);
  }
  assert.equal(fs.readFileSync(path.join(project, 'package.json'), 'utf8'), packageJson);
  assert.deepEqual(fs.readdirSync(project), ['package.json']);
  fs.rmSync(home, { recursive: true, force: true });
});

test('apply rejects a file path instead of treating it as a project directory', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-file-target-test-'));
  const target = path.join(home, 'not-a-project-directory');
  fs.writeFileSync(target, 'keep this file\n');

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'directory-check'], { cwd: repoRoot, env });
    const result = spawnSync(process.execPath, [cli, 'profile', 'apply', 'directory-check', target, '--yes'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 64);
    assert.match(result.stderr, /Project path is not a directory/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'keep this file\n');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync refuses to switch the bound profile', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-sync-no-switch-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'bound'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'create', 'other'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'apply', 'bound', project, '--yes'], { cwd: repoRoot, env });

    const positional = spawnSync(process.execPath, [cli, 'profile', 'sync', project, 'other', '--yes'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(positional.status, 64);
    assert.match(positional.stderr, /To switch profiles, run agctx profile apply/);

    const flagged = spawnSync(process.execPath, [cli, 'profile', 'sync', project, '--profile', 'other', '--yes'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(flagged.status, 64);
    assert.match(flagged.stderr, /To switch profiles, run agctx profile apply/);

    const selection = JSON.parse(fs.readFileSync(path.join(project, 'agctx.project.json'), 'utf8'));
    assert.equal(selection.profile, 'bound');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync requires a project that was already applied', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-sync-unapplied-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const result = spawnSync(process.execPath, [cli, 'profile', 'sync', project, '--yes'], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home },
      encoding: 'utf8'
    });
    assert.equal(result.status, 64);
    assert.match(result.stderr, /profile sync requires a project already applied/);
    assert.deepEqual(fs.readdirSync(project), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync reports invalid project metadata without changing the project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-invalid-project-metadata-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'metadata-check'], { cwd: repoRoot, env });
    fs.writeFileSync(path.join(project, 'agctx.project.json'), '{ invalid json\n');
    const result = spawnSync(process.execPath, [cli, 'profile', 'sync', project, '--yes'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 64);
    assert.match(result.stderr, /Invalid project metadata/);
    assert.deepEqual(fs.readdirSync(project), ['agctx.project.json']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply preserves an existing AGENTS.md that has no extension section', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-profile-existing-agents-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'AGENTS.md'), '# Existing project guidance\n\n- Keep the API backwards compatible.\n');

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'team-profile', '--scope', 'team'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'apply', 'team-profile', project, '--yes'], { cwd: repoRoot, env });
    const agents = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    assert.match(agents, /# Profile: team-profile/);
    assert.match(agents, /Existing project guidance/);
    assert.match(agents, /Keep the API backwards compatible/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply dry-run reports planned files without changing the project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-profile-dry-run-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'dry-run-profile', '--scope', 'workspace'], { cwd: repoRoot, env });
    const output = execFileSync(process.execPath, [cli, 'profile', 'apply', 'dry-run-profile', '--dry-run', project, '--yes'], {
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
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-preflight-symlink-test-'));
  const project = path.join(home, 'project');
  const outside = path.join(home, 'outside.md');
  fs.mkdirSync(path.join(project, '.agents', 'rules'), { recursive: true });
  fs.writeFileSync(outside, 'outside content\n');

  try {
    try {
      fs.symlinkSync(outside, path.join(project, '.agents', 'rules', 'agctx.md'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'EACCES') return;
      throw error;
    }
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'preflight-profile'], { cwd: repoRoot, env });
    const result = spawnSync(process.execPath, [cli, 'profile', 'apply', 'preflight-profile', project, '--yes'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 70);
    assert.match(result.stderr, /symbolic link/);
    assert.deepEqual(fs.readdirSync(project), ['.agents']);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'outside content\n');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('apply preflights adapter parent paths and leaves the project unchanged when a parent is a file', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-preflight-parent-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, '.agents'), 'not a directory\n');

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'parent-check'], { cwd: repoRoot, env });
    const result = spawnSync(process.execPath, [cli, 'profile', 'apply', 'parent-check', project, '--yes'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 70);
    assert.match(result.stderr, /Parent path is not a directory/);
    assert.deepEqual(fs.readdirSync(project), ['.agents']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync stops when an agctx-managed block was manually changed', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-profile-conflict-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'conflict-profile'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'apply', 'conflict-profile', project, '--yes'], { cwd: repoRoot, env });
    const claudePath = path.join(project, 'CLAUDE.md');
    const original = fs.readFileSync(claudePath, 'utf8');
    fs.writeFileSync(claudePath, original.replace('Follow the selected', 'Manually changed'));
    const result = spawnSync(process.execPath, [cli, 'profile', 'sync', project, '--yes'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Managed file changed outside agctx/);
    assert.match(fs.readFileSync(claudePath, 'utf8'), /Manually changed/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync stops when the profile-owned portion of AGENTS.md was manually changed', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-agents-conflict-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'agents-conflict'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'apply', 'agents-conflict', project, '--yes'], { cwd: repoRoot, env });
    const agentsPath = path.join(project, 'AGENTS.md');
    const original = fs.readFileSync(agentsPath, 'utf8');
    fs.writeFileSync(agentsPath, original.replace('This profile manages the shared agentic development guidance', 'Manually changed profile guidance'));
    const result = spawnSync(process.execPath, [cli, 'profile', 'sync', project, '--yes'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Managed file changed outside agctx: AGENTS\.md/);
    assert.match(fs.readFileSync(agentsPath, 'utf8'), /Manually changed profile guidance/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('profile create and setup support interactive TUI input when options are omitted', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-tui-test-'));
  const env = { ...process.env, AGCTX_HOME: home };

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
      input: 'on\non\non\noff\non\noff\non\non\non\noff\n',
      encoding: 'utf8'
    });
    assert.equal(setup.status, 0, setup.stderr);

    const metadata = JSON.parse(fs.readFileSync(path.join(home, 'profiles', 'company-main', 'profile.json'), 'utf8'));
    assert.deepEqual(metadata.settings, {
      workflow: 'on',
      context: 'on',
      tdd: 'on',
      review: 'off',
      verification: 'on',
      instructions: 'off',
      docs: 'on',
      security: 'on',
      untrusted: 'on',
      language: 'off'
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('setup without a profile name lets the user choose a scope-grouped profile in the TUI', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-tui-select-test-'));
  const env = { ...process.env, AGCTX_HOME: home };

  try {
    execFileSync(process.execPath, [cli, 'profile', 'create', 'personal-main', '--scope', 'personal'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'create', 'company-main', '--scope', 'company'], { cwd: repoRoot, env });
    const setup = spawnSync(process.execPath, [cli, 'profile', 'setup'], {
      cwd: repoRoot,
      env,
      input: '1\non\non\non\non\non\noff\non\non\non\noff\n',
      encoding: 'utf8'
    });
    assert.equal(setup.status, 0, setup.stderr);

    const metadata = JSON.parse(fs.readFileSync(path.join(home, 'profiles', 'company-main', 'profile.json'), 'utf8'));
    assert.equal(metadata.settings.verification, 'on');
    assert.equal(metadata.settings.instructions, 'off');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('agctx is the only command and its help names it', () => {
  const result = spawnSync(process.execPath, [cli, 'help'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^agctx \(Agent Context Manager\)/);
  assert.match(result.stdout, /  agctx profile create/);
  assert.doesNotMatch(result.stdout, /\bagt\b/);
  assert.doesNotMatch(result.stdout, /agentic/i);

  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(packageJson.bin), ['agctx']);
  assert.equal(fs.existsSync(path.join(repoRoot, 'src', 'agt.ts')), false);
});

test('profile remove deletes only the selected profile and preserves an applied project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-profile-remove-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);

  try {
    const env = { ...process.env, AGCTX_HOME: home };
    execFileSync(process.execPath, [cli, 'profile', 'create', 'company', '--scope', 'company'], { cwd: repoRoot, env });
    execFileSync(process.execPath, [cli, 'profile', 'apply', 'company', project, '--yes'], { cwd: repoRoot, env });
    const view = execFileSync(process.execPath, [cli, 'profile', 'view', 'company'], { cwd: repoRoot, env, encoding: 'utf8' });
    assert.match(view, /company\s+company/);
    execFileSync(process.execPath, [cli, 'profile', 'remove', 'company', '--yes'], { cwd: repoRoot, env });

    assert.equal(fs.existsSync(path.join(home, 'profiles', 'company')), false);
    assert.equal(fs.existsSync(path.join(project, 'AGENTS.md')), true);
    assert.equal(fs.existsSync(path.join(project, 'agctx.project.json')), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('profile remove requires a name when confirmation is supplied non-interactively', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-remove-approval-test-'));

  try {
    const result = spawnSync(process.execPath, [cli, 'profile', 'remove', '--yes'], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home },
      encoding: 'utf8'
    });
    assert.equal(result.status, 64);
    assert.match(result.stderr, /Missing argument\. Usage: agctx profile remove <name> --yes/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('check and sync read a guidance file with CRLF line endings as unchanged, and sync keeps CRLF when it rewrites the file', t => {
  const { person, folder } = makeWorkspace(t, 'agctx-profile-crlf-');
  const me = person('me');
  const project = folder('app');
  me.ok(['profile', 'create', 'personal']);
  me.ok(['profile', 'apply', 'personal', project, '--yes']);
  // What a checkout with core.autocrlf leaves: every text file, base files included, with CRLF line endings.
  const managed = ['AGENTS.md', 'CLAUDE.md', '.agents/rules/agctx.md'];
  for (const rel of [...managed, ...managed.map(file => `.agctx/base/${file}.base`)]) {
    const file = path.join(project, rel);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('\n', '\r\n'));
  }
  assert.equal(me.run(['check', project]).status, 0, 'CRLF line endings are not an edit to the managed area');

  fs.appendFileSync(path.join(me.profileDir('personal'), 'AGENTS.md'), '\n- Keep functions small.\n');
  me.ok(['profile', 'sync', project, '--yes']);
  const agents = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Keep functions small\./);
  assert.doesNotMatch(agents, /[^\r]\n/, 'every line still ends with CRLF');
  assert.equal(me.run(['check', project]).status, 0);
});
