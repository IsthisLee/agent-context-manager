import fs from 'node:fs';
import path from 'node:path';
import { hasFlag, parseFlag } from '../commands/args.ts';
import { _ } from '../i18n/index.ts';
import { readProfile } from './store.ts';
import { cliName, PACKAGE_ROOT } from '../shared/runtime.ts';
import type { ConflictedFile, Profile, ProjectConfig, ProjectPlan } from '../shared/types.ts';
import { formatDiff } from '../project/conflicts.ts';
import { planProject, writePlan } from '../project/plan.ts';

export function renderProfileAgents(profile: Profile, projectName: string): string {
  const content = fs.readFileSync(profile.instructionsPath, 'utf8').trimEnd();
  return `${content}\n\n> Applied from Agentic Profile: ${profile.metadata.name}\n\n## Project context\n\n* **Project:** ${projectName}\n\n${_('scaffold.extHeading')}\n\n${_('scaffold.extBody')}\n`;
}

export function getProjectName(targetDir: string): string {
  const packagePath = path.join(targetDir, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (packageJson.name) return String(packageJson.name);
    } catch {}
  }
  return path.basename(targetDir);
}

export function assertProjectDirectory(targetDir: string): void {
  if (!fs.existsSync(targetDir)) throw new Error(`Directory not found: ${targetDir}`);
  try {
    if (!fs.statSync(targetDir).isDirectory()) throw new Error(`Project path is not a directory: ${targetDir}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Project path is not a directory:')) throw error;
    throw new Error(`Project path is not a directory: ${targetDir}`);
  }
}

export function readProjectConfig(configPath: string): ProjectConfig {
  if (!fs.existsSync(configPath)) return {};
  try {
    const config: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('not an object');
    return config as ProjectConfig;
  } catch {
    throw new Error(`Invalid project metadata: ${configPath}`);
  }
}

/** The profile a project is bound to, reading the current key and the pre-rename `core` key. */
export function boundProfile(projectConfig: ProjectConfig): string | null {
  return projectConfig.profile || projectConfig.core || null;
}

/** Positional arguments for `profile apply`: `<name> [<project>]`. */
export function applyArgs(values: readonly string[]): { name: string | null; targetPath: string } {
  const positional = values.filter(value => !value.startsWith('--'));
  return { name: positional[0] || null, targetPath: positional[1] || '.' };
}

export const CONFLICT_GUIDE = 'https://github.com/IsthisLee/agentic/blob/main/docs/usage-guide.md#관리-영역을-고쳐서-멈췄을-때';

/** Raised when managed areas were edited outside Agentic; carries the conflicting files. */
export class ConflictError extends Error {
  conflicts: ConflictedFile[];

  constructor(message: string, conflicts: ConflictedFile[]) {
    super(message);
    this.conflicts = conflicts;
  }
}

export function conflictError(conflicts: ConflictedFile[], targetDir: string): ConflictError {
  return new ConflictError([
    `Managed file changed outside Agentic: ${conflicts.map(file => file.rel).join(', ')}`,
    `  See the difference:  ${cliName()} profile sync --dry-run ${targetDir}`,
    `  Resolve it:          ${cliName()} profile resolve ${targetDir}`,
    `  Guide: ${CONFLICT_GUIDE}`
  ].join('\n'), conflicts);
}

export function planFor(name: string, targetDir: string, overrides?: Map<string, string | null>): ProjectPlan {
  const profile = readProfile(name);
  const projectConfig = readProjectConfig(path.join(targetDir, 'agentic.project.json'));
  const projectName = getProjectName(targetDir);
  return planProject({
    packageRoot: PACKAGE_ROOT,
    targetDir,
    projectName,
    profileName: name,
    renderedAgents: renderProfileAgents(profile, projectName),
    projectConfig
  }, overrides);
}

export function printPlan(plan: ProjectPlan, label: string): void {
  const conflicted = new Set(plan.conflicts.map(file => file.rel));
  const changed = plan.changes.filter(change => change.status !== 'unchanged' && !conflicted.has(change.relativePath));
  console.log(`${label}: ${changed.length} file(s) to change.`);
  for (const change of plan.changes) {
    const status = conflicted.has(change.relativePath) ? 'conflict' : change.status;
    console.log(`  ${status.padEnd(9)} ${change.relativePath}`);
  }
}

export function printConflicts(conflicts: readonly ConflictedFile[]): void {
  for (const file of conflicts) {
    console.log(`\nConflict: ${file.rel}`);
    if (file.conflict.kind === 'missing') {
      console.log(`${file.rel} is missing. \`profile resolve\` recreates it.`);
    } else if (file.conflict.base !== null) {
      console.log('Edits inside the managed area since the last apply:');
      console.log(formatDiff(`last-applied/${file.rel}`, `current/${file.rel}`, file.conflict.base, file.currentRegion ?? ''));
      if (file.nextRegion !== file.conflict.base) {
        console.log('Profile or template changes Agentic will write:');
        console.log(formatDiff(`last-applied/${file.rel}`, `next/${file.rel}`, file.conflict.base, file.nextRegion ?? ''));
      }
    } else {
      console.log('The last applied version is unknown. Current managed area compared with what Agentic will write:');
      console.log(formatDiff(`current/${file.rel}`, `next/${file.rel}`, file.currentRegion ?? '', file.nextRegion ?? ''));
    }
  }
}

export function applyProfile(values: readonly string[]): void {
  const { name, targetPath } = applyArgs(values);
  if (!name) throw new Error('profile apply requires <name> <project>.');
  const targetDir = path.resolve(process.cwd(), targetPath);
  assertProjectDirectory(targetDir);
  const plan = planFor(name, targetDir);
  const dryRun = hasFlag(values, 'dry-run');
  if (plan.conflicts.length && !dryRun) throw conflictError(plan.conflicts, targetDir);
  printPlan(plan, dryRun ? 'Dry-run' : 'Plan');
  if (dryRun) {
    printConflicts(plan.conflicts);
    console.log('Dry-run: no files were changed.');
    if (plan.conflicts.length) throw conflictError(plan.conflicts, targetDir);
    return;
  }
  writePlan(plan.changes, targetDir);
  console.log(`Applied profile ${name} to ${targetDir}`);
}

/**
 * Refresh the profile a project is already bound to. `sync` never switches the
 * bound profile: naming a profile (a second positional, or `--profile`/`--core`)
 * is rejected so bulk refreshes cannot silently rebind a project.
 */
export function syncProject(values: readonly string[]): void {
  if (parseFlag(values, 'profile') || parseFlag(values, 'core')) {
    throw new Error('profile sync does not switch profiles. To switch, use `agentic profile apply <name> <project>`.');
  }
  const positional = values.filter(value => !value.startsWith('--'));
  if (positional.length > 1) {
    throw new Error('profile sync takes only <project>. To switch profiles, use `agentic profile apply <name> <project>`.');
  }
  const targetPath = positional[0] || '.';
  const targetDir = path.resolve(process.cwd(), targetPath);
  assertProjectDirectory(targetDir);
  const selectionPath = path.join(targetDir, 'agentic.project.json');
  const selected = boundProfile(readProjectConfig(selectionPath));
  if (!selected) throw new Error('profile sync requires a project already applied with `agentic profile apply <name> <project>`.');
  applyProfile([selected, ...(hasFlag(values, 'dry-run') ? ['--dry-run'] : []), targetDir]);
}
