import fs from 'node:fs';
import path from 'node:path';
import { _ } from './i18n/index.ts';
import { assertProjectDirectory, planFor, PROJECT_CONFIG_FILE, readProjectConfig } from './profile/apply.ts';
import { profileLink } from './profile/store.ts';
import { managedRegion, regionHash } from './project/plan.ts';
import { EXIT, usageError, worstExitCode } from './shared/errors.ts';
import { toLf } from './shared/fs-utils.ts';
import { git, isGitRoot } from './shared/git.ts';
import { profileHome } from './shared/home.ts';
import { describeHiddenCharacters, findHiddenCharacters } from './shared/hidden-chars.ts';
import type { ManagedKind } from './shared/types.ts';

/**
 * `agctx check`: does this repository still match the profile version it
 * recorded? Works in CI without a profile store; add --refresh to compare the
 * recorded commit with the source repository.
 */

export type FindingKind = 'hidden-characters' | 'conflict' | 'behind';

export interface CheckFinding {
  kind: FindingKind;
  file: string | null;
  detail: string;
}

export interface CheckReport {
  project: string;
  profile: string | null;
  pinned: boolean;
  commit: string | null;
  latestCommit: string | null;
  findings: CheckFinding[];
  warnings: string[];
  exitCode: number;
}

const CODE: Record<FindingKind, number> = { 'hidden-characters': EXIT.hiddenCharacters, conflict: EXIT.conflict, behind: EXIT.behind };

const COMMIT = /^[0-9a-f]{7,64}$/i;

/** The newest commit of a remote branch, or null when the branch does not exist. */
export function remoteHeadCommit(url: string, branch: string): string | null {
  const line = git(['ls-remote', '--', url, `refs/heads/${branch}`]).stdout.trim();
  return line.split(/\s+/)[0] || null;
}

/** The profile store's commit when a pinned project recorded an older commit of the same history. */
function newerStoreCommit(profileDir: string, recorded: string | null): string | null {
  if (!recorded || !COMMIT.test(recorded) || !isGitRoot(profileDir)) return null;
  const head = git(['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: profileDir, allowFailure: true }).stdout.trim();
  if (!head || head === recorded) return null;
  return git(['merge-base', '--is-ancestor', recorded, head], { cwd: profileDir, allowFailure: true }).status === 0 ? head : null;
}

export interface CheckOptions {
  refresh?: boolean;
  /** How to read a remote branch's newest commit; `repos status` shares one lookup per source. */
  remoteHead?: (url: string, branch: string) => string | null;
}

export function checkProject(targetDir: string, options: CheckOptions = {}): CheckReport {
  assertProjectDirectory(targetDir);
  const configPath = path.join(targetDir, PROJECT_CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    throw usageError('check.not-applied', _('error.check.not-applied', { project: targetDir }), _('hint.apply', { project: targetDir }));
  }
  const config = readProjectConfig(configPath);
  const findings: CheckFinding[] = [];
  const warnings: string[] = [];

  const profile = config.profile ?? null;
  // A linked profile lives in the folder its pointer names; a broken link counts as a profile this computer lacks.
  const link = profile ? profileLink(profile) : null;
  const profileDir = profile ? (link ? link.path : path.join(profileHome(), profile)) : null;
  const inStore = Boolean(profileDir && fs.existsSync(profileDir));
  // What a sync would write, when this computer holds the profile. A managed
  // area that already holds it is not a conflict, so `check` and `sync` give
  // the same answer. Without the profile only the recorded hash is available,
  // and a differing hash stays a conflict.
  const plan = profile && inStore ? planFor(profile, targetDir, 'keep').plan : null;
  const settled = new Set((plan?.files ?? []).filter(file => file.conflict === null).map(file => file.rel));

  for (const [rel, recorded] of Object.entries(config.managedHashes ?? {})) {
    const file = path.join(targetDir, rel);
    const kind: ManagedKind = rel === 'AGENTS.md' ? 'agents' : 'pointer';
    const content = fs.existsSync(file) ? toLf(fs.readFileSync(file, 'utf8')) : null;
    if (content === null) {
      findings.push({ kind: 'conflict', file: rel, detail: _('check.missing') });
      continue;
    }
    for (const line of describeHiddenCharacters(rel, findHiddenCharacters(content))) {
      findings.push({ kind: 'hidden-characters', file: rel, detail: line });
    }
    if (regionHash(managedRegion(kind, content)) !== recorded && !settled.has(rel)) {
      findings.push({ kind: 'conflict', file: rel, detail: _('check.edited') });
    }
  }

  const source = config.source ?? null;
  if (config.uncommitted) findings.push({ kind: 'behind', file: null, detail: _('check.uncommitted') });

  const hasConflict = findings.some(finding => finding.kind === 'conflict');
  let latestCommit: string | null = null;
  if (plan && profileDir && !hasConflict) {
    for (const file of plan.files) {
      if (file.existing !== file.regenerated) findings.push({ kind: 'behind', file: file.rel, detail: _('check.profile-changed') });
    }
    const storeCommit = config.pin ? newerStoreCommit(profileDir, source?.commit ?? null) : null;
    if (storeCommit) {
      latestCommit = storeCommit;
      findings.push({ kind: 'behind', file: null, detail: _('check.profile-newer', { commit: storeCommit.slice(0, 7) }) });
    }
  } else if (profile && !inStore) {
    if (link?.broken) warnings.push(_('check.warn.link-broken', { profile, path: link.path }));
    if (!options.refresh) warnings.push(source?.git ? _('check.warn.refresh') : _('check.warn.no-profile', { profile }));
  }

  if (options.refresh && source?.git && source.branch) {
    latestCommit = (options.remoteHead ?? remoteHeadCommit)(source.git, source.branch);
    if (latestCommit && latestCommit !== source.commit) {
      findings.push({ kind: 'behind', file: null, detail: _('check.remote-newer', { commit: latestCommit.slice(0, 7) }) });
    }
  }

  return {
    project: targetDir,
    profile,
    pinned: config.pin === true,
    commit: source?.commit ?? null,
    latestCommit,
    findings,
    warnings,
    exitCode: worstExitCode(findings.map(finding => CODE[finding.kind]))
  };
}
