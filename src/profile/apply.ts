import fs from 'node:fs';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { say } from '../commands/output.ts';
import { CliError, EXIT, usageError } from '../shared/errors.ts';
import { git, isGitRoot, sanitizeRemoteUrl } from '../shared/git.ts';
import { PROFILE_METADATA_FILE } from '../shared/home.ts';
import { PACKAGE_ROOT } from '../shared/runtime.ts';
import type { ConflictedFile, Profile, ProjectConfig, ProjectPlan, ProjectSource } from '../shared/types.ts';
import { formatDiff } from '../project/conflicts.ts';
import { planProject } from '../project/plan.ts';
import { assertNoHiddenCharacters } from './git-profile.ts';
import { readProfile } from './store.ts';

export const PROJECT_CONFIG_FILE = 'agctx.project.json';

export function renderProfileAgents(content: string, profileName: string, projectName: string): string {
  return `${content.trimEnd()}\n\n> Applied from agctx profile: ${profileName}\n\n## Project context\n\n* **Project:** ${projectName}\n\n${_('scaffold.extHeading')}\n\n${_('scaffold.extBody')}\n`;
}

/**
 * The project name shown in AGENTS.md: package.json's name, then the name recorded
 * at the last apply, then the folder name. Recording it keeps a clone in a folder
 * with another name (a teammate's copy, a temporary worktree) rendering the same files.
 */
export function getProjectName(targetDir: string, recorded: string | null = null): string {
  const packagePath = path.join(targetDir, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (packageJson.name) return String(packageJson.name);
    } catch {}
  }
  return recorded || path.basename(targetDir);
}

export function assertProjectDirectory(targetDir: string): void {
  let isDirectory = false;
  try { isDirectory = fs.statSync(targetDir).isDirectory(); } catch {}
  if (!isDirectory) {
    throw usageError('project.not-directory', _('error.project.not-directory', { project: targetDir }), _('hint.project.path'));
  }
}

export function readProjectConfig(configPath: string): ProjectConfig {
  if (!fs.existsSync(configPath)) return {};
  try {
    const config: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('not an object');
    return config as ProjectConfig;
  } catch {
    throw usageError('project.invalid-config', _('error.project.invalid-config', { file: configPath }), _('hint.project.invalid-config', { file: configPath }));
  }
}

export const CONFLICT_GUIDE = 'https://github.com/IsthisLee/agent-context-manager/blob/main/docs/usage-guide.md#관리-영역을-고쳐서-멈췄을-때';

export function conflictError(conflicts: readonly ConflictedFile[], targetDir: string): CliError {
  return new CliError('project.conflict', _('error.project.conflict', { files: conflicts.map(file => file.rel).join(', ') }), {
    exitCode: EXIT.conflict,
    hint: _('hint.project.conflict', { project: targetDir, guide: CONFLICT_GUIDE }),
    details: conflicts.map(file => ({ file: file.rel, kind: file.conflict.kind }))
  });
}

/** Which profile content a project gets, and the version record written with it. */
export interface ProfileVersion {
  content: string;
  source: ProjectSource | null;
  uncommitted: boolean;
  pin: boolean;
}

/**
 * - `pin: true` (apply --pin): the committed profile, pinned to HEAD. Uncommitted edits are refused.
 * - `pin: 'keep'` (sync): a pinned project renders the commit it recorded; others follow the store.
 * - `pin: false` (apply): the store as it is now, recording the commit and whether edits are uncommitted.
 */
export function profileVersion(profile: Profile, projectConfig: ProjectConfig, pin: boolean | 'keep'): ProfileVersion {
  const dir = profile.profileDir;
  const name = profile.metadata.name;
  const connected = isGitRoot(dir);
  const pinned = pin === true || (pin === 'keep' && projectConfig.pin === true);
  if (pinned && !connected) {
    throw usageError('pin.not-git', _('error.pin.not-git', { name }), _('hint.profile.connect', { name }));
  }
  if (!connected) return { content: fs.readFileSync(profile.instructionsPath, 'utf8'), source: null, uncommitted: false, pin: false };

  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: dir, allowFailure: true }).stdout.trim() || null;
  const remoteName = branch ? git(['config', `branch.${branch}.remote`], { cwd: dir, allowFailure: true }).stdout.trim() || 'origin' : 'origin';
  const remoteUrl = git(['remote', 'get-url', remoteName], { cwd: dir, allowFailure: true }).stdout.trim();
  const remote = remoteUrl ? sanitizeRemoteUrl(remoteUrl) : null;

  if (pin === 'keep' && projectConfig.pin === true) {
    const commit = projectConfig.source?.commit;
    const shown = commit && /^[0-9a-f]{7,64}$/i.test(commit) ? git(['show', `${commit}:AGENTS.md`], { cwd: dir, allowFailure: true }) : null;
    if (!commit || !shown || shown.status !== 0) {
      throw new CliError('pin.commit-missing', _('error.pin.commit-missing', { name, commit: (commit ?? '').slice(0, 7) }), { exitCode: EXIT.unavailable, hint: _('hint.profile.pull', { name }) });
    }
    return { content: shown.stdout, source: { ...projectConfig.source, git: remote ?? projectConfig.source?.git ?? null, branch: projectConfig.source?.branch ?? branch, commit }, uncommitted: false, pin: true };
  }

  const commit = git(['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: dir, allowFailure: true }).stdout.trim() || null;
  const edited = git(['status', '--porcelain', '--', 'AGENTS.md', PROFILE_METADATA_FILE], { cwd: dir }).stdout.trim() !== '';
  if (pin === true && (edited || !commit)) {
    throw usageError('pin.uncommitted', _('error.pin.uncommitted', { name }), _('hint.git.commit', { dir }));
  }
  return { content: fs.readFileSync(profile.instructionsPath, 'utf8'), source: { git: remote, branch, commit }, uncommitted: edited, pin: pin === true };
}

export interface ApplyPlan {
  name: string;
  targetDir: string;
  version: ProfileVersion;
  plan: ProjectPlan;
  /** Whether agctx.project.json already pinned the project before this run. */
  previousPin: boolean;
}

export function planFor(name: string, targetDir: string, pin: boolean | 'keep', overrides?: Map<string, string | null>): ApplyPlan {
  const profile = readProfile(name);
  assertProjectDirectory(targetDir);
  const projectConfig = readProjectConfig(path.join(targetDir, PROJECT_CONFIG_FILE));
  const version = profileVersion(profile, projectConfig, pin);
  assertNoHiddenCharacters([{ file: `${name}/AGENTS.md`, content: version.content }]);
  const projectName = getProjectName(targetDir, typeof projectConfig.projectName === 'string' ? projectConfig.projectName : null);
  const plan = planProject({
    packageRoot: PACKAGE_ROOT,
    targetDir,
    projectName,
    profileName: name,
    renderedAgents: renderProfileAgents(version.content, name, projectName),
    projectConfig,
    record: { source: version.source, pin: version.pin, uncommitted: version.uncommitted }
  }, overrides);
  return { name, targetDir, version, plan, previousPin: projectConfig.pin === true };
}

export function printPlan(plan: ProjectPlan, label: string): void {
  const conflicted = new Set(plan.conflicts.map(file => file.rel));
  const changed = plan.changes.filter(change => change.status !== 'unchanged' && !conflicted.has(change.relativePath));
  say(_('plan.summary', { label, count: changed.length }));
  for (const change of plan.changes) {
    const status = conflicted.has(change.relativePath) ? 'conflict' : change.status;
    say(`  ${status.padEnd(9)} ${change.relativePath}`);
  }
}

export function printConflicts(conflicts: readonly ConflictedFile[]): void {
  for (const file of conflicts) {
    say(`\n${_('conflict.title', { file: file.rel })}`);
    if (file.conflict.kind === 'missing') {
      say(_('conflict.missing', { file: file.rel }));
    } else if (file.conflict.base !== null) {
      say(_('conflict.edits'));
      say(formatDiff(`last-applied/${file.rel}`, `current/${file.rel}`, file.conflict.base, file.currentRegion ?? ''));
      if (file.nextRegion !== file.conflict.base) {
        say(_('conflict.profile-changes'));
        say(formatDiff(`last-applied/${file.rel}`, `next/${file.rel}`, file.conflict.base, file.nextRegion ?? ''));
      }
    } else {
      say(_('conflict.unknown-base'));
      say(formatDiff(`current/${file.rel}`, `next/${file.rel}`, file.currentRegion ?? '', file.nextRegion ?? ''));
    }
  }
}

/** The profile a project is bound to, or a usage error pointing at `profile apply`. */
export function boundProfile(targetDir: string, command: string): string {
  const name = readProjectConfig(path.join(targetDir, PROJECT_CONFIG_FILE)).profile;
  if (!name) throw usageError('project.not-applied', _('error.project.not-applied', { command, project: targetDir }), _('hint.apply', { project: targetDir }));
  return name;
}
