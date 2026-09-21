import fs from 'node:fs';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { isSymbolicLink, writeTextAtomic } from '../shared/fs-utils.ts';
import { PROFILE_METADATA_FILE, profileHome } from '../shared/home.ts';
import type { ProfileMetadata, Scope } from '../shared/types.ts';
import { assertInstructionsPath, DEFAULT_INSTRUCTIONS, instructionsFile, isScope, isValidProfileMetadata, LINK_FILE, profileLink, regularFileInside, SCOPES, validateProfileName } from './store.ts';

/**
 * `profile link` makes a rules repository folder that already exists on this machine a profile. It writes
 * profile.json in that folder when there is none and keeps a pointer to the folder in the store, so the
 * folder is applied as it is. It never commits or pushes; sharing still goes through Git and `profile clone`.
 */

/** Folders that never hold the rules a profile applies. */
const SKIPPED = new Set(['.git', 'node_modules']);

export interface LinkRequest {
  name?: string | null;
  scope?: string | null;
  instructions?: string | null;
}

export interface LinkPlan {
  dir: string;
  name: string;
  scope: Scope;
  instructions: string;
  /** profile.json to write, or null when the folder already has one. */
  metadata: ProfileMetadata | null;
  /** What happens to the pointer: a new link, an existing link moved here, or a link that already points here. */
  link: 'create' | 'relink' | 'unchanged';
  /** The folder an existing link pointed at, when this plan moves the link. */
  relinkFrom: string | null;
  /** Whether running the plan changes anything. */
  changes: boolean;
}

/** Every AGENTS.md inside `dir`, as `/`-separated paths, skipping `.git`, `node_modules`, and linked folders. */
export function instructionCandidates(dir: string): string[] {
  const found: string[] = [];
  const walk = (rel: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory() && !SKIPPED.has(entry.name)) walk(child);
      else if (entry.isFile() && entry.name === DEFAULT_INSTRUCTIONS) found.push(child);
    }
  };
  walk('');
  return found;
}

function readExistingMetadata(dir: string): ProfileMetadata | null {
  const file = path.join(dir, PROFILE_METADATA_FILE);
  if (!fs.existsSync(file)) return null;
  let metadata: unknown = null;
  try { metadata = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  if (!isValidProfileMetadata(metadata)) {
    throw usageError('link.invalid-metadata', _('error.link.invalid-metadata', { file }), null);
  }
  return metadata;
}

/**
 * The rules files `profile link` can take from `dir`: every AGENTS.md in it, and the one it takes without being
 * told, which is the root AGENTS.md, or else the only AGENTS.md. With several and none at the root it takes none.
 */
export function ruleFileChoices(dir: string): { detected: string | null; candidates: string[] } {
  const candidates = instructionCandidates(dir);
  const detected = regularFileInside(dir, DEFAULT_INSTRUCTIONS) ? DEFAULT_INSTRUCTIONS : candidates.length === 1 ? candidates[0] : null;
  return { detected, candidates };
}

function chooseInstructions(dir: string, requested: string | null | undefined): string {
  if (requested) return requested;
  const { detected, candidates } = ruleFileChoices(dir);
  if (detected) return detected;
  if (!candidates.length) throw usageError('link.no-rules', _('error.link.no-rules', { dir }), _('hint.link.instructions'));
  throw usageError('link.many-rules', _('error.link.many-rules', { dir, files: candidates.join('\n  ') }), _('hint.link.instructions'));
}

/** What `profile link` would do for `dir`. Nothing is written. */
export function planLink(dirInput: string, request: LinkRequest = {}): LinkPlan {
  const dir = path.resolve(dirInput);
  let isDirectory = false;
  try { isDirectory = fs.statSync(dir).isDirectory(); } catch {}
  if (!isDirectory) throw usageError('link.not-directory', _('error.link.not-directory', { dir }), null);

  const existing = readExistingMetadata(dir);
  let name: string;
  let scope: Scope;
  let instructions: string;
  if (existing) {
    const given: [string, string | null | undefined, string][] = [
      ['name', request.name, existing.name],
      ['scope', request.scope, existing.scope],
      ['instructions', request.instructions, instructionsFile(existing)]
    ];
    for (const [field, value, recorded] of given) {
      if (value && value !== recorded) {
        throw usageError('link.mismatch', _('error.link.mismatch', { field, value, recorded, file: path.join(dir, PROFILE_METADATA_FILE) }), _('hint.link.mismatch'));
      }
    }
    ({ name, scope } = existing);
    instructions = instructionsFile(existing);
  } else {
    name = request.name || path.basename(dir);
    validateProfileName(name);
    const requestedScope = request.scope || 'personal';
    if (!isScope(requestedScope)) throw usageError('profile.invalid-scope', _('error.profile.invalid-scope', { scope: requestedScope, scopes: SCOPES.join(', ') }), null);
    scope = requestedScope;
    instructions = chooseInstructions(dir, request.instructions);
  }
  assertInstructionsPath(instructions, path.join(dir, PROFILE_METADATA_FILE));
  if (!regularFileInside(dir, instructions)) {
    throw usageError('profile.instructions-missing', _('error.profile.instructions-missing', { source: dir, file: instructions }), _('hint.link.instructions'));
  }

  const storeDir = path.join(profileHome(), name);
  let relinkFrom: string | null = null;
  let linked = false;
  if (fs.existsSync(storeDir) || isSymbolicLink(storeDir)) {
    const link = profileLink(name);
    // The name comes from profile.json when the folder has one, so --name cannot get around the clash.
    if (!link) throw usageError('link.exists', _('error.link.exists', { name }), existing ? _('hint.link.exists-metadata', { name, file: path.join(dir, PROFILE_METADATA_FILE) }) : _('hint.link.exists', { name }));
    if (link.path === dir) linked = true;
    else relinkFrom = link.path;
  }

  const metadata: ProfileMetadata | null = existing ? null : instructions === DEFAULT_INSTRUCTIONS
    ? { schemaVersion: 1, name, scope, createdAt: new Date().toISOString() }
    : { schemaVersion: 2, name, scope, instructions, createdAt: new Date().toISOString() };
  const link = linked ? 'unchanged' : relinkFrom ? 'relink' : 'create';
  return { dir, name, scope, instructions, metadata, link, relinkFrom, changes: Boolean(metadata) || !linked };
}

/** The confirmation question for a plan. Moving a link names the folder it stops pointing at. */
export function linkQuestion(plan: LinkPlan): string {
  return plan.relinkFrom
    ? _('confirm.relink', { name: plan.name, from: plan.relinkFrom, path: plan.dir })
    : _('confirm.link', { name: plan.name, path: plan.dir });
}

/** Write profile.json when the plan has one, then the pointer. */
export function writeLink(plan: LinkPlan): void {
  if (plan.metadata) writeTextAtomic(path.join(plan.dir, PROFILE_METADATA_FILE), JSON.stringify(plan.metadata, null, 2) + '\n');
  const storeDir = path.join(profileHome(), plan.name);
  fs.mkdirSync(storeDir, { recursive: true });
  writeTextAtomic(path.join(storeDir, LINK_FILE), JSON.stringify({ schemaVersion: 1, path: plan.dir }, null, 2) + '\n');
}

