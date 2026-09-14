import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { extractAgentsManagedDocument, extractManagedDocument, mergeAgentsMd, mergeManagedDocument } from './analyzer.mjs';
import { AGENTIC_GITIGNORE, baseFilePath, parseBase, serializeBase } from './conflicts.mjs';
import { assertSafeTextTarget, writeTextAtomic } from './fs-utils.mjs';

/**
 * Plan what `profile apply`/`sync`/`resolve` would write to a project.
 * Managed areas edited since the last apply are reported as conflicts instead
 * of throwing, so callers can show them, stop, or resolve them.
 */

export const POINTER_TEMPLATES = [
  ['templates/CLAUDE.md', 'CLAUDE.md'],
  ['templates/antigravity-rules/agentic.md', '.agents/rules/agentic.md'],
  ['templates/cursor-rules/agentic.mdc', '.cursor/rules/agentic.mdc'],
  ['templates/copilot-instructions.md', '.github/copilot-instructions.md']
];

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function readIfExists(target) {
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
}

export function managedRegion(kind, content) {
  if (typeof content !== 'string') return null;
  return (kind === 'agents' ? extractAgentsManagedDocument(content) : extractManagedDocument(content)) || null;
}

export function regionHash(region) {
  return region ? sha256(region) : null;
}

/** Recorded hash for a file; earlier Windows runs keyed pointer paths with `\`. */
function recordedHashFor(projectConfig, relativePath) {
  const hashes = projectConfig.managedHashes || {};
  return hashes[relativePath] || hashes[relativePath.replaceAll('/', '\\')] || null;
}

/**
 * The managed area as Agentic last wrote it, when it can be known: a base file
 * matching the recorded hash, or a regenerated area that still hashes the same.
 */
function knownBase(targetDir, relativePath, recordedHash, nextRegion) {
  const stored = readIfExists(path.join(targetDir, baseFilePath(relativePath)));
  if (stored !== null && sha256(parseBase(stored)) === recordedHash) return parseBase(stored);
  if (nextRegion && sha256(nextRegion) === recordedHash) return nextRegion;
  return null;
}

/**
 * @param {object} input
 * @param {string} input.packageRoot
 * @param {string} input.targetDir
 * @param {string} input.projectName
 * @param {string} input.profileName
 * @param {string} input.renderedAgents - profile AGENTS.md rendered for this project
 * @param {object} input.projectConfig - parsed agentic.project.json
 * @param {Map<string, string|null>} [overrides] - resolved contents to plan from instead of the files on disk
 */
export function planProject({ packageRoot, targetDir, projectName, profileName, renderedAgents, projectConfig }, overrides = new Map()) {
  const files = [];
  const describe = (relativePath, kind, regenerate) => {
    const overridden = overrides.has(relativePath);
    const existing = overridden ? overrides.get(relativePath) : readIfExists(path.join(targetDir, relativePath));
    const regenerated = regenerate(existing);
    const currentRegion = managedRegion(kind, existing);
    const nextRegion = managedRegion(kind, regenerated);
    const recordedHash = overridden ? null : recordedHashFor(projectConfig, relativePath);
    const conflict = recordedHash && regionHash(currentRegion) !== recordedHash
      ? { kind: existing === null ? 'missing' : 'edited', base: knownBase(targetDir, relativePath, recordedHash, nextRegion) }
      : null;
    files.push({ rel: relativePath, kind, target: path.join(targetDir, relativePath), existing, regenerated, currentRegion, nextRegion, conflict });
  };

  describe('AGENTS.md', 'agents', existing => mergeAgentsMd(renderedAgents, existing));
  for (const [source, relativePath] of POINTER_TEMPLATES) {
    const template = fs.readFileSync(path.join(packageRoot, source), 'utf8').replaceAll('{{PROJECT_NAME}}', projectName);
    describe(relativePath, 'pointer', existing => mergeManagedDocument(template, existing));
  }

  const changes = [];
  const planFile = (relativePath, content) => {
    const target = path.join(targetDir, relativePath);
    const existing = readIfExists(target);
    changes.push({ target, relativePath, content, status: existing === null ? 'create' : existing === content ? 'unchanged' : 'update' });
  };
  const managedHashes = {};
  for (const file of files) {
    planFile(file.rel, file.regenerated);
    if (file.nextRegion) managedHashes[file.rel] = sha256(file.nextRegion);
  }
  for (const file of files) {
    if (file.nextRegion) planFile(baseFilePath(file.rel), serializeBase(file.nextRegion));
  }
  planFile(AGENTIC_GITIGNORE, 'backups/\n');
  const { core: _legacyCore, ...restConfig } = projectConfig;
  planFile('agentic.project.json', JSON.stringify({ ...restConfig, schemaVersion: 1, profile: profileName, managedHashes }, null, 2) + '\n');

  return { files, conflicts: files.filter(file => file.conflict), changes };
}

/** Write every changed file, refusing unsafe targets before anything is written. */
export function writePlan(changes, targetDir) {
  const changed = changes.filter(change => change.status !== 'unchanged');
  for (const change of changed) assertSafeTextTarget(change.target, targetDir);
  for (const change of changed) writeTextAtomic(change.target, change.content);
  return changed;
}
