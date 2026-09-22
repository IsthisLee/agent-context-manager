import type { CliError } from '../shared/errors.ts';

/**
 * 사람이 읽는 메시지와 기계가 읽는 결과는 따로 다닌다. 평소에는 메시지가 stdout으로 간다.
 * `--json`이면 stdout에는 JSON 문서 하나만 나가고 모든 메시지는 stderr로 옮겨서, 스크립트나
 * 에이전트가 stdout을 바로 해석할 수 있다.
 */

let jsonMode = false;

export function setJsonMode(on: boolean): void {
  jsonMode = on;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

/** 사람에게 보이는 진행·결과 메시지. */
export function say(message: string): void {
  (jsonMode ? process.stderr : process.stdout).write(`${message}\n`);
}

/** 경고. 항상 stderr로 간다. */
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
