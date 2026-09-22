import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { isSymbolicLink, writeTextAtomic } from '../shared/fs-utils.ts';
import { git } from '../shared/git.ts';
import { PROFILE_METADATA_FILE, profileHome } from '../shared/home.ts';
import { shellWord } from '../shared/shell.ts';
import type { ProfileMetadata, Scope } from '../shared/types.ts';
import { assertInstructionsPath, DEFAULT_INSTRUCTIONS, instructionsFile, isInstructionsPath, isProfileName, isScope, isValidProfileMetadata, LINK_FILE, profileLocation, regularFileInside, SCOPES, validateProfileName } from './store.ts';

/**
 * `profile link` makes a rules repository folder that already exists on this machine a profile. It writes
 * profile.json in that folder when there is none and keeps a pointer to the folder in the store, so the
 * folder is applied as it is. It never commits or pushes; sharing still goes through Git and `profile clone`.
 */

/** Folders that never hold the rules a profile applies: dependencies and build output. Hidden folders are skipped too. */
const SKIPPED = new Set(['node_modules', 'vendor', 'dist', 'build']);

/** How many folders deep the search for AGENTS.md goes. */
const MAX_DEPTH = 4;

/** How many folders the search for AGENTS.md reads before it stops, so a large folder is never read whole. */
export const MAX_FOLDERS = 1000;

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
  /** What happens to the pointer: a new link, a broken link pointed here, or a link that already points here. */
  link: 'create' | 'relink' | 'unchanged';
  /** The folder a broken link pointed at, when this plan points it here; null when its pointer could not be read. */
  relinkFrom: string | null;
  /** Whether running the plan changes anything. */
  changes: boolean;
}

/**
 * Every AGENTS.md inside `dir` up to MAX_DEPTH folders down, as `/`-separated paths, and whether the search read
 * every folder it meant to. It stops after MAX_FOLDERS folders. Hidden, dependency, build, and linked folders are
 * skipped. An AGENTS.md that is a symbolic link is listed, so it can be reported as one rather than as missing.
 */
export function instructionCandidates(dir: string): { files: string[]; complete: boolean } {
  const files: string[] = [];
  let read = 0;
  let complete = true;
  const walk = (rel: string, depth: number) => {
    if (read >= MAX_FOLDERS) {
      complete = false;
      return;
    }
    read++;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH && !entry.name.startsWith('.') && !SKIPPED.has(entry.name)) walk(child, depth + 1);
      } else if ((entry.isFile() || entry.isSymbolicLink()) && entry.name === DEFAULT_INSTRUCTIONS) files.push(child);
    }
  };
  walk('', 0);
  return { files, complete };
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
 * told, which is the root AGENTS.md, or else the only AGENTS.md. With several and none at the root it takes none,
 * and after a search that stopped early it takes only the root one, since there may be more.
 */
export function ruleFileChoices(dir: string): { detected: string | null; candidates: string[]; complete: boolean } {
  const { files: candidates, complete } = instructionCandidates(dir);
  const detected = regularFileInside(dir, DEFAULT_INSTRUCTIONS) ? DEFAULT_INSTRUCTIONS : complete && candidates.length === 1 ? candidates[0] : null;
  return { detected, candidates, complete };
}

function chooseInstructions(dir: string): string {
  // A root AGENTS.md decides without searching; a root AGENTS.md that is a symbolic link is reported by planLink.
  if (regularFileInside(dir, DEFAULT_INSTRUCTIONS) || isSymbolicLink(path.join(dir, DEFAULT_INSTRUCTIONS))) return DEFAULT_INSTRUCTIONS;
  const { detected, candidates, complete } = ruleFileChoices(dir);
  if (detected) return detected;
  const files = candidates.join('\n  ');
  if (!complete) {
    throw usageError('link.search-limit', candidates.length
      ? _('error.link.search-limit-found', { dir, count: MAX_FOLDERS, files })
      : _('error.link.search-limit', { dir, count: MAX_FOLDERS }), _('hint.link.instructions'));
  }
  if (!candidates.length) throw usageError('link.no-rules', _('error.link.no-rules', { dir }), _('hint.link.instructions'));
  throw usageError('link.many-rules', _('error.link.many-rules', { dir, files }), _('hint.link.instructions'));
}

function sameFolder(a: string, b: string): boolean {
  if (path.resolve(a) === path.resolve(b)) return true;
  try { return fs.realpathSync(a) === fs.realpathSync(b); } catch { return false; }
}

/**
 * The root of the Git repository whose commits hold `dir` below its root, or null when `dir` is a repository root,
 * is not in Git, or is a folder Git does not track, such as one under a home folder kept in a dotfiles repository.
 * Without git installed nothing counts as inside a repository, since a folder outside Git can be linked.
 */
function enclosingRepository(dir: string): string | null {
  try {
    const top = git(['rev-parse', '--show-cdup'], { cwd: dir, allowFailure: true });
    const up = top.stdout.trim();
    if (top.status !== 0 || !up) return null;
    return git(['rev-parse', '--verify', '--quiet', 'HEAD:./'], { cwd: dir, allowFailure: true }).status === 0 ? path.resolve(dir, up) : null;
  } catch {
    return null;
  }
}

/** The profile name `profile link` offers for a folder: the folder name, or the closest name that fits the rules. */
export function suggestedName(folder: string): string | null {
  if (isProfileName(folder)) return folder;
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
  return target && isInstructionsPath(target) && regularFileInside(dir, target) ? _('hint.link.rules-symlink-target', { file: shellWord(target) }) : _('hint.link.instructions');
}

/**
 * The folder `profile link` would link, after the checks that need no search of it: it is a folder, not the home
 * folder, and not a folder inside a Git repository. The TUI runs this before it lists the rules files in a folder.
 */
export function checkLinkFolder(dirInput: string, request: LinkRequest = {}): string {
  const dir = path.resolve(dirInput);
  let isDirectory = false;
  try { isDirectory = fs.statSync(dir).isDirectory(); } catch {}
  if (!isDirectory) throw usageError('link.not-directory', _('error.link.not-directory', { dir }), null);
  if (sameFolder(dir, os.homedir())) throw usageError('link.home-folder', _('error.link.home-folder', { dir }), _('hint.link.home-folder'));
  // Pinning, status, and clone work on a repository root, so a folder inside a repository is linked through its root.
  const repository = enclosingRepository(dir);
  if (repository) {
    let existing: ProfileMetadata | null = null;
    try { existing = readExistingMetadata(dir); } catch {}
    const prefix = path.relative(repository, dir).split(path.sep).join('/');
    const inner = request.instructions || (existing ? instructionsFile(existing) : ruleFileChoices(dir).detected);
    const name = request.name || existing?.name || suggestedName(path.basename(dir));
    const scope = request.scope || existing?.scope;
    const command = [
      'agctx profile link', shellWord(repository),
      '--instructions', inner ? shellWord(path.posix.join(prefix, inner)) : `${shellWord(prefix)}/<file>`,
      ...(name ? ['--name', shellWord(name)] : []),
      ...(scope ? ['--scope', shellWord(scope)] : [])
    ].join(' ');
    throw usageError('link.inside-repository', _('error.link.inside-repository', { dir, root: repository }), _('hint.link.inside-repository', { command }));
  }
  return dir;
}

/** What `profile link` would do for `dir`. Nothing is written. */
export function planLink(dirInput: string, request: LinkRequest = {}): LinkPlan {
  const dir = checkLinkFolder(dirInput, request);
  const existing = readExistingMetadata(dir);
  const metadataFile = path.join(dir, PROFILE_METADATA_FILE);
  let name: string;
  if (existing) {
    const given: [string, string | null | undefined, string][] = [
      ['name', request.name, existing.name],
      ['scope', request.scope, existing.scope],
      ['instructions', request.instructions, instructionsFile(existing)]
    ];
    for (const [field, value, recorded] of given) {
      if (value && value !== recorded) {
        throw usageError('link.mismatch', _('error.link.mismatch', { field, value, recorded, file: metadataFile }), _('hint.link.mismatch'));
      }
    }
    name = existing.name;
  } else {
    name = request.name || path.basename(dir);
    if (!request.name && !isProfileName(name)) {
      const suggestion = suggestedName(name);
      throw usageError('profile.invalid-name', _('error.profile.invalid-name', { name }), suggestion ? _('hint.link.name', { name: suggestion }) : _('hint.profile.name'));
    }
    validateProfileName(name);
  }

  // A name already in the store is linked here only when it is a link that no longer works. A working link keeps
  // its folder, since a folder of the same name elsewhere would otherwise take its place without a question.
  const location = profileLocation(name);
  let relinkFrom: string | null = null;
  let linked = false;
  let unreadable = false;
  if (location) {
    // The name comes from profile.json when the folder has one, so --name cannot get around the clash.
    if (!location.link) throw usageError('link.exists', _('error.link.exists', { name }), existing ? _('hint.link.exists-metadata', { name, file: metadataFile }) : _('hint.link.exists', { name }));
    if (location.problem === 'invalid-link') unreadable = true;
    else if (sameFolder(location.link, dir)) linked = true;
    else if (!location.problem) throw usageError('link.linked-elsewhere', _('error.link.linked-elsewhere', { name, from: location.link }), _('hint.link.linked-elsewhere', { name, path: dir }));
    else relinkFrom = location.link;
  }

  let scope: Scope;
  let instructions: string;
  if (existing) {
    scope = existing.scope;
    instructions = instructionsFile(existing);
  } else {
    // A link whose profile.json was lost gets back the scope and rules file it was linked with.
    const recorded = location?.pointer ?? null;
    const requestedScope = request.scope || recorded?.scope || 'personal';
    if (!isScope(requestedScope)) throw usageError('profile.invalid-scope', _('error.profile.invalid-scope', { scope: requestedScope, scopes: SCOPES.join(', ') }), null);
    scope = requestedScope;
    instructions = request.instructions || (recorded?.instructions && regularFileInside(dir, recorded.instructions) ? recorded.instructions : chooseInstructions(dir));
  }
  assertInstructionsPath(instructions, metadataFile);
  if (!regularFileInside(dir, instructions)) {
    const file = path.join(dir, ...instructions.split('/'));
    if (isSymbolicLink(file)) throw usageError('link.rules-symlink', _('error.link.rules-symlink', { file }), symbolicLinkHint(dir, file));
    // A rules file named in profile.json is fixed there; --instructions would only disagree with it.
    throw usageError('link.rules-missing', _('error.link.rules-missing', { dir, file: instructions }), existing ? _('hint.link.metadata-rules', { file: metadataFile }) : _('hint.link.instructions'));
  }

  const metadata: ProfileMetadata | null = existing ? null : instructions === DEFAULT_INSTRUCTIONS
    ? { schemaVersion: 1, name, scope, createdAt: new Date().toISOString() }
    : { schemaVersion: 2, name, scope, instructions, createdAt: new Date().toISOString() };
  const link = linked ? 'unchanged' : relinkFrom || unreadable ? 'relink' : 'create';
  return { dir, name, scope, instructions, metadata, link, relinkFrom, changes: Boolean(metadata) || !linked };
}

/** The confirmation question for a plan. Pointing a broken link here names the folder it pointed at, or says its pointer could not be read. */
export function linkQuestion(plan: LinkPlan): string {
  if (plan.relinkFrom) return _('confirm.relink', { name: plan.name, from: plan.relinkFrom, path: plan.dir });
  if (plan.link === 'relink') return _('confirm.relink-unreadable', { name: plan.name, path: plan.dir });
  return _('confirm.link', { name: plan.name, path: plan.dir });
}

/**
 * Write profile.json when the plan has one, then the pointer. The pointer also records the scope and rules file, so
 * linking again after profile.json is lost writes it back as it was. A broken operating system link made by hand
 * under the same name becomes a pointer.
 */
export function writeLink(plan: LinkPlan): void {
  if (plan.metadata) writeTextAtomic(path.join(plan.dir, PROFILE_METADATA_FILE), JSON.stringify(plan.metadata, null, 2) + '\n');
  const storeDir = path.join(profileHome(), plan.name);
  if (isSymbolicLink(storeDir)) fs.unlinkSync(storeDir);
  fs.mkdirSync(storeDir, { recursive: true });
  const record = { schemaVersion: 1, path: plan.dir, scope: plan.scope, instructions: plan.instructions };
  writeTextAtomic(path.join(storeDir, LINK_FILE), JSON.stringify(record, null, 2) + '\n');
}
