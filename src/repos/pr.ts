import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { _ } from '../i18n/index.ts';
import { planFor, PROJECT_CONFIG_FILE, readProjectConfig, type ApplyPlan } from '../profile/apply.ts';
import { profileLocation } from '../profile/store.ts';
import { writePlan } from '../project/plan.ts';
import { EXIT, toCliError, usageError } from '../shared/errors.ts';
import { git, sanitizeRemoteUrl } from '../shared/git.ts';
import { selectRepos } from './registry.ts';
import { namedFiles } from './sync.ts';

/**
 * `agctx repos pr`: 프로필이 바뀐 저장소마다 임시 worktree(`--targets` URL이면 임시 clone)에서
 * 갱신을 쓰고, 새 브랜치에 커밋해 push하고, `gh`로 pull request를 연다. 사용자의 작업 사본과 로컬
 * 브랜치는 건드리지 않는다.
 */

export type PrState =
  | 'would-open'
  | 'opened'
  | 'pushed'
  | 'up-to-date'
  | 'pr-exists'
  | 'branch-exists'
  | 'skipped'
  | 'conflict'
  | 'missing'
  | 'error';

export interface PrItem {
  target: string;
  profile: string | null;
  state: PrState;
  exitCode: number;
  base: string | null;
  branch: string | null;
  url: string | null;
  files: string[];
  detail: string;
}

export interface PrOptions {
  profile: string | null;
  targets: string | null;
  base: string | null;
  draft: boolean;
  message: string | null;
}

interface Target {
  label: string;
  location: string;
  clone: boolean;
}

interface Workspace {
  /** 임시 작업 트리의 맨 위. */
  root: string;
  /** 그 안의 프로젝트 폴더. */
  project: string;
  base: string;
  cleanup(): void;
}

export interface Candidate {
  item: PrItem;
  workspace: Workspace;
  plan: ApplyPlan;
  fromCommit: string | null;
  title: string;
}

const COMMIT = /^[0-9a-f]{7,64}$/i;
const BRANCH_NAME = /^(?!-)[\w./-]+$/;

function assertBranchName(name: string): void {
  if (!BRANCH_NAME.test(name) || name.includes('..')) {
    throw usageError('repos.invalid-branch', _('error.repos.invalid-branch', { branch: name }), _('hint.repos.base'));
  }
}

function targetsFrom(options: PrOptions): Target[] {
  if (!options.targets)
    return selectRepos(options.profile).map(entry => ({ label: entry.path, location: entry.path, clone: false }));
  const file = path.resolve(options.targets);
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    throw usageError(
      'repos.targets-unreadable',
      _('error.repos.targets-unreadable', { file }),
      _('hint.repos.targets')
    );
  }
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      // 작업 사본이면 그 자리에서 쓰고, 그 밖(URL, bare 저장소)은 clone한다.
      const local = path.resolve(path.dirname(file), line);
      if (fs.existsSync(path.join(local, '.git'))) return { label: local, location: local, clone: false };
      return fs.existsSync(local)
        ? { label: local, location: local, clone: true }
        : { label: sanitizeRemoteUrl(line), location: line, clone: true };
    });
}

function temporaryHolder(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-pr-'));
}

function defaultBase(top: string): string {
  const remoteHead = git(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], {
    cwd: top,
    allowFailure: true
  }).stdout.trim();
  if (remoteHead.startsWith('origin/')) return remoteHead.slice('origin/'.length);
  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: top, allowFailure: true }).stdout.trim();
  const merge = branch ? git(['config', `branch.${branch}.merge`], { cwd: top, allowFailure: true }).stdout.trim() : '';
  if (merge.startsWith('refs/heads/')) return merge.slice('refs/heads/'.length);
  if (branch) return branch;
  throw usageError('repos.no-base', _('error.repos.no-base', { project: top }), _('hint.repos.base'));
}

/** 사용자 작업 사본 옆, 원격 기준 브랜치에서 만든 detached worktree. */
function worktreeFor(projectDir: string, requestedBase: string | null): Workspace {
  if (!fs.existsSync(projectDir)) throw usageError('repos.missing', _('repos.sync.missing'), null);
  const top = git(['rev-parse', '--show-toplevel', '--show-prefix'], { cwd: projectDir, allowFailure: true });
  if (top.status !== 0)
    throw usageError('repos.not-git', _('error.repos.not-git', { project: projectDir }), _('hint.repos.targets'));
  // git이 맨 위 폴더와 그 아래 폴더의 위치를 알려 주므로, Windows 짧은 이름이나 다른 대소문자 표기가 프로젝트 위치를 틀리게 만들지 않는다.
  const [topDir, prefix = ''] = top.stdout.split(/\r?\n/);
  const relative = prefix.replace(/\/$/, '');
  if (git(['remote', 'get-url', 'origin'], { cwd: topDir, allowFailure: true }).status !== 0) {
    throw usageError(
      'repos.no-remote',
      _('error.repos.no-remote', { project: projectDir }),
      _('hint.repos.no-remote', { project: projectDir })
    );
  }
  const base = requestedBase ?? defaultBase(topDir);
  assertBranchName(base);
  git(['fetch', '--quiet', 'origin', `+refs/heads/${base}:refs/remotes/origin/${base}`], { cwd: topDir });
  const holder = temporaryHolder();
  const root = path.join(holder, 'work');
  try {
    git(['worktree', 'add', '--detach', root, `refs/remotes/origin/${base}`], { cwd: topDir });
  } catch (error) {
    fs.rmSync(holder, { recursive: true, force: true });
    throw error;
  }
  return {
    root,
    project: path.join(root, relative),
    base,
    cleanup() {
      git(['worktree', 'remove', '--force', root], { cwd: topDir, allowFailure: true });
      fs.rmSync(holder, { recursive: true, force: true });
      git(['worktree', 'prune'], { cwd: topDir, allowFailure: true });
    }
  };
}

/** 봇이 로컬에 두지 않는 대상을 위한 임시 clone. */
function cloneFor(url: string, requestedBase: string | null): Workspace {
  if (requestedBase) assertBranchName(requestedBase);
  const holder = temporaryHolder();
  const root = path.join(holder, 'work');
  const cleanup = () => fs.rmSync(holder, { recursive: true, force: true });
  try {
    git([
      'clone',
      '--quiet',
      '--no-recurse-submodules',
      ...(requestedBase ? [`--branch=${requestedBase}`] : []),
      '--',
      url,
      root
    ]);
    const base = requestedBase ?? git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: root }).stdout.trim();
    return { root, project: root, base, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

interface GhResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** 묻지 않고 gh를 실행한다. gh가 없으면 오류가 아니라 실패한 호출로 보고한다. */
function gh(args: readonly string[], cwd: string): GhResult {
  const env = { ...process.env, GH_PROMPT_DISABLED: '1' };
  const result =
    process.platform === 'win32'
      ? spawnSync(
          'gh',
          args.map(arg => `"${arg.replaceAll('"', '\\"')}"`),
          { cwd, env, encoding: 'utf8', shell: true }
        )
      : spawnSync('gh', [...args], { cwd, env, encoding: 'utf8' });
  if (result.error) return { ok: false, stdout: '', stderr: ghFailureReason(result.error) };
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function existingPullRequest(root: string, branch: string): string | null {
  const listed = gh(['pr', 'list', '--head', branch, '--state', 'open', '--json', 'url'], root);
  if (!listed.ok) return null;
  try {
    const pulls: unknown = JSON.parse(listed.stdout);
    const first = Array.isArray(pulls) ? (pulls[0] as { url?: unknown } | undefined) : undefined;
    return typeof first?.url === 'string' ? first.url : null;
  } catch {
    return null;
  }
}

function remoteBranchExists(root: string, branch: string): boolean {
  return git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { cwd: root }).stdout.trim() !== '';
}

function compareUrl(root: string, base: string, branch: string): string | null {
  const url = git(['remote', 'get-url', 'origin'], { cwd: root, allowFailure: true }).stdout.trim();
  const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  return match ? `https://github.com/${match[1]}/${match[2]}/compare/${base}...${branch}?expand=1` : null;
}

function planTarget(
  item: PrItem,
  workspace: Workspace,
  options: PrOptions,
  dryRun: boolean
): { item: PrItem; candidate: Candidate | null } {
  const config = readProjectConfig(path.join(workspace.project, PROJECT_CONFIG_FILE));
  const profile = config.profile ?? null;
  const planned: PrItem = { ...item, profile, base: workspace.base };
  if (!profile) return { item: { ...planned, exitCode: EXIT.usage, detail: _('repos.not-applied') }, candidate: null };
  if (options.profile && profile !== options.profile) {
    return {
      item: { ...planned, state: 'skipped', exitCode: EXIT.ok, detail: _('repos.pr.skipped', { profile }) },
      candidate: null
    };
  }
  // 고정한 저장소는 프로필의 현재 커밋으로 다시 고정하고, 나머지는 보관함을 따른다.
  const plan = planFor(profile, workspace.project, config.pin === true ? true : 'keep');
  if (plan.plan.conflicts.length || plan.plan.unmanaged.length) {
    const files = [...plan.plan.conflicts, ...plan.plan.unmanaged].map(file => file.rel);
    return {
      item: {
        ...planned,
        state: 'conflict',
        exitCode: EXIT.conflict,
        files,
        detail: _(plan.plan.conflicts.length ? 'repos.pr.conflict' : 'repos.pr.unmanaged', { files: files.join(', ') })
      },
      candidate: null
    };
  }
  if (!plan.plan.changes.some(change => change.status !== 'unchanged')) {
    return {
      item: { ...planned, state: 'up-to-date', exitCode: EXIT.ok, detail: _('repos.sync.up-to-date') },
      candidate: null
    };
  }
  const commit = plan.version.source?.commit;
  const version = commit
    ? commit.slice(0, 7)
    : `local-${createHash('sha256').update(plan.version.content).digest('hex').slice(0, 8)}`;
  const branch = `agctx/${profile}-${version}`;
  const withBranch: PrItem = { ...planned, branch, files: namedFiles(plan) };
  const url = existingPullRequest(workspace.root, branch);
  if (url)
    return {
      item: { ...withBranch, state: 'pr-exists', exitCode: EXIT.ok, url, detail: _('repos.pr.pr-exists', { url }) },
      candidate: null
    };
  if (remoteBranchExists(workspace.root, branch)) {
    return {
      item: {
        ...withBranch,
        state: 'branch-exists',
        exitCode: EXIT.ok,
        detail: _('repos.pr.branch-exists', { branch })
      },
      candidate: null
    };
  }
  const next: PrItem = {
    ...withBranch,
    state: 'would-open',
    exitCode: EXIT.ok,
    detail: _('repos.pr.would-open', { branch, base: workspace.base, count: withBranch.files.length })
  };
  const title = options.message ?? `chore(agctx): update ${profile} profile to ${version}`;
  return {
    item: next,
    candidate: dryRun ? null : { item: next, workspace, plan, fromCommit: config.source?.commit ?? null, title }
  };
}

export interface PreparedPrs {
  items: PrItem[];
  candidates: Candidate[];
  cleanup(): void;
}

/** 모든 대상을 계획한다. pull request를 받을 저장소의 작업 공간은 `cleanup()`까지 남는다. */
export function prepareReposPrs(options: PrOptions, dryRun: boolean): PreparedPrs {
  const kept: Workspace[] = [];
  const cleanup = () => kept.splice(0).forEach(workspace => workspace.cleanup());
  const items: PrItem[] = [];
  const candidates: Candidate[] = [];
  try {
    for (const target of targetsFrom(options)) {
      const item: PrItem = {
        target: target.label,
        profile: null,
        state: 'error',
        exitCode: EXIT.software,
        base: null,
        branch: null,
        url: null,
        files: [],
        detail: ''
      };
      if (!target.clone && !fs.existsSync(target.location)) {
        items.push({ ...item, state: 'missing', exitCode: EXIT.ok, detail: _('repos.sync.missing') });
        continue;
      }
      let workspace: Workspace | null = null;
      try {
        workspace = target.clone ? cloneFor(target.location, options.base) : worktreeFor(target.location, options.base);
        const planned = planTarget(item, workspace, options, dryRun);
        items.push(planned.item);
        if (planned.candidate) {
          candidates.push(planned.candidate);
          kept.push(workspace);
        } else {
          workspace.cleanup();
        }
      } catch (error) {
        workspace?.cleanup();
        const cliError = toCliError(error);
        items.push({
          ...item,
          exitCode: cliError.exitCode,
          detail: cliError.hint ? `${cliError.message} ${cliError.hint}` : cliError.message
        });
      }
    }
  } catch (error) {
    cleanup();
    throw error;
  }
  return { items, candidates, cleanup };
}

function profileCommits(profile: string, from: string | null, to: string | null): string[] {
  if (!from || !to || from === to || !COMMIT.test(from) || !COMMIT.test(to)) return [];
  // 연결된 프로필의 이력은 보관함이 아니라 그것이 가리키는 폴더에 있다.
  const dir = profileLocation(profile)?.dir;
  if (!dir) return [];
  const log = git(['log', '--oneline', '--max-count=20', `${from}..${to}`], { cwd: dir, allowFailure: true });
  return log.status === 0 ? log.stdout.split('\n').filter(Boolean) : [];
}

function pullRequestBody(candidate: Candidate): string {
  const { item, plan, fromCommit } = candidate;
  const source = plan.version.source;
  const short = (commit: string | null | undefined) => (commit ? commit.slice(0, 7) : '-');
  const lines = [_('repos.pr.body.intro'), '', `- ${_('repos.pr.body.profile', { profile: item.profile ?? '' })}`];
  if (source?.git) lines.push(`- ${_('repos.pr.body.source', { source: `${source.git} (${source.branch ?? '-'})` })}`);
  lines.push(`- ${_('repos.pr.body.version', { from: short(fromCommit), to: short(source?.commit) })}`);
  lines.push(
    `- ${_('repos.pr.body.pinned', { pinned: plan.version.pin ? _('repos.pr.body.yes') : _('repos.pr.body.no') })}`
  );
  const commits = profileCommits(item.profile ?? '', fromCommit, source?.commit ?? null);
  if (commits.length) lines.push('', _('repos.pr.body.commits'), ...commits.map(commit => `- ${commit}`));
  // 지우는 파일은 리뷰어가 diff를 열기 전에 알 수 있게 표시한다(고르지 않은 에이전트의 파일).
  const removed = new Set(
    plan.plan.changes.filter(change => change.status === 'remove').map(change => change.relativePath)
  );
  lines.push(
    '',
    _('repos.pr.body.files'),
    ...item.files.map(file => `- \`${file}\`${removed.has(file) ? ` ${_('repos.pr.body.removed')}` : ''}`),
    '',
    _('repos.pr.body.check')
  );
  return `${lines.join('\n')}\n`;
}

/** 후보마다 커밋하고 push하고 pull request를 연다. 실패는 그 저장소에만 남는다. */
export function openPullRequests(candidates: readonly Candidate[], options: PrOptions): PrItem[] {
  return candidates.map(candidate => {
    const { item, workspace, plan, title } = candidate;
    const branch = item.branch as string;
    try {
      writePlan(plan.plan.changes, workspace.project);
      const changed = plan.plan.changes
        .filter(change => change.status !== 'unchanged')
        .map(change => path.relative(workspace.root, change.target));
      git(['add', '--', ...changed], { cwd: workspace.root });
      git(['commit', '--quiet', '-m', title], { cwd: workspace.root });
      git(['push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`], { cwd: workspace.root });
      const bodyFile = path.join(path.dirname(workspace.root), 'pull-request.md');
      fs.writeFileSync(bodyFile, pullRequestBody(candidate));
      const created = gh(
        [
          'pr',
          'create',
          '--base',
          workspace.base,
          '--head',
          branch,
          '--title',
          title,
          '--body-file',
          bodyFile,
          ...(options.draft ? ['--draft'] : [])
        ],
        workspace.root
      );
      const url = created.ok ? created.stdout.trim().split('\n').pop()?.trim() || null : null;
      if (url) return { ...item, state: 'opened' as const, url, detail: _('repos.pr.opened', { branch, url }) };
      const compare = compareUrl(workspace.root, workspace.base, branch);
      const reason = created.stderr.trim().split('\n').pop() ?? '';
      return {
        ...item,
        state: 'pushed' as const,
        detail: _('repos.pr.pushed', { branch, base: workspace.base, link: compare ? ` ${compare}` : '', reason })
      };
    } catch (error) {
      const cliError = toCliError(error);
      return { ...item, state: 'error' as const, exitCode: cliError.exitCode, detail: cliError.message };
    }
  });
}

/** gh를 실행하지 못한 이유를 사람에게 알리는 말. GitHub CLI가 없으면 말로 풀고, 다른 실행 오류는 보고된 그대로. */
export function ghFailureReason(error: Error): string {
  return (error as NodeJS.ErrnoException).code === 'ENOENT' ? _('repos.pr.gh-missing') : error.message;
}
