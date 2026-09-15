import type { CliError } from '../shared/errors.ts';

/**
 * Human messages and machine results travel separately. Normally messages go
 * to stdout. With `--json`, stdout carries exactly one JSON document and every
 * message moves to stderr, so a script or agent can parse stdout directly.
 */

let jsonMode = false;

export function setJsonMode(on: boolean): void {
  jsonMode = on;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

/** A progress or result message for people. */
export function say(message: string): void {
  (jsonMode ? process.stderr : process.stdout).write(`${message}\n`);
}

/** A warning; always stderr. */
export function warn(message: string): void {
  process.stderr.write(`${message}\n`);
}

export interface CommandOutcome {
  exitCode: number;
  data?: unknown;
  warnings?: string[];
}

export interface JsonEnvelope {
  schemaVersion: 1;
  command: string;
  exitCode: number;
  ok: boolean;
  data: unknown;
  warnings: string[];
  errors: { code: string; message: string; hint: string | null }[];
}

export function envelope(command: string, outcome: CommandOutcome, error: CliError | null = null): JsonEnvelope {
  return {
    schemaVersion: 1,
    command,
    exitCode: outcome.exitCode,
    ok: outcome.exitCode === 0,
    data: outcome.data ?? null,
    warnings: outcome.warnings ?? [],
    errors: error ? [{ code: error.code, message: error.message, hint: error.hint }] : []
  };
}

export function writeJson(value: JsonEnvelope): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
