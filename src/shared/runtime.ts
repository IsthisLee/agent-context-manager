import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Package root, for reading bundled templates. `src/shared` and `dist/shared` are both two levels down. */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let version: string | null = null;

/** The version of the installed package, read once from its package.json. */
export function packageVersion(): string {
  if (version === null) version = String((JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version?: unknown }).version ?? '');
  return version;
}
