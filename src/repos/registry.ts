import fs from 'node:fs';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { writeTextAtomic } from '../shared/fs-utils.ts';
import { agctxHome } from '../shared/home.ts';

/**
 * The repositories this machine applied profiles to, kept in
 * `$AGCTX_HOME/repos.json`. `profile apply` and `profile sync` record entries;
 * `repos` commands read them.
 */

export interface RepoEntry {
  /** Real path of the project folder, so one folder is listed once. */
  path: string;
  profile: string;
  pinned: boolean;
  updatedAt: string;
}

function reposFile(): string {
  return path.join(agctxHome(), 'repos.json');
}

export function readRepos(): RepoEntry[] {
  const file = reposFile();
  if (!fs.existsSync(file)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw usageError('repos.invalid', _('error.repos.invalid', { file }), _('hint.repos.invalid', { file }));
  }
  const repos = parsed && typeof parsed === 'object' ? (parsed as { repos?: unknown }).repos : null;
  if (!Array.isArray(repos)) throw usageError('repos.invalid', _('error.repos.invalid', { file }), _('hint.repos.invalid', { file }));
  return repos
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .filter(entry => typeof entry.path === 'string' && typeof entry.profile === 'string')
    .map(entry => ({ path: entry.path as string, profile: entry.profile as string, pinned: entry.pinned === true, updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '' }));
}

function writeRepos(repos: readonly RepoEntry[]): void {
  fs.mkdirSync(agctxHome(), { recursive: true });
  const sorted = [...repos].sort((a, b) => a.path.localeCompare(b.path));
  writeTextAtomic(reposFile(), JSON.stringify({ schemaVersion: 1, repos: sorted }, null, 2) + '\n');
}

/** The real path of a folder, so `/var/…` and `/private/var/…` or a linked folder count once. */
export function repoKey(dir: string): string {
  try {
    return fs.realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

export function recordRepo(dir: string, profile: string, pinned: boolean): void {
  const key = repoKey(dir);
  const others = readRepos().filter(entry => entry.path !== key);
  writeRepos([...others, { path: key, profile, pinned, updatedAt: new Date().toISOString() }]);
}

/** Listed repositories, optionally only those that use one profile. */
export function selectRepos(profile: string | null): RepoEntry[] {
  return readRepos().filter(entry => !profile || entry.profile === profile);
}

/** Forget repositories whose folders no longer exist; returns what was removed. */
export function pruneRepos(): RepoEntry[] {
  const repos = readRepos();
  const missing = repos.filter(entry => !fs.existsSync(entry.path));
  if (missing.length) writeRepos(repos.filter(entry => fs.existsSync(entry.path)));
  return missing;
}
