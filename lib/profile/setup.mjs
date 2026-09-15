import fs from 'node:fs';
import { parseFlag } from '../args.mjs';
import { writeTextAtomic } from '../fs-utils.mjs';
import { _, getLocale, guidanceLevelDefinitions, guidanceSections } from '../i18n/index.mjs';
import { readProfile } from './store.mjs';

export const guidanceDefaults = { harness: 'recommended', tdd: 'recommended', review: 'recommended', verification: 'recommended', documentation: 'recommended', security: 'recommended' };

export function setupProfile(name, values) {
  const profile = readProfile(name);
  const settings = {};
  for (const key of Object.keys(guidanceDefaults)) {
    const value = parseFlag(values, key, profile.metadata.settings?.[key] || guidanceDefaults[key]);
    if (!['off', 'recommended', 'strict'].includes(value)) throw new Error(`--${key} must be off, recommended, or strict.`);
    settings[key] = value;
  }
  const sections = guidanceSections(getLocale());
  const blocks = Object.entries(settings).filter(([, value]) => value !== 'off').map(([key, value]) => {
    const [title, body] = sections[key];
    return `## ${title}\n\n- ${_('setup.block.level')}: ${value}\n- ${body}`;
  });
  // Define what the levels mean once, from the shared constant, so the produced
  // file explains its own `적용 수준` labels instead of leaving them undefined.
  const definitions = guidanceLevelDefinitions(getLocale());
  const legend = `## ${_('setup.legend.title')}\n\n- recommended: ${definitions.recommended}\n- strict: ${definitions.strict}\n\n${_('setup.legend.intro')}`;
  const start = '<!-- agentic:guidance:start -->';
  const end = '<!-- agentic:guidance:end -->';
  const body = blocks.length ? [legend, ...blocks].join('\n\n') : '';
  const block = `${start}\n\n${body}\n\n${end}`;
  const current = fs.readFileSync(profile.instructionsPath, 'utf8');
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  writeTextAtomic(profile.instructionsPath, (pattern.test(current) ? current.replace(pattern, block) : `${current.trimEnd()}\n\n${block}\n`));
  writeTextAtomic(profile.metadataPath, JSON.stringify({ ...profile.metadata, settings, updatedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(`Configured profile: ${name}`);
}
