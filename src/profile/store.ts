import fs from 'node:fs';
import path from 'node:path';
import { say } from '../commands/output.ts';
import { _, getLocale } from '../i18n/index.ts';
import { toCliError, usageError } from '../shared/errors.ts';
import { isSymbolicLink, writeTextAtomic } from '../shared/fs-utils.ts';
import { PROFILE_METADATA_FILE, profileHome } from '../shared/home.ts';
import { PACKAGE_ROOT } from '../shared/runtime.ts';
import { shellWord } from '../shared/shell.ts';
import type { ListedProfile, Profile, ProfileMetadata, Scope } from '../shared/types.ts';

export const SCOPES: readonly Scope[] = ['personal', 'company', 'team', 'workspace'];

const PROFILE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** The rules file of a profile whose profile.json names none. */
export const DEFAULT_INSTRUCTIONS = 'AGENTS.md';

/** The pointer a linked profile keeps in the store instead of its files. */
export const LINK_FILE = 'link.json';

export interface ProfileLink {
  /** The folder the profile points at, as an absolute path. */
  path: string;
  /** Whether that folder is gone, for example because it was moved or deleted. */
  broken: boolean;
  /** The scope and rules file the folder had when it was last linked, so a lost profile.json can be written back as it was. */
  scope: Scope | null;
  instructions: string | null;
}

/**
 * Why a linked profile cannot be used: the folder is gone, lost its profile.json, holds another profile's, or lost
 * the rules file its profile.json names; or the pointer itself cannot be read.
 */
export type BrokenLinkReason = 'missing-folder' | 'missing-metadata' | 'invalid-metadata' | 'missing-rules' | 'invalid-link';

export interface BrokenLink {
  name: string;
  /** The folder the link points at, or the pointer file itself when it cannot be read. */
  path: string;
  reason: BrokenLinkReason;
}

/**
 * Whether the store folder `dir` is a pointer rather than a profile: it has link.json and no profile.json.
 * A cloned repository may carry a link.json of its own next to its profile.json, and it stays a profile.
 */
export function isPointerFolder(dir: string): boolean {
  try {
    return fs.lstatSync(path.join(dir, LINK_FILE)).isFile() && !fs.existsSync(path.join(dir, PROFILE_METADATA_FILE));
  } catch {
    return false;
  }
}

export function isDirectory(target: string): boolean {
  try { return fs.statSync(target).isDirectory(); } catch { return false; }
}

/** Whether `a` and `b` name the same folder, as the file system sees it, letter case included. */
export function sameFolder(a: string, b: string): boolean {
  if (path.resolve(a) === path.resolve(b)) return true;
  try { return fs.realpathSync.native(a) === fs.realpathSync.native(b); } catch { return false; }
}

/** The parsed content of a profile.json, or null when it cannot be read as JSON. */
export function readMetadataFile(file: string): unknown {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** Whether `target` is a file, following links: the rules file in a person's own folder may be one. */
function isFile(target: string): boolean {
  try { return fs.statSync(target).isFile(); } catch { return false; }
}

/**
 * The folder a linked profile points at, or null when `name` keeps its files in the store. The store holds a
 * folder with only `link.json`, never an operating system link, so removing the profile cannot reach the folder
 * it points at, and a missing folder can be reported by the path it used to have.
 */
export function profileLink(name: string): ProfileLink | null {
  const dir = path.join(profileHome(), name);
  if (!isPointerFolder(dir)) return null;
  const file = path.join(dir, LINK_FILE);
  let record: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object') record = parsed as Record<string, unknown>;
  } catch {}
  const target = record?.path;
  if (record?.schemaVersion !== 1 || typeof target !== 'string' || !path.isAbsolute(target)) {
    throw usageError('profile.link-invalid', _('error.profile.link-invalid', { name, file }), _('hint.profile.link-remove', { name }));
  }
  const instructions = typeof record.instructions === 'string' && isInstructionsPath(record.instructions) ? record.instructions : null;
  return { path: target, broken: !isDirectory(target), scope: isScope(record.scope) ? record.scope : null, instructions };
}

export interface ProfileLocation {
  /** How the store holds the profile: its own files, a link.json pointer, or an operating system link to a folder. */
  kind: 'folder' | 'pointer' | 'symlink';
  /** The folder that holds profile.json and the rules file. */
  dir: string;
  /**
   * For a pointer, the folder it points at, or the pointer file when that cannot be read; for an operating system
   * link whose folder is gone, the folder it pointed at. Null for a profile read from the store.
   */
  link: string | null;
  /** The pointer's record when it can be read, including the scope and rules file it was linked with. */
  pointer: ProfileLink | null;
  /** Why the profile cannot be used, or null. */
  problem: BrokenLinkReason | null;
  /** profile.json in `dir`, when it is valid for this name. */
  metadata: ProfileMetadata | null;
}

/** Whether `dir` has a profile.json valid for `name` and the rules file that profile.json names. */
function inspectProfileFolder(dir: string, name: string): Pick<ProfileLocation, 'dir' | 'problem' | 'metadata'> {
  const metadataPath = path.join(dir, PROFILE_METADATA_FILE);
  if (!fs.existsSync(metadataPath)) return { dir, problem: 'missing-metadata', metadata: null };
  const metadata = readMetadataFile(metadataPath);
  if (!isValidProfileMetadata(metadata, name)) return { dir, problem: 'invalid-metadata', metadata: null };
  const rules = instructionsFile(metadata);
  if (!isInstructionsPath(rules) || !isFile(path.join(dir, ...rules.split('/')))) return { dir, problem: 'missing-rules', metadata };
  return { dir, problem: null, metadata };
}

/**
 * Where the profile `name` keeps its files and whether it can be used. Every caller that needs a profile's folder
 * or asks whether a link is broken goes through here, so the answer is the same everywhere. Null when the store has
 * no entry by that name.
 */
export function profileLocation(name: string): ProfileLocation | null {
  const storeDir = path.join(profileHome(), name);
  const osLink = isSymbolicLink(storeDir);
  if (!osLink && !fs.existsSync(storeDir)) return null;
  if (osLink && !isDirectory(storeDir)) {
    // An operating system link made by hand before profile link existed, whose folder has since moved.
    let target = storeDir;
    try { target = path.resolve(path.dirname(storeDir), fs.readlinkSync(storeDir)); } catch {}
    return { kind: 'symlink', dir: storeDir, link: target, pointer: null, problem: 'missing-folder', metadata: null };
  }
  if (!isPointerFolder(storeDir)) return { kind: osLink ? 'symlink' : 'folder', link: null, pointer: null, ...inspectProfileFolder(storeDir, name) };
  let pointer: ProfileLink;
  try {
    pointer = profileLink(name) as ProfileLink;
  } catch {
    return { kind: 'pointer', dir: storeDir, link: path.join(storeDir, LINK_FILE), pointer: null, problem: 'invalid-link', metadata: null };
  }
  if (pointer.broken) return { kind: 'pointer', dir: pointer.path, link: pointer.path, pointer, problem: 'missing-folder', metadata: null };
  return { kind: 'pointer', link: pointer.path, pointer, ...inspectProfileFolder(pointer.path, name) };
}

export interface StoreContents {
  profiles: ListedProfile[];
  /** Links that cannot be used, with the reason. They stay listed so they can be found, linked again, or removed. */
  brokenLinks: BrokenLink[];
  /** Store folders that are neither a profile nor a link, such as one left without a valid profile.json. */
  unreadable: string[];
}

/** Every entry in the store, read once and sorted into profiles, broken links, and folders that are neither. */
export function readStore(): StoreContents {
  const home = profileHome();
  const contents: StoreContents = { profiles: [], brokenLinks: [], unreadable: [] };
  if (!fs.existsSync(home)) return contents;
  for (const name of fs.readdirSync(home).sort()) {
    if (!isProfileName(name)) continue;
    let location: ProfileLocation | null = null;
    try { location = profileLocation(name); } catch {}
    if (!location) continue;
    if (location.link) {
      if (location.problem) contents.brokenLinks.push({ name, path: location.link, reason: location.problem });
      else if (location.metadata) contents.profiles.push({ ...location.metadata, link: location.link });
    } else if (location.metadata) {
      // A copy whose rules file is missing stays listed, as before links existed; using it says what is missing.
      contents.profiles.push(location.metadata);
    } else if (isDirectory(location.dir)) {
      contents.unreadable.push(name);
    }
  }
  contents.profiles.sort((a, b) => `${a.scope}:${a.name}`.localeCompare(`${b.scope}:${b.name}`));
  return contents;
}

/**
 * The command that links a folder as the profile `name` again, with the scope and rules file its pointer recorded,
 * so a link removed to be brought back returns as it was.
 */
export function relinkCommand(name: string, pointer: ProfileLink | null, folder: string): string {
  return [
    'agctx profile link', folder, '--name', name,
    ...(pointer?.scope ? ['--scope', pointer.scope] : []),
    ...(pointer?.instructions ? ['--instructions', shellWord(pointer.instructions)] : [])
  ].join(' ');
}

/**
 * Keep the pointer's record of scope and rules file in step with the folder's profile.json whenever the profile is
 * read, so the hint that brings back a lost profile.json names what the folder last had. A record that cannot be
 * written is left as it is; it only feeds that hint.
 */
export function refreshPointerRecord(name: string, pointer: ProfileLink, metadata: ProfileMetadata): void {
  const instructions = instructionsFile(metadata);
  if (pointer.scope === metadata.scope && pointer.instructions === instructions) return;
  const record = { schemaVersion: 1, path: pointer.path, scope: metadata.scope, instructions };
  try { writeTextAtomic(path.join(profileHome(), name, LINK_FILE), JSON.stringify(record, null, 2) + '\n'); } catch {}
}

/** What to run to bring back the broken link `name`, or null when it can be used. */
export function brokenLinkHint(name: string): string | null {
  try {
    readProfile(name);
    return null;
  } catch (error) {
    return toCliError(error).hint;
  }
}

/** Refuse a command that would move Git history or settings in the folder a linked profile points at. */
export function assertNotLinked(name: string): void {
  const link = profileLink(name);
  if (link) throw usageError('profile.linked-git', _('error.profile.linked-git', { name, path: link.path }), _('hint.profile.linked-git', { path: shellWord(link.path) }));
}

export function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && (SCOPES as readonly string[]).includes(value);
}

/** Whether `name` can name a profile: lowercase letters, digits, and hyphens, 1 to 64, starting with a letter or digit. */
export function isProfileName(name: string): boolean {
  return PROFILE_NAME.test(name);
}

export function validateProfileName(name: string | null | undefined): asserts name is string {
  if (!name || !isProfileName(name)) {
    throw usageError('profile.invalid-name', _('error.profile.invalid-name', { name: name ?? '' }), _('hint.profile.name'));
  }
}

export function isValidProfileMetadata(metadata: unknown, expectedName: string | null = null): metadata is ProfileMetadata {
  if (!metadata || typeof metadata !== 'object') return false;
  const record = metadata as Record<string, unknown>;
  // Version 2 is what an agctx that knows `instructions` requires of a profile.json naming one, so an
  // older agctx refuses it instead of silently applying the root AGENTS.md.
  const version = record.schemaVersion === 1
    ? record.instructions === undefined
    : record.schemaVersion === 2 && (record.instructions === undefined || typeof record.instructions === 'string');
  return version
    && typeof record.name === 'string'
    && (!expectedName || record.name === expectedName)
    && PROFILE_NAME.test(record.name)
    && isScope(record.scope);
}

/** The rules file profile.json names, relative to the profile folder. */
export function instructionsFile(metadata: ProfileMetadata): string {
  return metadata.instructions ?? DEFAULT_INSTRUCTIONS;
}

/**
 * Whether an `instructions` value names a Markdown file inside the repository: it must be relative,
 * separate folders with `/`, have no empty, `.` or `..` part, and stay out of `.git`.
 */
export function isInstructionsPath(file: string): boolean {
  const parts = file.split('/');
  return !file.includes('\\') && !path.isAbsolute(file) && !/^[a-z]:/i.test(file)
    && parts.every(part => part !== '' && part !== '.' && part !== '..' && part.toLowerCase() !== '.git')
    && /\.md$/i.test(file);
}

export function assertInstructionsPath(file: string, source: string): void {
  if (!isInstructionsPath(file)) {
    throw usageError('profile.instructions-path', _('error.profile.instructions-path', { source, file }), _('hint.profile.instructions'));
  }
}

/**
 * The file `file` names inside `dir`, or null when it is missing, is not a regular file, or is reached
 * through a symbolic link. Used on content that came from a remote, before it is registered.
 */
export function regularFileInside(dir: string, file: string): string | null {
  const parts = file.split('/');
  let current = dir;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    let stat: fs.Stats;
    try { stat = fs.lstatSync(current); } catch { return null; }
    if (stat.isSymbolicLink() || (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) return null;
  }
  return current;
}

export function readProfile(name: string): Profile {
  validateProfileName(name);
  const location = profileLocation(name);
  if (!location) throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
  const { dir: profileDir, link, problem, metadata } = location;
  const metadataPath = path.join(profileDir, PROFILE_METADATA_FILE);
  // A pointer that cannot be read says so itself, with how to link it again or remove it.
  if (problem === 'invalid-link') profileLink(name);
  if (problem === 'missing-folder') {
    throw usageError('profile.link-broken', _('error.profile.link-broken', { name, path: link ?? profileDir }), _('hint.profile.link-broken', { name, command: relinkCommand(name, location.pointer, '<new path>') }));
  }
  if (problem === 'missing-metadata') {
    if (!link) throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
    throw usageError('profile.link-metadata-missing', _('error.profile.link-metadata-missing', { name, path: profileDir }), _('hint.profile.link-metadata-missing', { name, path: shellWord(profileDir), command: relinkCommand(name, location.pointer, shellWord(profileDir)) }));
  }
  if (!metadata) {
    if (!link) throw usageError('profile.invalid-metadata', _('error.profile.invalid-metadata', { name, file: metadataPath }), null);
    throw usageError('profile.link-metadata-other', _('error.profile.link-metadata-other', { name, path: profileDir, file: metadataPath }), _('hint.profile.link-metadata-other', { name, file: metadataPath }));
  }
  const instructions = instructionsFile(metadata);
  assertInstructionsPath(instructions, metadataPath);
  // The store is the user's own folder, so a rules file linked in from elsewhere stays usable here;
  // remote content is checked for links by clone and pull before it gets here.
  const instructionsPath = path.join(profileDir, ...instructions.split('/'));
  if (problem === 'missing-rules') {
    if (link) throw usageError('profile.link-rules-missing', _('error.profile.link-rules-missing', { name, path: profileDir, file: instructions }), _('hint.profile.link-rules-missing', { file: metadataPath }));
    if (metadata.instructions === undefined) throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
    throw usageError('profile.instructions-missing', _('error.profile.instructions-missing', { source: metadataPath, file: instructions }), _('hint.profile.instructions'));
  }
  if (location.pointer) refreshPointerRecord(name, location.pointer, metadata);
  return { profileDir, metadataPath, instructions, instructionsPath, metadata, link };
}

export function createProfile(name: string, scope: string = 'personal'): ProfileMetadata {
  validateProfileName(name);
  if (!isScope(scope)) throw usageError('profile.invalid-scope', _('error.profile.invalid-scope', { scope, scopes: SCOPES.join(', ') }), null);
  const profileDir = path.join(profileHome(), name);
  if (fs.existsSync(profileDir)) throw usageError('profile.exists', _('error.profile.exists', { name }), _('hint.profile.view', { name }));
  fs.mkdirSync(profileDir, { recursive: true });
  const metadata: ProfileMetadata = { schemaVersion: 1, name, scope, createdAt: new Date().toISOString() };
  writeTextAtomic(path.join(profileDir, PROFILE_METADATA_FILE), JSON.stringify(metadata, null, 2) + '\n');
  const profileTemplate = fs.readFileSync(path.join(PACKAGE_ROOT, getLocale() === 'ko' ? 'templates/profile/AGENTS.ko.md' : 'templates/profile/AGENTS.md'), 'utf8');
  writeTextAtomic(path.join(profileDir, DEFAULT_INSTRUCTIONS), profileTemplate.replaceAll('{{PROFILE_NAME}}', name));
  say(_('create.done', { name, scope }));
  return metadata;
}

export function getProfiles(): ListedProfile[] {
  return readStore().profiles;
}

export function removeProfile(name: string): void {
  validateProfileName(name);
  // Only the store folder goes: for a link that is the pointer, never the folder it points at. A store folder
  // that is not a valid profile is removable too, since link and clone tell people to clear the name this way.
  const storeDir = path.join(profileHome(), name);
  if (!fs.existsSync(storeDir) && !isSymbolicLink(storeDir)) throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
  fs.rmSync(storeDir, { recursive: true, force: true });
  say(_('remove.done', { name }));
}

export function viewProfile(name: string): { name: string; scope: Scope; instructions: string } {
  const profile = readProfile(name);
  const instructions = fs.readFileSync(profile.instructionsPath, 'utf8').trim();
  say(`${profile.metadata.name}\t${profile.metadata.scope}`);
  say(instructions);
  return { name: profile.metadata.name, scope: profile.metadata.scope, instructions };
}

export function selectProfile(selection: string | undefined, profiles: ListedProfile[] = getProfiles()): string {
  if (!profiles.length) throw usageError('profile.none', _('error.profile.none'), _('hint.profile.create'));
  const index = Number.parseInt(selection ?? '', 10);
  const selected = Number.isInteger(index) && index >= 1
    ? profiles[index - 1]
    : profiles.find(profile => profile.name === selection);
  if (!selected) throw usageError('profile.not-found', _('error.profile.not-found', { name: selection ?? '' }), _('hint.profile.list'));
  return selected.name;
}
