import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeTextAtomic } from './fs-utils.mjs';
import { SUPPORTED_LOCALES } from './i18n/index.mjs';

const LEGACY_CORES_DIR = '.agentic-cores';        // pre-rename layout (Core era)
const LEGACY_PROFILES_DIR = '.agentic-profiles';  // post-rename, pre-nesting layout
const LEGACY_METADATA_FILE = 'agentic-core.json';
const AGENTIC_DIR = '.agentic';
const PROFILES_SUBDIR = 'profiles';
const CONFIG_FILE = 'config.json';
export const PROFILE_METADATA_FILE = 'agentic-profile.json';

/**
 * Move a flat legacy home (`.agentic-cores` or `.agentic-profiles`) into
 * `.agentic/profiles`, lift its `config.json` up to `.agentic/config.json`,
 * and, for the Core-era layout, rename each `agentic-core.json` to
 * `agentic-profile.json`. Best-effort and one-time: if anything fails, fall
 * back to the new (possibly empty) home instead of crashing the CLI.
 */
function migrateFlatHome(flatDir, agenticDir, profilesDir, { renameMetadata }) {
  try {
    fs.mkdirSync(agenticDir, { recursive: true });
    fs.renameSync(flatDir, profilesDir);
  } catch {
    return;
  }
  if (renameMetadata) {
    for (const entry of fs.readdirSync(profilesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const legacyMetadata = path.join(profilesDir, entry.name, LEGACY_METADATA_FILE);
      const currentMetadata = path.join(profilesDir, entry.name, PROFILE_METADATA_FILE);
      if (fs.existsSync(legacyMetadata) && !fs.existsSync(currentMetadata)) {
        try { fs.renameSync(legacyMetadata, currentMetadata); } catch {}
      }
    }
  }
  // config.json sat beside the profile dirs in the flat layout; lift it out.
  const movedConfig = path.join(profilesDir, CONFIG_FILE);
  const targetConfig = path.join(agenticDir, CONFIG_FILE);
  if (fs.existsSync(movedConfig) && !fs.existsSync(targetConfig)) {
    try { fs.renameSync(movedConfig, targetConfig); } catch {}
  }
}

/**
 * Resolve the user's profile home (`<base>/.agentic/profiles`), migrating a
 * legacy `.agentic-profiles` or `.agentic-cores` home once on first use.
 */
export function profileHome() {
  const base = process.env.AGENTIC_HOME || os.homedir();
  const agenticDir = path.join(base, AGENTIC_DIR);
  const current = path.join(agenticDir, PROFILES_SUBDIR);
  if (!fs.existsSync(current)) {
    const legacyProfiles = path.join(base, LEGACY_PROFILES_DIR);
    const legacyCores = path.join(base, LEGACY_CORES_DIR);
    if (fs.existsSync(legacyProfiles)) migrateFlatHome(legacyProfiles, agenticDir, current, { renameMetadata: false });
    else if (fs.existsSync(legacyCores)) migrateFlatHome(legacyCores, agenticDir, current, { renameMetadata: true });
  }
  return current;
}

/** The locale config lives beside the profiles dir, at `<base>/.agentic/config.json`. */
function configPath() {
  profileHome(); // trigger the one-time legacy migration before reading or writing config
  return path.join(process.env.AGENTIC_HOME || os.homedir(), AGENTIC_DIR, CONFIG_FILE);
}

export function readAgenticConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    if (config && typeof config === 'object' && !Array.isArray(config)) return config;
  } catch {}
  return {};
}

export function getSavedLocale() {
  const locale = readAgenticConfig().locale;
  return SUPPORTED_LOCALES.includes(locale) ? locale : null;
}

export function saveLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) throw new Error(`locale must be one of: ${SUPPORTED_LOCALES.join(', ')}.`);
  const config = { ...readAgenticConfig(), locale };
  fs.mkdirSync(profileHome(), { recursive: true });
  writeTextAtomic(configPath(), JSON.stringify(config, null, 2) + '\n');
  return locale;
}
