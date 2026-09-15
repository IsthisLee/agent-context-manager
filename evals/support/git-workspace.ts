import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TestContext } from 'node:test';

/**
 * A throwaway machine for evaluations: people with separate agctx homes, bare
 * Git remotes, service repositories, and a fake `gh` that records its calls.
 */

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const cli = path.join(repoRoot, 'src', 'agctx.ts');
export const PATH_KEY = Object.keys(process.env).find(key => key.toUpperCase() === 'PATH') || 'PATH';

const identity = (who: string) => ({ GIT_AUTHOR_NAME: who, GIT_AUTHOR_EMAIL: `${who}@example.com`, GIT_COMMITTER_NAME: who, GIT_COMMITTER_EMAIL: `${who}@example.com` });

export function gitIn(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...identity('tester') } });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed\n${result.stderr}`);
  return result.stdout.trim();
}

export interface Person {
  home: string;
  run(args: string[], env?: Record<string, string>): SpawnSyncReturns<string>;
  ok(args: string[], env?: Record<string, string>): SpawnSyncReturns<string>;
  profileDir(name: string): string;
}

export function makeWorkspace(t: TestContext, prefix = 'agctx-workspace-') {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const person = (who: string): Person => {
    const home = path.join(root, 'homes', who);
    fs.mkdirSync(home, { recursive: true });
    const base = { ...process.env, AGCTX_HOME: home, AGCTX_LANG: 'en', GIT_TERMINAL_PROMPT: '0', ...identity(who) };
    const run = (args: string[], env: Record<string, string> = {}) =>
      spawnSync(process.execPath, [cli, ...args], { cwd: root, env: { ...base, ...env }, encoding: 'utf8' });
    const ok = (args: string[], env: Record<string, string> = {}) => {
      const result = run(args, env);
      assert.equal(result.status, 0, `agctx ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
      return result;
    };
    return { home, run, ok, profileDir: name => path.join(home, 'profiles', name) };
  };
  const folder = (name: string) => {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
  return { root, person, folder };
}

/** The admin creates a profile, commits it, and pushes it to a new bare remote. */
export function publishProfile(root: string, admin: Person, name: string) {
  const remote = path.join(root, 'remotes', `${name}.git`);
  fs.mkdirSync(path.dirname(remote), { recursive: true });
  gitIn(root, 'init', '--bare', '--quiet', '--initial-branch=main', remote);
  admin.ok(['profile', 'create', name, '--scope', 'team']);
  const dir = admin.profileDir(name);
  gitIn(dir, 'init', '--quiet', '--initial-branch=main');
  gitIn(dir, 'add', '-A');
  gitIn(dir, 'commit', '--quiet', '-m', `Add ${name} profile`);
  admin.ok(['profile', 'connect', name, remote]);
  admin.ok(['profile', 'push', name, '--yes']);
  return { dir, remote };
}

/** A service repository: a bare origin with one commit on main, and a clone to work in. */
export function serviceRepo(root: string, name: string) {
  const origin = path.join(root, 'remotes', `${name}.git`);
  fs.mkdirSync(path.dirname(origin), { recursive: true });
  gitIn(root, 'init', '--bare', '--quiet', '--initial-branch=main', origin);
  const work = path.join(root, 'work', name);
  fs.mkdirSync(work, { recursive: true });
  gitIn(work, 'init', '--quiet', '--initial-branch=main');
  gitIn(work, 'remote', 'add', 'origin', origin);
  fs.writeFileSync(path.join(work, 'README.md'), `# ${name}\n`);
  gitIn(work, 'add', '-A');
  gitIn(work, 'commit', '--quiet', '-m', 'Initial commit');
  gitIn(work, 'push', '--quiet', '-u', 'origin', 'main');
  return { origin, work };
}

export function commitAndPush(work: string, message: string): void {
  gitIn(work, 'add', '-A');
  gitIn(work, 'commit', '--quiet', '-m', message);
  gitIn(work, 'push', '--quiet');
}

export interface GhCall {
  args: string[];
  cwd: string;
  body: string | null;
}

/**
 * A fake `gh` on PATH. Mode `ok` lists no pull requests and creates one; `existing`
 * lists an open pull request; `not-github` fails the way gh does outside GitHub.
 */
export function fakeGh(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-fake-gh-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'fake-gh.mjs'), `import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const bodyAt = args.indexOf('--body-file');
const body = bodyAt >= 0 ? fs.readFileSync(args[bodyAt + 1], 'utf8') : null;
fs.appendFileSync(path.join(here, 'calls.jsonl'), JSON.stringify({ args, cwd: process.cwd(), body }) + '\\n');
const modeFile = path.join(here, 'mode');
const mode = fs.existsSync(modeFile) ? fs.readFileSync(modeFile, 'utf8').trim() : 'ok';
if (args[0] === 'pr' && args[1] === 'list') {
  if (mode === 'not-github') { process.stderr.write('none of the git remotes configured for this repository point to a known GitHub host\\n'); process.exit(1); }
  process.stdout.write(mode === 'existing' ? JSON.stringify([{ url: 'https://github.com/acme/orders-api/pull/7' }]) : '[]');
  process.exit(0);
}
if (args[0] === 'pr' && args[1] === 'create') {
  if (mode === 'not-github') { process.stderr.write('none of the git remotes configured for this repository point to a known GitHub host\\n'); process.exit(1); }
  process.stdout.write('https://github.com/acme/orders-api/pull/1\\n');
  process.exit(0);
}
process.exit(0);
`);
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(dir, 'gh.cmd'), `@"${process.execPath}" "%~dp0fake-gh.mjs" %*\r\n`);
  } else {
    fs.writeFileSync(path.join(dir, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "$(dirname "$0")/fake-gh.mjs" "$@"\n`);
    fs.chmodSync(path.join(dir, 'gh'), 0o755);
  }
  return {
    env: { [PATH_KEY]: `${dir}${path.delimiter}${process.env[PATH_KEY]}` },
    setMode(mode: 'ok' | 'existing' | 'not-github') {
      fs.writeFileSync(path.join(dir, 'mode'), mode);
    },
    calls(): GhCall[] {
      const log = path.join(dir, 'calls.jsonl');
      return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    }
  };
}

export function optionValue(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}
