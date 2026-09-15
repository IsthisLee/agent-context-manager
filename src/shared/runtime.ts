import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Package root, for reading bundled templates. `src/lib` and `dist/lib` are both two levels down. */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let invokedAs = 'agentic';

/** Remember which bin name started this process (`agentic` or `agt`). */
export function setInvokedAs(argv1: string | undefined): void {
  invokedAs = path.basename(argv1 || 'agentic').replace(/\.(?:mjs|js|ts)$/, '');
}

export function getInvokedAs(): string {
  return invokedAs;
}

export function cliName(): string {
  return invokedAs === 'agt' ? 'agt' : 'agentic';
}
