import fs from 'node:fs';
import path from 'node:path';
import { say } from '../commands/output.ts';
import { _, getLocale } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { writeTextAtomic } from '../shared/fs-utils.ts';
import { PROFILE_METADATA_FILE, profileHome } from '../shared/home.ts';
import { PACKAGE_ROOT } from '../shared/runtime.ts';
import type { Profile, ProfileMetadata, Scope } from '../shared/types.ts';

export const SCOPES: readonly Scope[] = ['personal', 'company', 'team', 'workspace'];

const PROFILE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** The rules file of a profile whose profile.json names none. */
export const DEFAULT_INSTRUCTIONS = 'AGENTS.md';

export function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && (SCOPES as readonly string[]).includes(value);
}

export function validateProfileName(name: string | null | undefined): asserts name is string {
  if (!name || !PROFILE_NAME.test(name)) {
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
  const profileDir = path.join(profileHome(), name);
  const metadataPath = path.join(profileDir, PROFILE_METADATA_FILE);
  if (!fs.existsSync(metadataPath)) {
    throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
  }
  let metadata: unknown;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    metadata = null;
  }
  if (!isValidProfileMetadata(metadata, name)) {
    throw usageError('profile.invalid-metadata', _('error.profile.invalid-metadata', { name, file: metadataPath }), null);
  }
  const instructions = instructionsFile(metadata);
  assertInstructionsPath(instructions, metadataPath);
  // The store is the user's own folder, so a rules file linked in from elsewhere stays usable here;
  // remote content is checked for links by clone and pull before it gets here.
  const instructionsPath = path.join(profileDir, ...instructions.split('/'));
  if (!fs.existsSync(instructionsPath)) {
    if (metadata.instructions === undefined) throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
    throw usageError('profile.instructions-missing', _('error.profile.instructions-missing', { source: metadataPath, file: instructions }), _('hint.profile.instructions'));
  }
  return { profileDir, metadataPath, instructions, instructionsPath, metadata };
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

export function getProfiles(): ProfileMetadata[] {
  const home = profileHome();
  if (!fs.existsSync(home)) return [];
  const profiles: ProfileMetadata[] = [];
  for (const name of fs.readdirSync(home).sort()) {
    const metadataPath = path.join(home, name, PROFILE_METADATA_FILE);
    if (!fs.existsSync(metadataPath)) continue;
    try {
      const metadata: unknown = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      if (isValidProfileMetadata(metadata, name)) profiles.push(metadata);
    } catch {}
  }
  return profiles.sort((a, b) => `${a.scope}:${a.name}`.localeCompare(`${b.scope}:${b.name}`));
}

export function removeProfile(name: string): void {
  const profile = readProfile(name);
  fs.rmSync(profile.profileDir, { recursive: true, force: true });
  say(_('remove.done', { name }));
}

export function viewProfile(name: string): { name: string; scope: Scope; instructions: string } {
  const profile = readProfile(name);
  const instructions = fs.readFileSync(profile.instructionsPath, 'utf8').trim();
  say(`${profile.metadata.name}\t${profile.metadata.scope}`);
  say(instructions);
  return { name: profile.metadata.name, scope: profile.metadata.scope, instructions };
}

export function selectProfile(selection: string | undefined, profiles: ProfileMetadata[] = getProfiles()): string {
  if (!profiles.length) throw usageError('profile.none', _('error.profile.none'), _('hint.profile.create'));
  const index = Number.parseInt(selection ?? '', 10);
  const selected = Number.isInteger(index) && index >= 1
    ? profiles[index - 1]
    : profiles.find(profile => profile.name === selection);
  if (!selected) throw usageError('profile.not-found', _('error.profile.not-found', { name: selection ?? '' }), _('hint.profile.list'));
  return selected.name;
}
