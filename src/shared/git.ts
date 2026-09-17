import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { _ } from '../i18n/index.ts';
import { CliError, EXIT } from './errors.ts';

export interface GitOutput {
  status: number;
  stdout: string;
  stderr: string;
}

const REMOTE_FAILURE = /Authentication failed|could not read (Username|Password)|unable to get password|Permission denied \(publickey\)|Repository not found|does not appear to be a git repository|Could not resolve host|unable to access|Connection (timed out|refused)|Host key verification failed/i;

/**
 * Whether git failed at reaching or signing in to the remote rather than at the
 * work tree. Those failures carry the Git credentials next step and exit 69, so
 * a missing password reads as a sign-in problem instead of an unknown error.
 */
export function isRemoteFailure(stderr: string): boolean {
  return REMOTE_FAILURE.test(stderr);
}

/**
 * Run git with separate arguments, never through a shell. Outside a terminal
 * git must not wait for a password prompt, so interactive prompts are off there.
 */
export function git(args: readonly string[], options: { cwd?: string; allowFailure?: boolean } = {}): GitOutput {
  if (options.cwd && !fs.existsSync(options.cwd)) throw new Error(`Folder not found: ${options.cwd}`);
  const env = process.stdin.isTTY ? process.env : { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  const result = spawnSync('git', args, { cwd: options.cwd, encoding: 'utf8', env });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CliError('git.missing', _('error.git.missing'), { exitCode: EXIT.unavailable, hint: _('hint.git.install') });
    }
    throw result.error;
  }
  const output = { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
  if (output.status !== 0 && !options.allowFailure) {
    const detail = output.stderr.trim().split('\n').slice(-3).join('\n');
    if (isRemoteFailure(output.stderr)) {
      throw new CliError('git.remote', _('error.git.remote', { detail }), { exitCode: EXIT.unavailable, hint: _('hint.git.remote') });
    }
    throw new CliError('git.failed', _('error.git.failed', { command: `git ${args.join(' ')}`, detail }), { exitCode: EXIT.software });
  }
  return output;
}

/** Whether `dir` is itself the top of a Git work tree (not a folder inside another repository). */
export function isGitRoot(dir: string): boolean {
  // A work tree top always holds .git (a folder, or a file for worktrees), so local profiles never need Git installed.
  if (!fs.existsSync(path.join(dir, '.git'))) return false;
  // Ask git how far up the top is instead of comparing paths: a macOS /var temp folder, a Windows short
  // name such as RUNNER~1, or another letter case spells the folder differently from what git reports.
  const result = git(['rev-parse', '--show-cdup'], { cwd: dir, allowFailure: true });
  return result.status === 0 && result.stdout.trim() === '';
}

/**
 * A remote given on the command line: an existing local path becomes absolute, so
 * git does not read it relative to the profile folder it runs in; URLs stay as typed.
 */
export function resolveRemoteLocation(location: string): string {
  const local = path.resolve(location);
  return fs.existsSync(local) ? local : location;
}

/** A remote URL safe to record: user names, passwords, and tokens are removed from URL-style addresses. */
export function sanitizeRemoteUrl(url: string): string {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return url;
  }
}
