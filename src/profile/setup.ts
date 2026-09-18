import fs from 'node:fs';
import { parseFlag } from '../commands/args.ts';
import { say } from '../commands/output.ts';
import { _, getLocale, guidanceSections } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { toLf, writeTextAtomic } from '../shared/fs-utils.ts';
import type { GuidanceKey, GuidanceLevel } from '../shared/types.ts';
import { readProfile } from './store.ts';

/**
 * Items in their fixed order, with the level each new profile starts from.
 * Response language is off by default: it is a team convention rather than a
 * practice with vendor guidance behind it (ADR 0026).
 */
export const guidanceDefaults: Record<GuidanceKey, GuidanceLevel> = {
  workflow: 'on',
  context: 'on',
  tdd: 'on',
  review: 'on',
  verification: 'on',
  instructions: 'on',
  docs: 'on',
  security: 'on',
  untrusted: 'on',
  language: 'off'
};

/** Guidance items in their fixed order. */
export const GUIDANCE_KEYS = Object.keys(guidanceDefaults) as GuidanceKey[];

export function isGuidanceLevel(value: unknown): value is GuidanceLevel {
  return value === 'off' || value === 'on';
}

/**
 * Profiles saved before ADR 0028 hold `recommended` or `strict`. Both meant the
 * item is deployed, so both read as `on` and the profile keeps working.
 */
function storedLevel(value: unknown): GuidanceLevel | null {
  if (value === 'recommended' || value === 'strict') return 'on';
  return isGuidanceLevel(value) ? value : null;
}

export function setupProfile(name: string, values: readonly string[]): { profile: string; settings: Record<GuidanceKey, GuidanceLevel> } {
  const profile = readProfile(name);
  const settings = {} as Record<GuidanceKey, GuidanceLevel>;
  for (const key of GUIDANCE_KEYS) {
    const value = parseFlag(values, key, storedLevel(profile.metadata.settings?.[key]) || guidanceDefaults[key]);
    if (!isGuidanceLevel(value)) throw usageError('setup.invalid-level', _('error.setup.invalid-level', { option: `--${key}` }), null);
    settings[key] = value;
  }
  const sections = guidanceSections(getLocale());
  const blocks = GUIDANCE_KEYS.filter(key => settings[key] !== 'off').map(key => {
    const [title, body] = sections[key];
    return `## ${title}\n\n${body}`;
  });
  const start = '<!-- agctx:guidance:start -->';
  const end = '<!-- agctx:guidance:end -->';
  const body = blocks.join('\n\n');
  const block = `${start}\n\n${body}\n\n${end}`;
  const current = toLf(fs.readFileSync(profile.instructionsPath, 'utf8'));
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  writeTextAtomic(profile.instructionsPath, (pattern.test(current) ? current.replace(pattern, block) : `${current.trimEnd()}\n\n${block}\n`));
  writeTextAtomic(profile.metadataPath, JSON.stringify({ ...profile.metadata, settings, updatedAt: new Date().toISOString() }, null, 2) + '\n');
  say(_('setup.done', { name }));
  return { profile: name, settings };
}
