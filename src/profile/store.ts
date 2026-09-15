import fs from 'node:fs';
import path from 'node:path';
import { writeTextAtomic } from '../shared/fs-utils.ts';
import { PROFILE_METADATA_FILE, profileHome } from '../shared/home.ts';
import { getLocale } from '../i18n/index.ts';
import { PACKAGE_ROOT } from '../shared/runtime.ts';
import type { Profile, ProfileMetadata, Scope } from '../shared/types.ts';

export const SCOPES: readonly Scope[] = ['personal', 'company', 'team', 'workspace'];

const PROFILE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && (SCOPES as readonly string[]).includes(value);
}

export function validateProfileName(name: string | null | undefined): asserts name is string {
  if (!name || !PROFILE_NAME.test(name)) {
    throw new Error('Profile name must use 1-64 lowercase letters, numbers, or hyphens.');
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
  if (!fs.existsSync(metadataPath) || !fs.existsSync(instructionsPath)) throw new Error(`Profile not found: ${name}`);
  let metadata: unknown;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    throw new Error(`Invalid profile metadata: ${name}`);
  }
  if (!isValidProfileMetadata(metadata, name)) throw new Error(`Invalid profile metadata: ${name}`);
  return { profileDir, metadataPath, instructionsPath, metadata };
}

export function createProfile(name: string, scope: string = 'personal'): void {
  validateProfileName(name);
  if (!isScope(scope)) throw new Error(`Profile scope must be one of: ${SCOPES.join(', ')}.`);
  const profileDir = path.join(profileHome(), name);
  if (fs.existsSync(profileDir)) throw new Error(`Profile already exists: ${name}`);
  fs.mkdirSync(profileDir, { recursive: true });
  writeTextAtomic(path.join(profileDir, PROFILE_METADATA_FILE), JSON.stringify({ schemaVersion: 1, name, scope, createdAt: new Date().toISOString() }, null, 2) + '\n');
  const profileTemplate = fs.readFileSync(path.join(PACKAGE_ROOT, getLocale() === 'ko' ? 'templates/profile/AGENTS.ko.md' : 'templates/profile/AGENTS.md'), 'utf8');
  writeTextAtomic(path.join(profileDir, 'AGENTS.md'), profileTemplate.replaceAll('{{PROFILE_NAME}}', name));
  console.log(`Created profile: ${name} (${scope})`);
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
  console.log(`Removed profile: ${name}`);
}

export function viewProfile(name: string): void {
  const profile = readProfile(name);
  console.log(`${profile.metadata.name}\t${profile.metadata.scope}`);
  console.log(fs.readFileSync(profile.instructionsPath, 'utf8').trim());
}

export function selectProfile(selection: string | undefined, profiles: ProfileMetadata[] = getProfiles()): string {
  if (!profiles.length) throw new Error('No profiles found. Run `agctx profile create` first.');
  const index = Number.parseInt(selection ?? '', 10);
  const selected = Number.isInteger(index) && index >= 1
    ? profiles[index - 1]
    : profiles.find(profile => profile.name === selection);
  if (!selected) throw new Error(`Profile selection not found: ${selection}`);
  return selected.name;
}
