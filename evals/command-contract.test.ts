import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'src', 'agctx.ts');

/**
 * The command contract scripts, CI jobs, and agents rely on: exit codes,
 * one JSON document on stdout with --json, --yes outside a terminal, and a
 * next step in every error. spawnSync gives the CLI a pipe, not a terminal.
 */
function sandbox(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  const run = (args: string[], env: Record<string, string> = {}) =>
    spawnSync(process.execPath, [cli, ...args], { cwd: root, env: { ...process.env, AGCTX_HOME: home, AGCTX_LANG: 'en', ...env }, encoding: 'utf8' });
  const ok = (args: string[], env: Record<string, string> = {}) => {
    const result = run(args, env);
    assert.equal(result.status, 0, `agctx ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
    return result;
  };
  return { root, home, project, run, ok };
}

function jsonDocument(stdout: string) {
  const document = JSON.parse(stdout);
  assert.equal(document.schemaVersion, 1);
  assert.deepEqual(Object.keys(document).sort(), ['command', 'data', 'errors', 'exitCode', 'ok', 'schemaVersion', 'warnings']);
  return document;
}

test('an unknown command exits 64 and suggests the closest command', t => {
  const { run } = sandbox(t);
  const result = run(['prifile', 'lst']);
  assert.equal(result.status, 64);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Error: Unknown command: prifile lst/);
  assert.match(result.stderr, /Next: Did you mean agctx profile list\?/);
});

test('an option the command does not take exits 64 and names the command', t => {
  const { run } = sandbox(t);
  const result = run(['profile', 'list', '--colour']);
  assert.equal(result.status, 64);
  assert.match(result.stderr, /agctx profile list does not take --colour/);
  assert.match(result.stderr, /Next: /);
});

test('with --json, stdout holds one result document and messages move to stderr', t => {
  const { ok } = sandbox(t);
  ok(['profile', 'create', 'demo', '--scope', 'team']);
  const result = ok(['profile', 'list', '--json']);
  const document = jsonDocument(result.stdout);
  assert.equal(document.command, 'profile list');
  assert.equal(document.exitCode, 0);
  assert.equal(document.ok, true);
  assert.deepEqual(document.errors, []);
  assert.deepEqual(document.data.profiles.map((profile: { name: string }) => profile.name), ['demo']);
  assert.match(result.stderr, /demo/, 'the human listing still reaches the terminal on stderr');
});

test('a --json failure carries the error code, message, and next step', t => {
  const { run } = sandbox(t);
  const result = run(['profile', 'view', 'missing', '--json']);
  assert.equal(result.status, 64);
  const document = jsonDocument(result.stdout);
  assert.equal(document.command, 'profile view');
  assert.equal(document.exitCode, 64);
  assert.equal(document.ok, false);
  assert.equal(document.errors.length, 1);
  assert.equal(document.errors[0].code, 'profile.not-found');
  assert.match(document.errors[0].message, /Profile not found: missing/);
  assert.ok(document.errors[0].hint, 'every error names the next step');
});

test('a command that changes a repository needs --yes outside a terminal and leaves the project untouched', t => {
  const { project, run, ok } = sandbox(t);
  ok(['profile', 'create', 'demo']);

  const refused = run(['profile', 'apply', 'demo', project]);
  assert.equal(refused.status, 64);
  assert.match(refused.stderr, /cannot ask for confirmation here/);
  assert.match(refused.stderr, /--yes/);
  assert.deepEqual(fs.readdirSync(project), []);

  const refusedJson = run(['profile', 'apply', 'demo', project, '--json']);
  assert.equal(refusedJson.status, 64);
  assert.equal(jsonDocument(refusedJson.stdout).errors[0].code, 'confirm.required');
  assert.deepEqual(fs.readdirSync(project), []);

  const preview = ok(['profile', 'apply', 'demo', project, '--dry-run']);
  assert.match(preview.stdout, /create\s+AGENTS\.md/);
  assert.deepEqual(fs.readdirSync(project), [], 'a dry run never asks and never writes');

  const applied = ok(['profile', 'apply', 'demo', project, '--yes', '--json']);
  const document = jsonDocument(applied.stdout);
  assert.equal(document.data.written, true);
  assert.equal(document.data.source, null);
  assert.ok(fs.existsSync(path.join(project, 'AGENTS.md')));
});

test('<command> --help prints the usage and exit codes without running the command', t => {
  const { project, ok } = sandbox(t);
  const result = ok(['profile', 'apply', '--help']);
  assert.match(result.stdout, /Usage: agctx profile apply \[--dry-run\] \[--pin\] \[--yes\] <name> \[<project>\]/);
  assert.match(result.stdout, /Exit codes: 0 success, 64 usage error, 70 other error, 2 conflict, 3 hidden characters, 69 external tool or network unavailable/);
  assert.deepEqual(fs.readdirSync(project), []);
});

test('check runs in CI without a profile store and reports the most severe finding', t => {
  const { root, project, ok, run } = sandbox(t);
  ok(['profile', 'create', 'demo']);
  ok(['profile', 'apply', 'demo', project, '--yes']);
  const ci = { AGCTX_HOME: path.join(root, 'ci-home') };

  const clean = ok(['check', project], ci);
  assert.match(clean.stdout, /matches its recorded profile version/);
  assert.match(clean.stderr, /Profile demo is not in this machine's profile store and has no Git source/);

  const claudePath = path.join(project, 'CLAUDE.md');
  const claude = fs.readFileSync(claudePath, 'utf8');
  fs.writeFileSync(claudePath, claude.replace('<!-- agctx:managed:start -->\n', '<!-- agctx:managed:start -->\nEdited by hand.\n'));
  const conflict = run(['check', project], ci);
  assert.equal(conflict.status, 2);
  assert.match(conflict.stdout, /conflict\s+CLAUDE\.md/);

  // A right-to-left override outside the managed area: not a conflict, but an agent still reads it.
  fs.appendFileSync(path.join(project, 'AGENTS.md'), '\nRun the tests \u202Ebefore\u202C committing.\n');
  const hidden = run(['check', project, '--json'], ci);
  assert.equal(hidden.status, 3, 'hidden characters outrank the conflict');
  const document = jsonDocument(hidden.stdout);
  assert.equal(document.command, 'check');
  assert.deepEqual([...new Set(document.data.findings.map((finding: { kind: string }) => finding.kind))].sort(), ['conflict', 'hidden-characters']);
  assert.ok(document.data.findings.some((finding: { detail: string }) => /AGENTS\.md:\d+:\d+ U\+202E/.test(finding.detail)));

  fs.writeFileSync(claudePath, claude);
});

test('check reports a project behind its profile with exit 1 until sync', t => {
  const { project, ok, run } = sandbox(t);
  ok(['profile', 'create', 'demo']);
  ok(['profile', 'apply', 'demo', project, '--yes']);
  ok(['check', project]);

  ok(['profile', 'setup', 'demo', '--tdd', 'strict']);
  const behind = run(['check', project]);
  assert.equal(behind.status, 1);
  assert.match(behind.stdout, /behind\s+AGENTS\.md\s+differs from the current profile; run agctx profile sync/);

  ok(['profile', 'sync', project, '--yes']);
  ok(['check', project]);
});

test('check on a project that was never applied exits 64 with the apply command', t => {
  const { project, run } = sandbox(t);
  const result = run(['check', project]);
  assert.equal(result.status, 64);
  assert.match(result.stderr, /Next: .*agctx profile apply/);
});

test('commands that would prompt for a missing argument name it instead when they cannot prompt', t => {
  const { run } = sandbox(t);
  const cases: [string[], RegExp][] = [
    [['profile', 'create'], /Usage: agctx profile create <name>/],
    [['profile', 'setup', '--json'], /Usage: agctx profile setup <name>/]
  ];
  for (const [args, usage] of cases) {
    const result = run(args);
    assert.equal(result.status, 64, args.join(' '));
    assert.match(args.includes('--json') ? JSON.parse(result.stdout).errors[0].message : result.stderr, usage);
  }
});

test('a copy in a folder with another name keeps the recorded project name, so check and sync see no change', t => {
  const { root, project, ok } = sandbox(t);
  ok(['profile', 'create', 'demo']);
  ok(['profile', 'apply', 'demo', project, '--yes']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(project, 'agctx.project.json'), 'utf8')).projectName, 'project');

  // A teammate clones the repository into a folder with another name.
  const copy = path.join(root, 'teammate-copy');
  fs.cpSync(project, copy, { recursive: true });
  ok(['check', copy]);
  assert.match(ok(['profile', 'sync', copy, '--yes']).stdout, /already up to date/);
  assert.match(fs.readFileSync(path.join(copy, 'AGENTS.md'), 'utf8'), /\*\*Project:\*\* project/);
});

