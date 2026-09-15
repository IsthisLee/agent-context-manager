import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeTextAtomic } from './fs-utils.ts';
import { isLocale, SUPPORTED_LOCALES } from '../i18n/index.ts';
import type { Locale } from './types.ts';

export const PROFILE_METADATA_FILE = 'profile.json';

/** The agctx data folder: `AGCTX_HOME` when set, otherwise `~/.agctx`. */
export function agctxHome(): string {
  return process.env.AGCTX_HOME || path.join(os.homedir(), '.agctx');
}

/** The folder holding one subfolder per profile. */
export function profileHome(): string {
  return path.join(agctxHome(), 'profiles');
}

function configPath(): string {
  return path.join(agctxHome(), 'config.json');
}

export function readConfig(): Record<string, unknown> {
  try {
    const config: unknown = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    if (config && typeof config === 'object' && !Array.isArray(config)) return config as Record<string, unknown>;
  } catch {}
  return {};
}

export function getSavedLocale(): Locale | null {
  const locale = readConfig().locale;
  return isLocale(locale) ? locale : null;
}

export function saveLocale(locale: string): Locale {
  if (!isLocale(locale)) throw new Error(`locale must be one of: ${SUPPORTED_LOCALES.join(', ')}.`);
  writeTextAtomic(configPath(), JSON.stringify({ ...readConfig(), locale }, null, 2) + '\n');
  return locale;
}
