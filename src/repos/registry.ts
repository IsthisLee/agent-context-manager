import fs from 'node:fs';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { writeTextAtomic } from '../shared/fs-utils.ts';
import { agctxHome } from '../shared/home.ts';

/**
 * 이 컴퓨터가 프로필을 적용한 저장소들. `$AGCTX_HOME/repos.json`에 둔다. `profile apply`와
 * `profile sync`가 항목을 기록하고 `repos` 명령이 읽는다.
 */

export interface RepoEntry {
  /** 프로젝트 폴더의 실제 경로. 한 폴더가 한 번만 나오게 한다. */
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
  if (!Array.isArray(repos))
    throw usageError('repos.invalid', _('error.repos.invalid', { file }), _('hint.repos.invalid', { file }));
  return repos
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .filter(entry => typeof entry.path === 'string' && typeof entry.profile === 'string')
    .map(entry => ({
      path: entry.path as string,
      profile: entry.profile as string,
      pinned: entry.pinned === true,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : ''
    }));
}

function writeRepos(repos: readonly RepoEntry[]): void {
  fs.mkdirSync(agctxHome(), { recursive: true });
  const sorted = [...repos].sort((a, b) => a.path.localeCompare(b.path));
  writeTextAtomic(reposFile(), JSON.stringify({ schemaVersion: 1, repos: sorted }, null, 2) + '\n');
}

/** 폴더의 실제 경로. `/var/…`와 `/private/var/…`, 연결된 폴더가 한 번으로 세어지게 한다. */
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

/** 목록의 저장소. 한 프로필을 쓰는 것만 고를 수도 있다. */
export function selectRepos(profile: string | null): RepoEntry[] {
  return readRepos().filter(entry => !profile || entry.profile === profile);
}

/** 폴더가 더는 없는 저장소를 잊는다. 지운 것을 돌려준다. */
export function pruneRepos(): RepoEntry[] {
  const repos = readRepos();
  const missing = repos.filter(entry => !fs.existsSync(entry.path));
  if (missing.length) writeRepos(repos.filter(entry => fs.existsSync(entry.path)));
  return missing;
}
