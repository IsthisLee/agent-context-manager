import fs from 'node:fs';
import { checkProject, remoteHeadCommit, type CheckFinding } from '../check.ts';
import { EXIT, toCliError } from '../shared/errors.ts';
import { selectRepos } from './registry.ts';

/** `agctx repos status`: run `check` on every listed repository. */

export type RepoState = 'ok' | 'behind' | 'conflict' | 'hidden-characters' | 'missing' | 'error';

export interface RepoStatus {
  path: string;
  profile: string;
  pinned: boolean;
  state: RepoState;
  exitCode: number;
  commit: string | null;
  latestCommit: string | null;
  findings: CheckFinding[];
  error: { code: string; message: string; hint: string | null } | null;
}

const STATE_BY_CODE: Record<number, RepoState> = {
  [EXIT.ok]: 'ok',
  [EXIT.behind]: 'behind',
  [EXIT.conflict]: 'conflict',
  [EXIT.hiddenCharacters]: 'hidden-characters'
};

export function reposStatus(options: { profile?: string | null; refresh?: boolean } = {}): RepoStatus[] {
  // Many repositories share one profile source; ask each remote branch once.
  const heads = new Map<string, string | null>();
  const remoteHead = (url: string, branch: string) => {
    const key = `${url}\n${branch}`;
    if (!heads.has(key)) heads.set(key, remoteHeadCommit(url, branch));
    return heads.get(key) ?? null;
  };
  return selectRepos(options.profile ?? null).map((entry): RepoStatus => {
    const base = { path: entry.path, profile: entry.profile, pinned: entry.pinned, commit: null, latestCommit: null, findings: [], error: null };
    if (!fs.existsSync(entry.path)) return { ...base, state: 'missing', exitCode: EXIT.ok };
    try {
      const report = checkProject(entry.path, { refresh: options.refresh, remoteHead });
      return {
        ...base,
        profile: report.profile ?? entry.profile,
        pinned: report.pinned,
        commit: report.commit,
        latestCommit: report.latestCommit,
        findings: report.findings,
        state: STATE_BY_CODE[report.exitCode] ?? 'error',
        exitCode: report.exitCode
      };
    } catch (error) {
      const cliError = toCliError(error);
      return { ...base, state: 'error', exitCode: cliError.exitCode, error: { code: cliError.code, message: cliError.message, hint: cliError.hint } };
    }
  });
}
