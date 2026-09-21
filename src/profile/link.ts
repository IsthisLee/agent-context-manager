import fs from 'node:fs';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { isSymbolicLink, writeTextAtomic } from '../shared/fs-utils.ts';
import { PROFILE_METADATA_FILE, profileHome } from '../shared/home.ts';
import type { ProfileMetadata, Scope } from '../shared/types.ts';
import { git } from '../shared/git.ts';
import { assertInstructionsPath, DEFAULT_INSTRUCTIONS, instructionsFile, isInstructionsPath, isProfileName, isScope, isValidProfileMetadata, LINK_FILE, profileLocation, regularFileInside, SCOPES, validateProfileName } from './store.ts';

/**
 * `profile link` makes a rules repository folder that already exists on this machine a profile. It writes
 * profile.json in that folder when there is none and keeps a pointer to the folder in the store, so the
 * folder is applied as it is. It never commits or pushes; sharing still goes through Git and `profile clone`.
 */

/** Folders that never hold the rules a profile applies: dependencies and build output. Hidden folders are skipped too. */
const SKIPPED = new Set(['node_modules', 'vendor', 'dist', 'build']);

/** How many folders deep the search for AGENTS.md goes, so a large repository or a home folder is not walked whole. */
const MAX_DEPTH = 4;

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
  /** The folder an existing link pointed at, when this plan moves the link; null when that pointer could not be read. */
  relinkFrom: string | null;
  /** Whether running the plan changes anything. */
  changes: boolean;
}

/**
 * Every AGENTS.md inside `dir` up to MAX_DEPTH folders down, as `/`-separated paths. Hidden, dependency, build,
 * and linked folders are skipped.
 */
export function instructionCandidates(dir: string): string[] {
  const found: string[] = [];
  const walk = (rel: string, depth: number) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH && !entry.name.startsWith('.') && !SKIPPED.has(entry.name)) walk(child, depth + 1);
      } else if (entry.isFile() && entry.name === DEFAULT_INSTRUCTIONS) found.push(child);
    }
  };
  walk('', 0);
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
  // A root AGENTS.md decides without searching; a root AGENTS.md that is a symbolic link is reported by planLink.
  if (regularFileInside(dir, DEFAULT_INSTRUCTIONS) || isSymbolicLink(path.join(dir, DEFAULT_INSTRUCTIONS))) return DEFAULT_INSTRUCTIONS;
  const { detected, candidates } = ruleFileChoices(dir);
  if (detected) return detected;
  if (!candidates.length) throw usageError('link.no-rules', _('error.link.no-rules', { dir }), _('hint.link.instructions'));
  throw usageError('link.many-rules', _('error.link.many-rules', { dir, files: candidates.join('\n  ') }), _('hint.link.instructions'));
}

/**
 * The root of the Git repository `dir` sits in below its root, or null when `dir` is a repository root or not in
 * Git. Without git installed nothing counts as inside a repository, since a folder outside Git can be linked.
 */
function enclosingRepository(dir: string): string | null {
  try {
    const result = git(['rev-parse', '--show-cdup'], { cwd: dir, allowFailure: true });
    const up = result.stdout.trim();
    return result.status === 0 && up ? path.resolve(dir, up) : null;
  } catch {
    return null;
  }
}

/** A profile name made from a folder name that is not one, or null when none can be made. */
function nameFromFolder(folder: string): string | null {
  const name = folder.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, 64).replace(/-+$/, '');
  return isProfileName(name) ? name : null;
}

/**
 * The hint for a rules file that is a symbolic link. Pinning and `profile clone` read the rules file from Git,
 * where a link is not the file it points at, so the hint names that file when it is a regular file in the folder.
 */
function symbolicLinkHint(dir: string, file: string): string {
  let target: string | null = null;
  try { target = path.relative(dir, path.resolve(path.dirname(file), fs.readlinkSync(file))).split(path.sep).join('/'); } catch {}
  return target && isInstructionsPath(target) && regularFileInside(dir, target) ? _('hint.link.rules-symlink-target', { file: target }) : _('hint.link.instructions');
}

/** What `profile link` would do for `dir`. Nothing is written. */
export function planLink(dirInput: string, request: LinkRequest = {}): LinkPlan {
  const dir = path.resolve(dirInput);
  let isDirectory = false;
  try { isDirectory = fs.statSync(dir).isDirectory(); } catch {}
  if (!isDirectory) throw usageError('link.not-directory', _('error.link.not-directory', { dir }), null);
  // Pinning, status, and clone work on a repository root, so a folder inside a repository is linked through its root.
  const repository = enclosingRepository(dir);
  if (repository) {
    const inner = request.instructions || ruleFileChoices(dir).detected;
    const instructions = inner ? path.posix.join(path.relative(repository, dir).split(path.sep).join('/'), inner) : '<file>';
    throw usageError('link.inside-repository', _('error.link.inside-repository', { dir, root: repository }), _('hint.link.inside-repository', { root: repository, instructions }));
  }

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
    if (!request.name && !isProfileName(name)) {
      const suggestion = nameFromFolder(name);
      throw usageError('profile.invalid-name', _('error.profile.invalid-name', { name }), suggestion ? _('hint.link.name', { name: suggestion }) : _('hint.profile.name'));
    }
    validateProfileName(name);
    const requestedScope = request.scope || 'personal';
    if (!isScope(requestedScope)) throw usageError('profile.invalid-scope', _('error.profile.invalid-scope', { scope: requestedScope, scopes: SCOPES.join(', ') }), null);
    scope = requestedScope;
    instructions = chooseInstructions(dir, request.instructions);
  }
  const metadataFile = path.join(dir, PROFILE_METADATA_FILE);
  assertInstructionsPath(instructions, metadataFile);
  if (!regularFileInside(dir, instructions)) {
    const file = path.join(dir, ...instructions.split('/'));
    if (isSymbolicLink(file)) throw usageError('link.rules-symlink', _('error.link.rules-symlink', { file }), symbolicLinkHint(dir, file));
    // A rules file named in profile.json is fixed there; --instructions would only disagree with it.
    throw usageError('link.rules-missing', _('error.link.rules-missing', { dir, file: instructions }), existing ? _('hint.link.metadata-rules', { file: metadataFile }) : _('hint.link.instructions'));
  }

  const location = profileLocation(name);
  let relinkFrom: string | null = null;
  let linked = false;
  let unreadable = false;
  if (location) {
    // The name comes from profile.json when the folder has one, so --name cannot get around the clash.
    if (!location.link) throw usageError('link.exists', _('error.link.exists', { name }), existing ? _('hint.link.exists-metadata', { name, file: metadataFile }) : _('hint.link.exists', { name }));
    if (location.problem === 'invalid-link') unreadable = true;
    else if (location.link === dir) linked = true;
    else relinkFrom = location.link;
  }

  const metadata: ProfileMetadata | null = existing ? null : instructions === DEFAULT_INSTRUCTIONS
    ? { schemaVersion: 1, name, scope, createdAt: new Date().toISOString() }
    : { schemaVersion: 2, name, scope, instructions, createdAt: new Date().toISOString() };
  const link = linked ? 'unchanged' : relinkFrom || unreadable ? 'relink' : 'create';
  return { dir, name, scope, instructions, metadata, link, relinkFrom, changes: Boolean(metadata) || !linked };
}

/** The confirmation question for a plan. Moving a link names the folder it stops pointing at, or says its pointer could not be read. */
export function linkQuestion(plan: LinkPlan): string {
  if (plan.relinkFrom) return _('confirm.relink', { name: plan.name, from: plan.relinkFrom, path: plan.dir });
  if (plan.link === 'relink') return _('confirm.relink-unreadable', { name: plan.name, path: plan.dir });
  return _('confirm.link', { name: plan.name, path: plan.dir });
}

/** Write profile.json when the plan has one, then the pointer. */
export function writeLink(plan: LinkPlan): void {
  if (plan.metadata) writeTextAtomic(path.join(plan.dir, PROFILE_METADATA_FILE), JSON.stringify(plan.metadata, null, 2) + '\n');
  const storeDir = path.join(profileHome(), plan.name);
  fs.mkdirSync(storeDir, { recursive: true });
  writeTextAtomic(path.join(storeDir, LINK_FILE), JSON.stringify({ schemaVersion: 1, path: plan.dir }, null, 2) + '\n');
}

