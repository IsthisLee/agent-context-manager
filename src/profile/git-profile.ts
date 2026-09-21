import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { _ } from '../i18n/index.ts';
import { PROFILE_METADATA_FILE, profileHome } from '../shared/home.ts';
import { CliError, EXIT, usageError } from '../shared/errors.ts';
import { committedFile, git, isGitRoot, resolveRemoteLocation, sanitizeRemoteUrl } from '../shared/git.ts';
import { describeHiddenCharacters, findHiddenCharacters } from '../shared/hidden-chars.ts';
import type { ProfileMetadata } from '../shared/types.ts';
import { assertInstructionsPath, instructionsFile, isInstructionsPath, isValidProfileMetadata, readProfile, regularFileInside } from './store.ts';

/**
 * Share profiles through ordinary Git repositories. These commands change only
 * the profile store; repository files change only through apply, sync, or resolve.
 */

export interface ProfileGitState {
  name: string;
  dir: string;
  connected: boolean;
  remote: string | null;
  branch: string | null;
  /** The remote branch the current branch tracks and pushes to, from its merge setting; null when it tracks none. */
  remoteBranch: string | null;
  commit: string | null;
  /** Remote-tracking ref for the branch, when configured and fetched. */
  upstream: string | null;
  dirty: string[];
  ahead: number | null;
  behind: number | null;
  refreshed: boolean;
}

function lines(text: string): string[] {
  return text.split('\n').map(line => line.trimEnd()).filter(Boolean);
}

/** Refuse profile content that hides characters, before anything is registered or updated. */
export function assertNoHiddenCharacters(files: readonly { file: string; content: string }[]): void {
  const findings = files.flatMap(({ file, content }) => describeHiddenCharacters(file, findHiddenCharacters(content)));
  if (findings.length) {
    throw new CliError('profile.hidden-characters', _('error.hidden', { findings: findings.join('\n  ') }), { exitCode: EXIT.hiddenCharacters, hint: _('hint.hidden'), details: findings });
  }
}

export function profileGitState(name: string, options: { refresh?: boolean } = {}): ProfileGitState {
  const { profileDir: dir } = readProfile(name);
  const state: ProfileGitState = { name, dir, connected: false, remote: null, branch: null, remoteBranch: null, commit: null, upstream: null, dirty: [], ahead: null, behind: null, refreshed: false };
  if (!isGitRoot(dir)) return state;
  state.connected = true;
  state.branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: dir, allowFailure: true }).stdout.trim() || null;
  state.commit = git(['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: dir, allowFailure: true }).stdout.trim() || null;
  state.dirty = lines(git(['status', '--porcelain'], { cwd: dir }).stdout);
  const remoteName = state.branch ? git(['config', `branch.${state.branch}.remote`], { cwd: dir, allowFailure: true }).stdout.trim() : '';
  const remote = remoteName || 'origin';
  const url = git(['remote', 'get-url', remote], { cwd: dir, allowFailure: true }).stdout.trim();
  state.remote = url ? sanitizeRemoteUrl(url) : null;
  if (options.refresh && url) {
    git(['fetch', '--quiet', remote], { cwd: dir });
    state.refreshed = true;
  }
  const merge = state.branch ? git(['config', `branch.${state.branch}.merge`], { cwd: dir, allowFailure: true }).stdout.trim() : '';
  if (merge.startsWith('refs/heads/')) state.remoteBranch = merge.slice('refs/heads/'.length);
  if (remoteName && merge.startsWith('refs/heads/')) {
    const ref = `refs/remotes/${remoteName}/${merge.slice('refs/heads/'.length)}`;
    if (git(['rev-parse', '--verify', '--quiet', ref], { cwd: dir, allowFailure: true }).status === 0) {
      state.upstream = ref;
      if (state.commit) {
        const [ahead, behind] = git(['rev-list', '--left-right', '--count', `HEAD...${ref}`], { cwd: dir }).stdout.trim().split(/\s+/).map(Number);
        state.ahead = ahead;
        state.behind = behind;
      }
    }
  }
  return state;
}

export function cloneProfile(location: string, options: { branch?: string | null } = {}): ProfileGitState {
  const url = resolveRemoteLocation(location);
  const home = profileHome();
  fs.mkdirSync(home, { recursive: true });
  const temporary = path.join(home, `.clone-${randomUUID()}`);
  try {
    git(['clone', '--quiet', '--no-recurse-submodules', ...(options.branch ? ['--branch', options.branch] : []), '--', url, temporary]);
    const source = sanitizeRemoteUrl(url);
    const metadataPath = regularFileInside(temporary, PROFILE_METADATA_FILE);
    if (!metadataPath) throw usageError('clone.not-profile', _('error.clone.not-profile', { url: source, file: PROFILE_METADATA_FILE }), _('hint.clone.not-profile'));
    const metadataText = fs.readFileSync(metadataPath, 'utf8');
    let metadata: unknown;
    try { metadata = JSON.parse(metadataText); } catch { metadata = null; }
    if (!isValidProfileMetadata(metadata)) {
      throw usageError('clone.invalid-metadata', _('error.clone.invalid-metadata', { url: source }), _('hint.clone.not-profile'));
    }
    const file = instructionsFile(metadata);
    assertInstructionsPath(file, source);
    const instructionsPath = regularFileInside(temporary, file);
    if (!instructionsPath) {
      if (metadata.instructions === undefined) throw usageError('clone.not-profile', _('error.clone.not-profile', { url: source, file }), _('hint.clone.not-profile'));
      throw usageError('profile.instructions-missing', _('error.profile.instructions-missing', { source, file }), _('hint.profile.instructions'));
    }
    assertNoHiddenCharacters([{ file: PROFILE_METADATA_FILE, content: metadataText }, { file, content: fs.readFileSync(instructionsPath, 'utf8') }]);
    const target = path.join(home, metadata.name);
    if (fs.existsSync(target) || isSymbolicLink(target)) {
      throw usageError('clone.exists', _('error.clone.exists', { name: metadata.name }), _('hint.clone.exists', { name: metadata.name }));
    }
    fs.renameSync(temporary, target);
    return profileGitState(metadata.name);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { recursive: true, force: true });
  }
}

export interface CommittedProfile {
  metadataText: string;
  metadata: ProfileMetadata;
  /** The rules file profile.json names at that commit. */
  file: string;
  /** Its content, or null when the commit has no regular file there. */
  content: string | null;
}

/**
 * profile.json and the rules file it names, as commit `rev` holds them. Null when that commit has no
 * valid profile.json for `name`. The rules file path is read from the same commit, so a profile that
 * later moved its rules file still finds the file an older commit used.
 */
export function committedProfile(dir: string, rev: string, name: string): CommittedProfile | null {
  const metadataText = committedFile(dir, rev, PROFILE_METADATA_FILE);
  if (metadataText === null) return null;
  let metadata: unknown = null;
  try { metadata = JSON.parse(metadataText); } catch {}
  if (!isValidProfileMetadata(metadata, name)) return null;
  const file = instructionsFile(metadata);
  return { metadataText, metadata, file, content: isInstructionsPath(file) ? committedFile(dir, rev, file) : null };
}

function isSymbolicLink(target: string): boolean {
  try { return fs.lstatSync(target).isSymbolicLink(); } catch { return false; }
}

function requireConnected(state: ProfileGitState): void {
  if (!state.connected || !state.remote) {
    throw usageError('profile.not-connected', _('error.profile.not-connected', { name: state.name }), _('hint.profile.connect', { name: state.name }));
  }
}

export interface PullPlan {
  state: ProfileGitState;
  commits: string[];
  changedFiles: string[];
  applied: boolean;
}

export function pullProfile(name: string, options: { dryRun?: boolean } = {}): PullPlan {
  const state = profileGitState(name, { refresh: true });
  requireConnected(state);
  if (!state.upstream) throw usageError('pull.no-upstream', _('error.pull.no-upstream', { name }), _('hint.profile.connect', { name }));
  if (state.dirty.length) throw new CliError('pull.dirty', _('error.pull.dirty', { name, files: state.dirty.join('\n  ') }), { exitCode: EXIT.conflict, hint: _('hint.git.commit', { dir: state.dir }) });
  if ((state.ahead ?? 0) > 0 && (state.behind ?? 0) > 0) throw new CliError('pull.diverged', _('error.pull.diverged', { name }), { exitCode: EXIT.conflict, hint: _('hint.git.diverged', { dir: state.dir }) });
  const commits = lines(git(['log', '--oneline', `HEAD..${state.upstream}`], { cwd: state.dir }).stdout);
  const changedFiles = lines(git(['diff', '--name-only', `HEAD..${state.upstream}`], { cwd: state.dir }).stdout);
  if (!commits.length) return { state, commits, changedFiles, applied: false };
  const incoming = committedProfile(state.dir, state.upstream, name);
  if (!incoming) throw usageError('pull.invalid', _('error.pull.invalid', { name }), null);
  assertInstructionsPath(incoming.file, state.remote ?? name);
  if (incoming.content === null) throw usageError('pull.invalid', _('error.pull.invalid', { name }), null);
  assertNoHiddenCharacters([{ file: PROFILE_METADATA_FILE, content: incoming.metadataText }, { file: incoming.file, content: incoming.content }]);
  if (options.dryRun) return { state, commits, changedFiles, applied: false };
  git(['merge', '--ff-only', '--quiet', state.upstream], { cwd: state.dir });
  return { state: profileGitState(name), commits, changedFiles, applied: true };
}

export interface PushPlan {
  state: ProfileGitState;
  commits: string[];
  pushed: boolean;
}

/** Send commits that already exist. Never stages or commits; the caller confirms before `pushed` can become true. */
export function planPush(name: string): PushPlan {
  const state = profileGitState(name, { refresh: true });
  requireConnected(state);
  if (!state.branch) throw usageError('push.detached', _('error.push.detached', { name }), null);
  if (state.dirty.length) throw new CliError('push.dirty', _('error.push.dirty', { name, files: state.dirty.join('\n  ') }), { exitCode: EXIT.conflict, hint: _('hint.git.commit', { dir: state.dir }) });
  if ((state.behind ?? 0) > 0) throw new CliError('push.behind', _('error.push.behind', { name }), { exitCode: EXIT.conflict, hint: _('hint.profile.pull', { name }) });
  const range = state.upstream ? `${state.upstream}..HEAD` : 'HEAD';
  const commits = state.commit ? lines(git(['log', '--oneline', range], { cwd: state.dir }).stdout) : [];
  return { state, commits, pushed: false };
}

export function pushProfile(plan: PushPlan): PushPlan {
  if (!plan.commits.length) return plan;
  const branch = plan.state.branch as string;
  const remoteName = git(['config', `branch.${branch}.remote`], { cwd: plan.state.dir, allowFailure: true }).stdout.trim() || 'origin';
  // Push to the branch the current branch tracks, which connect --branch may name differently from the local branch.
  git(['push', '--quiet', remoteName, `HEAD:refs/heads/${plan.state.remoteBranch ?? branch}`], { cwd: plan.state.dir });
  return { state: profileGitState(plan.state.name), commits: plan.commits, pushed: true };
}

export function connectProfile(name: string, location: string, options: { branch?: string | null } = {}): ProfileGitState {
  const url = resolveRemoteLocation(location);
  const { profileDir: dir } = readProfile(name);
  if (!isGitRoot(dir)) {
    throw usageError('connect.not-git', _('error.connect.not-git', { name }), _('hint.connect.init', { dir, name }));
  }
  const existing = git(['remote', 'get-url', 'origin'], { cwd: dir, allowFailure: true });
  if (existing.status === 0 && existing.stdout.trim() !== url) {
    throw usageError('connect.origin-exists', _('error.connect.origin-exists', { name, remote: sanitizeRemoteUrl(existing.stdout.trim()) }), _('hint.connect.set-url', { dir }));
  }
  git(['ls-remote', '--heads', '--', url], { cwd: dir });
  // push, pull, and status all read the current branch's tracking settings, so connect writes them there.
  // --branch names the remote branch to track when it differs from the local branch name.
  const local = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: dir, allowFailure: true }).stdout.trim();
  if (!local) throw usageError('connect.no-branch', _('error.connect.no-branch', { name }), null);
  const branch = options.branch || local;
  if (existing.status !== 0) git(['remote', 'add', 'origin', url], { cwd: dir });
  git(['config', `branch.${local}.remote`, 'origin'], { cwd: dir });
  git(['config', `branch.${local}.merge`, `refs/heads/${branch}`], { cwd: dir });
  return profileGitState(name);
}
