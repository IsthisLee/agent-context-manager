import fs from 'node:fs';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { planFor, PROJECT_CONFIG_FILE, readProjectConfig, type ApplyPlan } from '../profile/apply.ts';
import { writePlan } from '../project/plan.ts';
import { EXIT, toCliError } from '../shared/errors.ts';
import { git } from '../shared/git.ts';
import { shellWord } from '../shared/shell.ts';
import { recordRepo, selectRepos } from './registry.ts';

/**
 * `agctx repos sync`: 목록의 모든 저장소를 먼저 계획하고, 그다음 갱신할 수 있는 저장소를 쓴다.
 * 고정한 저장소는 `repos pr`로만 바뀐다.
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

/** sync가 다시 쓰는 파일. 여기에 커밋하지 않은 수정이 있으면 sync에 섞인다. 링크 파일은 기록된 해시에서 온다. */
const MANAGED_FILES = ['AGENTS.md', 'CLAUDE.md', '.agents/rules/agctx.md', PROJECT_CONFIG_FILE];

function managedFiles(dir: string): string[] {
  return [
    ...new Set([
      ...MANAGED_FILES,
      ...Object.keys(readProjectConfig(path.join(dir, PROJECT_CONFIG_FILE)).managedHashes ?? {})
    ])
  ];
}

function insideGitWorkTree(dir: string): boolean {
  for (let current = path.resolve(dir); ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) return true;
    if (path.dirname(current) === current) return false;
  }
}

/** 커밋하지 않은 변경이 있는, 추적 중인 관리 파일. 추적하지 않는 파일은 sync를 막지 않는다. */
function uncommittedManagedFiles(dir: string): string[] {
  if (!insideGitWorkTree(dir)) return [];
  const result = git(['status', '--porcelain', '--untracked-files=no', '--', ...managedFiles(dir)], {
    cwd: dir,
    allowFailure: true
  });
  if (result.status !== 0) return [];
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map(line => line.slice(3).trim());
}

/** 요약에 이름을 적을 만한 파일. `.agctx/` 아래의 base 사본은 관리 파일을 따라가므로 뺀다. */
export function namedFiles(plan: ApplyPlan): string[] {
  return plan.plan.changes
    .filter(change => change.status !== 'unchanged' && !change.relativePath.startsWith('.agctx/'))
    .map(change => change.relativePath);
}

function failed(item: SyncItem, error: unknown): SyncItem {
  const cliError = toCliError(error);
  return {
    ...item,
    state: 'error',
    exitCode: cliError.exitCode,
    detail: cliError.hint ? `${cliError.message} ${cliError.hint}` : cliError.message
  };
}

export function planReposSync(profileFilter: string | null): SyncItem[] {
  return selectRepos(profileFilter).map((entry): SyncItem => {
    const item: SyncItem = {
      path: entry.path,
      profile: entry.profile,
      state: 'error',
      exitCode: EXIT.software,
      files: [],
      detail: '',
      plan: null
    };
    if (!fs.existsSync(entry.path))
      return { ...item, state: 'missing', exitCode: EXIT.ok, detail: _('repos.sync.missing') };
    try {
      const config = readProjectConfig(path.join(entry.path, PROJECT_CONFIG_FILE));
      if (!config.profile) return { ...item, exitCode: EXIT.usage, detail: _('repos.not-applied') };
      const profile = config.profile;
      if (config.pin) {
        return {
          ...item,
          profile,
          state: 'pinned',
          exitCode: EXIT.ok,
          detail: _('repos.sync.pinned', { commit: (config.source?.commit ?? '').slice(0, 7), profile })
        };
      }
      const dirty = uncommittedManagedFiles(entry.path);
      if (dirty.length) {
        // 여전히 뒤처졌다. 보고하되 사용자의 수정은 건드리지 않는다.
        return {
          ...item,
          profile,
          state: 'dirty',
          exitCode: EXIT.behind,
          files: dirty,
          detail: _('repos.sync.dirty', { files: dirty.join(', ') })
        };
      }
      const plan = planFor(profile, entry.path, 'keep');
      if (plan.plan.conflicts.length) {
        const files = plan.plan.conflicts.map(file => file.rel);
        return {
          ...item,
          profile,
          state: 'conflict',
          exitCode: EXIT.conflict,
          files,
          detail: _('repos.sync.conflict', { files: files.join(', '), project: entry.path })
        };
      }
      if (plan.plan.unmanaged.length) {
        const files = plan.plan.unmanaged.map(file => file.rel);
        return {
          ...item,
          profile,
          state: 'conflict',
          exitCode: EXIT.conflict,
          files,
          detail: _('repos.sync.unmanaged', { files: files.join(', '), project: shellWord(entry.path) })
        };
      }
      if (!plan.plan.changes.some(change => change.status !== 'unchanged')) {
        return { ...item, profile, state: 'up-to-date', exitCode: EXIT.ok, detail: _('repos.sync.up-to-date'), plan };
      }
      const files = namedFiles(plan);
      return {
        ...item,
        profile,
        state: 'update',
        exitCode: EXIT.ok,
        files,
        detail: _('repos.sync.update', { count: files.length, files: files.join(', ') }),
        plan
      };
    } catch (error) {
      return failed(item, error);
    }
  });
}

/** 계획한 갱신을 쓴다. 한 저장소가 실패해도 나머지는 멈추지 않는다. */
export function applyReposSync(items: readonly SyncItem[]): SyncItem[] {
  return items.map(item => {
    if (item.state !== 'update' || !item.plan) return item;
    try {
      writePlan(item.plan.plan.changes, item.path);
      recordRepo(item.path, item.profile, false);
      return {
        ...item,
        state: 'updated',
        detail: _('repos.sync.updated', { count: item.files.length, files: item.files.join(', ') })
      };
    } catch (error) {
      return failed(item, error);
    }
  });
}
