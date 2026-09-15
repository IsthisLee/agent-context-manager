import fs from 'node:fs';
import { parseFlag } from '../commands/args.ts';
import { say } from '../commands/output.ts';
import { _, getLocale, guidanceLevelDefinitions, guidanceSections } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { toLf, writeTextAtomic } from '../shared/fs-utils.ts';
import type { GuidanceKey, GuidanceLevel } from '../shared/types.ts';
import { readProfile } from './store.ts';

export const guidanceDefaults: Record<GuidanceKey, GuidanceLevel> = { harness: 'recommended', tdd: 'recommended', review: 'recommended', verification: 'recommended', documentation: 'recommended', security: 'recommended' };

/** Guidance items in their fixed order. */
export const GUIDANCE_KEYS = Object.keys(guidanceDefaults) as GuidanceKey[];

export function isGuidanceLevel(value: unknown): value is GuidanceLevel {
  return value === 'off' || value === 'recommended' || value === 'strict';
}

export function setupProfile(name: string, values: readonly string[]): { profile: string; settings: Record<GuidanceKey, GuidanceLevel> } {
  const profile = readProfile(name);
  const settings = {} as Record<GuidanceKey, GuidanceLevel>;
  for (const key of GUIDANCE_KEYS) {
    const value = parseFlag(values, key, profile.metadata.settings?.[key] || guidanceDefaults[key]);
    if (!isGuidanceLevel(value)) throw usageError('setup.invalid-level', _('error.setup.invalid-level', { option: `--${key}` }), null);
    settings[key] = value;
  }
  const sections = guidanceSections(getLocale());
  const blocks = GUIDANCE_KEYS.filter(key => settings[key] !== 'off').map(key => {
    const [title, body] = sections[key];
    return `## ${title}\n\n- ${_('setup.block.level')}: ${settings[key]}\n- ${body}`;
  });
  // Define what the levels mean once, from the shared constant, so the produced
  // file explains its own level labels instead of leaving them undefined.
  const definitions = guidanceLevelDefinitions(getLocale());
  const legend = `## ${_('setup.legend.title')}\n\n- recommended: ${definitions.recommended}\n- strict: ${definitions.strict}\n\n${_('setup.legend.intro')}`;
  const start = '<!-- agctx:guidance:start -->';
  const end = '<!-- agctx:guidance:end -->';
  const body = blocks.length ? [legend, ...blocks].join('\n\n') : '';
  const block = `${start}\n\n${body}\n\n${end}`;
  const current = toLf(fs.readFileSync(profile.instructionsPath, 'utf8'));
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  writeTextAtomic(profile.instructionsPath, (pattern.test(current) ? current.replace(pattern, block) : `${current.trimEnd()}\n\n${block}\n`));
  writeTextAtomic(profile.metadataPath, JSON.stringify({ ...profile.metadata, settings, updatedAt: new Date().toISOString() }, null, 2) + '\n');
  say(_('setup.done', { name }));
  return { profile: name, settings };
}
