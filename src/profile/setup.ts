import fs from 'node:fs';
import { parseFlag } from '../commands/args.ts';
import { say } from '../commands/output.ts';
import { _, getLocale, guidanceSections } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { toLf, writeTextAtomic } from '../shared/fs-utils.ts';
import type { GuidanceKey, GuidanceLevel } from '../shared/types.ts';
import { readProfile } from './store.ts';

/**
 * 정해진 순서의 항목과, 새 프로필이 시작하는 단계. 응답 언어는 기본으로 꺼져 있다. 공급사 안내가
 * 뒷받침하는 관행이 아니라 팀의 관례이기 때문이다(ADR 0026).
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

/** 정해진 순서의 지침 항목. */
export const GUIDANCE_KEYS = Object.keys(guidanceDefaults) as GuidanceKey[];

export function isGuidanceLevel(value: unknown): value is GuidanceLevel {
  return value === 'off' || value === 'on';
}

/**
 * ADR 0028 전에 저장한 프로필에는 `recommended`나 `strict`가 있다. 둘 다 항목을 배포한다는 뜻이었으므로
 * 둘 다 `on`으로 읽고, 프로필은 계속 동작한다.
 */
function storedLevel(value: unknown): GuidanceLevel | null {
  if (value === 'recommended' || value === 'strict') return 'on';
  return isGuidanceLevel(value) ? value : null;
}

export function setupProfile(
  name: string,
  values: readonly string[]
): { profile: string; settings: Record<GuidanceKey, GuidanceLevel> } {
  const profile = readProfile(name);
  const settings = {} as Record<GuidanceKey, GuidanceLevel>;
  for (const key of GUIDANCE_KEYS) {
    const value = parseFlag(values, key, storedLevel(profile.metadata.settings?.[key]) || guidanceDefaults[key]);
    if (!isGuidanceLevel(value))
      throw usageError('setup.invalid-level', _('error.setup.invalid-level', { option: `--${key}` }), null);
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
  writeTextAtomic(
    profile.instructionsPath,
    pattern.test(current) ? current.replace(pattern, block) : `${current.trimEnd()}\n\n${block}\n`
  );
  writeTextAtomic(
    profile.metadataPath,
    JSON.stringify({ ...profile.metadata, settings, updatedAt: new Date().toISOString() }, null, 2) + '\n'
  );
  say(_('setup.done', { name }));
  return { profile: name, settings };
}
