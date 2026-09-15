import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Package root, for reading bundled templates. `src/shared` and `dist/shared` are both two levels down. */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
