import fs from 'node:fs';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { planFor, PROJECT_CONFIG_FILE, readProjectConfig, type ApplyPlan } from '../profile/apply.ts';
import { writePlan } from '../project/plan.ts';
import { EXIT, toCliError } from '../shared/errors.ts';
import { git } from '../shared/git.ts';
import { recordRepo, selectRepos } from './registry.ts';

/**
 * `agctx repos sync`: plan every listed repository first, then write the ones
 * that can be updated. Pinned repositories change only through `repos pr`.
 */

export type SyncState = 'update' | 'updated' | 'up-to-date' | 'pinned' | 'dirty' | 'conflict' | 'missing' | 'error';

export interface SyncItem {
  path: string;
  profile: string;
  state: SyncState;
  exitCode: number;
  files: string[];
  detail: string;
  plan: ApplyPlan | null;
}

/** Files a sync rewrites; uncommitted edits to them would be mixed into the sync. */
const MANAGED_FILES = ['AGENTS.md', 'CLAUDE.md', '.agents/rules/agctx.md', PROJECT_CONFIG_FILE];

function insideGitWorkTree(dir: string): boolean {
  for (let current = path.resolve(dir); ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) return true;
    if (path.dirname(current) === current) return false;
  }
}

/** Tracked managed files with uncommitted changes. Untracked files never block a sync. */
function uncommittedManagedFiles(dir: string): string[] {
  if (!insideGitWorkTree(dir)) return [];
  const result = git(['status', '--porcelain', '--untracked-files=no', '--', ...MANAGED_FILES], { cwd: dir, allowFailure: true });
  if (result.status !== 0) return [];
  return result.stdout.split('\n').filter(Boolean).map(line => line.slice(3).trim());
}

/** Files worth naming in a summary: the base copies under `.agctx/` follow the managed files. */
export function namedFiles(plan: ApplyPlan): string[] {
  return plan.plan.changes.filter(change => change.status !== 'unchanged' && !change.relativePath.startsWith('.agctx/')).map(change => change.relativePath);
}

function failed(item: SyncItem, error: unknown): SyncItem {
  const cliError = toCliError(error);
  return { ...item, state: 'error', exitCode: cliError.exitCode, detail: cliError.hint ? `${cliError.message} ${cliError.hint}` : cliError.message };
}

export function planReposSync(profileFilter: string | null): SyncItem[] {
  return selectRepos(profileFilter).map((entry): SyncItem => {
    const item: SyncItem = { path: entry.path, profile: entry.profile, state: 'error', exitCode: EXIT.software, files: [], detail: '', plan: null };
    if (!fs.existsSync(entry.path)) return { ...item, state: 'missing', exitCode: EXIT.ok, detail: _('repos.sync.missing') };
    try {
      const config = readProjectConfig(path.join(entry.path, PROJECT_CONFIG_FILE));
      if (!config.profile) return { ...item, exitCode: EXIT.usage, detail: _('repos.not-applied') };
      const profile = config.profile;
      if (config.pin) {
        return { ...item, profile, state: 'pinned', exitCode: EXIT.ok, detail: _('repos.sync.pinned', { commit: (config.source?.commit ?? '').slice(0, 7), profile }) };
      }
      const dirty = uncommittedManagedFiles(entry.path);
      if (dirty.length) {
        // Still behind: report it, but leave the user's edits alone.
        return { ...item, profile, state: 'dirty', exitCode: EXIT.behind, files: dirty, detail: _('repos.sync.dirty', { files: dirty.join(', ') }) };
      }
      const plan = planFor(profile, entry.path, 'keep');
      if (plan.plan.conflicts.length) {
        const files = plan.plan.conflicts.map(file => file.rel);
        return { ...item, profile, state: 'conflict', exitCode: EXIT.conflict, files, detail: _('repos.sync.conflict', { files: files.join(', '), project: entry.path }) };
      }
      if (!plan.plan.changes.some(change => change.status !== 'unchanged')) {
        return { ...item, profile, state: 'up-to-date', exitCode: EXIT.ok, detail: _('repos.sync.up-to-date'), plan };
      }
      const files = namedFiles(plan);
      return { ...item, profile, state: 'update', exitCode: EXIT.ok, files, detail: _('repos.sync.update', { count: files.length, files: files.join(', ') }), plan };
    } catch (error) {
      return failed(item, error);
    }
  });
}

/** Write the planned updates. One repository failing does not stop the others. */
export function applyReposSync(items: readonly SyncItem[]): SyncItem[] {
  return items.map(item => {
    if (item.state !== 'update' || !item.plan) return item;
    try {
      writePlan(item.plan.plan.changes, item.path);
      recordRepo(item.path, item.profile, false);
      return { ...item, state: 'updated', detail: _('repos.sync.updated', { count: item.files.length, files: item.files.join(', ') }) };
    } catch (error) {
      return failed(item, error);
    }
  });
}
