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
  return record.schemaVersion === 1
    && typeof record.name === 'string'
    && (!expectedName || record.name === expectedName)
    && PROFILE_NAME.test(record.name)
    && isScope(record.scope);
}

export function readProfile(name: string): Profile {
  validateProfileName(name);
  const profileDir = path.join(profileHome(), name);
  const metadataPath = path.join(profileDir, PROFILE_METADATA_FILE);
  const instructionsPath = path.join(profileDir, 'AGENTS.md');
  if (!fs.existsSync(metadataPath) || !fs.existsSync(instructionsPath)) {
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
  return { profileDir, metadataPath, instructionsPath, metadata };
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
  writeTextAtomic(path.join(profileDir, 'AGENTS.md'), profileTemplate.replaceAll('{{PROFILE_NAME}}', name));
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
