import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { extractAgentsManagedDocument, extractManagedDocument, mergeAgentsMd, mergeManagedDocument } from './analyzer.ts';
import { AGCTX_GITIGNORE, baseFilePath, parseBase, serializeBase } from './conflicts.ts';
import { assertSafeTextTarget, writeTextAtomic } from '../shared/fs-utils.ts';
import type { ConflictedFile, ManagedKind, PlannedChange, PlannedFile, ProjectConfig, ProjectPlan } from '../shared/types.ts';

/**
 * Plan what `profile apply`/`sync`/`resolve` would write to a project.
 * Managed areas edited since the last apply are reported as conflicts instead
 * of throwing, so callers can show them, stop, or resolve them.
 */

export const POINTER_TEMPLATES: ReadonlyArray<readonly [source: string, target: string]> = [
  ['templates/CLAUDE.md', 'CLAUDE.md'],
  ['templates/antigravity-rules/agctx.md', '.agents/rules/agctx.md']
];

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function readIfExists(target: string): string | null {
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
}

export function managedRegion(kind: ManagedKind, content: string | null | undefined): string | null {
  if (typeof content !== 'string') return null;
  return (kind === 'agents' ? extractAgentsManagedDocument(content) : extractManagedDocument(content)) || null;
}

export function regionHash(region: string | null): string | null {
  return region ? sha256(region) : null;
}

function recordedHashFor(projectConfig: ProjectConfig, relativePath: string): string | null {
  return projectConfig.managedHashes?.[relativePath] ?? null;
}

/**
 * The managed area as agctx last wrote it, when it can be known: a base file
 * matching the recorded hash, or a regenerated area that still hashes the same.
 */
function knownBase(targetDir: string, relativePath: string, recordedHash: string, nextRegion: string | null): string | null {
  const stored = readIfExists(path.join(targetDir, baseFilePath(relativePath)));
  if (stored !== null && sha256(parseBase(stored)) === recordedHash) return parseBase(stored);
  if (nextRegion && sha256(nextRegion) === recordedHash) return nextRegion;
  return null;
}

export interface PlanInput {
  packageRoot: string;
  targetDir: string;
  projectName: string;
  profileName: string;
  /** Profile AGENTS.md rendered for this project. */
  renderedAgents: string;
  /** Parsed agctx.project.json. */
  projectConfig: ProjectConfig;
}

/**
 * @param overrides - resolved contents to plan from instead of the files on disk
 */
export function planProject({ packageRoot, targetDir, projectName, profileName, renderedAgents, projectConfig }: PlanInput, overrides: Map<string, string | null> = new Map()): ProjectPlan {
  const files: PlannedFile[] = [];
  const describe = (relativePath: string, kind: ManagedKind, regenerate: (existing: string | null) => string) => {
    const overridden = overrides.has(relativePath);
    const existing = overridden ? overrides.get(relativePath) ?? null : readIfExists(path.join(targetDir, relativePath));
    const regenerated = regenerate(existing);
    const currentRegion = managedRegion(kind, existing);
    const nextRegion = managedRegion(kind, regenerated);
    const recordedHash = overridden ? null : recordedHashFor(projectConfig, relativePath);
    const conflict = recordedHash && regionHash(currentRegion) !== recordedHash
      ? { kind: existing === null ? 'missing' as const : 'edited' as const, base: knownBase(targetDir, relativePath, recordedHash, nextRegion) }
      : null;
    files.push({ rel: relativePath, kind, target: path.join(targetDir, relativePath), existing, regenerated, currentRegion, nextRegion, conflict });
  };

  describe('AGENTS.md', 'agents', existing => mergeAgentsMd(renderedAgents, existing));
  for (const [source, relativePath] of POINTER_TEMPLATES) {
    const template = fs.readFileSync(path.join(packageRoot, source), 'utf8').replaceAll('{{PROJECT_NAME}}', projectName);
    describe(relativePath, 'pointer', existing => mergeManagedDocument(template, existing));
  }

  const changes: PlannedChange[] = [];
  const planFile = (relativePath: string, content: string) => {
    const target = path.join(targetDir, relativePath);
    const existing = readIfExists(target);
    changes.push({ target, relativePath, content, status: existing === null ? 'create' : existing === content ? 'unchanged' : 'update' });
  };
  const managedHashes: Record<string, string> = {};
  for (const file of files) {
    planFile(file.rel, file.regenerated);
    if (file.nextRegion) managedHashes[file.rel] = sha256(file.nextRegion);
  }
  for (const file of files) {
    if (file.nextRegion) planFile(baseFilePath(file.rel), serializeBase(file.nextRegion));
  }
  planFile(AGCTX_GITIGNORE, 'backups/\n');
  planFile('agctx.project.json', JSON.stringify({ ...projectConfig, schemaVersion: 1, profile: profileName, managedHashes }, null, 2) + '\n');

  return { files, conflicts: files.filter((file): file is ConflictedFile => file.conflict !== null), changes };
}

/** Write every changed file, refusing unsafe targets before anything is written. */
export function writePlan(changes: readonly PlannedChange[], targetDir: string): PlannedChange[] {
  const changed = changes.filter(change => change.status !== 'unchanged');
  for (const change of changed) assertSafeTextTarget(change.target, targetDir);
  for (const change of changed) writeTextAtomic(change.target, change.content);
  return changed;
}
