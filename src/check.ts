import fs from 'node:fs';
import path from 'node:path';
import { _ } from './i18n/index.ts';
import { assertProjectDirectory, planFor, PROJECT_CONFIG_FILE, readProjectConfig } from './profile/apply.ts';
import { managedRegion, regionHash } from './project/plan.ts';
import { EXIT, usageError, worstExitCode } from './shared/errors.ts';
import { git } from './shared/git.ts';
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

export function checkProject(targetDir: string, options: { refresh?: boolean } = {}): CheckReport {
  assertProjectDirectory(targetDir);
  const configPath = path.join(targetDir, PROJECT_CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    throw usageError('check.not-applied', _('error.check.not-applied', { project: targetDir }), _('hint.apply', { project: targetDir }));
  }
  const config = readProjectConfig(configPath);
  const findings: CheckFinding[] = [];
  const warnings: string[] = [];

  for (const [rel, recorded] of Object.entries(config.managedHashes ?? {})) {
    const file = path.join(targetDir, rel);
    const kind: ManagedKind = rel === 'AGENTS.md' ? 'agents' : 'pointer';
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (content === null) {
      findings.push({ kind: 'conflict', file: rel, detail: _('check.missing') });
      continue;
    }
    for (const line of describeHiddenCharacters(rel, findHiddenCharacters(content))) {
      findings.push({ kind: 'hidden-characters', file: rel, detail: line });
    }
    if (regionHash(managedRegion(kind, content)) !== recorded) {
      findings.push({ kind: 'conflict', file: rel, detail: _('check.edited') });
    }
  }

  const profile = config.profile ?? null;
  const source = config.source ?? null;
  if (config.uncommitted) findings.push({ kind: 'behind', file: null, detail: _('check.uncommitted') });

  const hasConflict = findings.some(finding => finding.kind === 'conflict');
  if (profile && fs.existsSync(path.join(profileHome(), profile)) && !hasConflict) {
    const { plan } = planFor(profile, targetDir, 'keep');
    for (const file of plan.files) {
      if (file.existing !== file.regenerated) findings.push({ kind: 'behind', file: file.rel, detail: _('check.profile-changed') });
    }
  } else if (profile && !options.refresh) {
    warnings.push(source?.git ? _('check.warn.refresh') : _('check.warn.no-profile', { profile }));
  }

  let latestCommit: string | null = null;
  if (options.refresh && source?.git && source.branch) {
    const line = git(['ls-remote', '--', source.git, `refs/heads/${source.branch}`]).stdout.trim();
    latestCommit = line.split(/\s+/)[0] || null;
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
