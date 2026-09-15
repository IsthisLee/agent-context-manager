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

const REMOTE_FAILURE = /Authentication failed|could not read (Username|Password)|Permission denied \(publickey\)|Repository not found|does not appear to be a git repository|Could not resolve host|unable to access|Connection (timed out|refused)|Host key verification failed/i;

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
    if (REMOTE_FAILURE.test(output.stderr)) {
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
  const result = git(['rev-parse', '--show-toplevel'], { cwd: dir, allowFailure: true });
  if (result.status !== 0) return false;
  // Compare real paths: git reports /private/var/... for a macOS /var/... temp folder, and C:/ with forward slashes on Windows.
  try {
    return fs.realpathSync(result.stdout.trim()) === fs.realpathSync(dir);
  } catch {
    return false;
  }
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
