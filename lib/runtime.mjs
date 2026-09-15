import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Package root, for reading bundled templates. */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let invokedAs = 'agentic';

/** Remember which bin name started this process (`agentic` or `agt`). */
export function setInvokedAs(argv1) {
  invokedAs = path.basename(argv1 || 'agentic').replace(/\.mjs$/, '');
}

export function getInvokedAs() {
  return invokedAs;
}

export function cliName() {
  return invokedAs === 'agt' ? 'agt' : 'agentic';
}
