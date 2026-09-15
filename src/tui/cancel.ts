import { isCancel } from '@clack/prompts';

/**
 * Prompts resolve to `T | symbol`, but clack's `isCancel` narrows only its own
 * unique cancel symbol and leaves `symbol` in the type. Narrow any symbol away.
 */
export function cancelled(value: unknown): value is symbol {
  return isCancel(value);
}
