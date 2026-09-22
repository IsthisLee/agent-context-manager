/** Exit codes shared by every command. When several apply, the most severe wins: 3 > 2 > 1. */
export const EXIT = {
  ok: 0,
  behind: 1,
  conflict: 2,
  hiddenCharacters: 3,
  deliveryMissing: 4,
  usage: 64,
  unavailable: 69,
  software: 70
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** The worst of several outcome codes, following 3 > 2 > 1 > 0. */
export function worstExitCode(codes: readonly number[]): number {
  const order = [EXIT.hiddenCharacters, EXIT.conflict, EXIT.behind];
  return order.find(code => codes.includes(code)) ?? codes.find(code => code !== EXIT.ok) ?? EXIT.ok;
}

/**
 * An error a user can act on: what went wrong, the exit code, and the next
 * command to run. Messages are already localized when the error is created.
 */
export class CliError extends Error {
  readonly exitCode: number;
  readonly code: string;
  readonly hint: string | null;
  readonly details: unknown;

  constructor(
    code: string,
    message: string,
    options: { exitCode?: number; hint?: string | null; details?: unknown } = {}
  ) {
    super(message);
    this.code = code;
    this.exitCode = options.exitCode ?? EXIT.software;
    this.hint = options.hint ?? null;
    this.details = options.details;
  }
}

/** Any thrown value as a CliError; unexpected errors become exit code 70. */
export function toCliError(error: unknown): CliError {
  return error instanceof CliError
    ? error
    : new CliError('internal', error instanceof Error ? error.message : String(error));
}

export function usageError(code: string, message: string, hint: string | null = null): CliError {
  return new CliError(code, message, { exitCode: EXIT.usage, hint });
}
