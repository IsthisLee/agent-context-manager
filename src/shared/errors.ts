/** 모든 명령이 같이 쓰는 종료 코드. 여럿이 해당하면 가장 심각한 것이 이긴다: 3 > 2 > 1. */
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

/** 여러 결과 코드 가운데 가장 나쁜 것. 3 > 2 > 1 > 0 순서를 따른다. */
export function worstExitCode(codes: readonly number[]): number {
  const order = [EXIT.hiddenCharacters, EXIT.conflict, EXIT.behind];
  return order.find(code => codes.includes(code)) ?? codes.find(code => code !== EXIT.ok) ?? EXIT.ok;
}

/**
 * 사용자가 조치할 수 있는 오류: 무엇이 잘못됐는지, 종료 코드, 다음에 실행할 명령. 메시지는 오류를
 * 만들 때 이미 현지화돼 있다.
 */
export class CliError extends Error {
  readonly exitCode: number;
  readonly code: string;
  readonly hint: string | null;
  readonly details: unknown;
  /** 멈추기 전에 사람에게 이미 보여 준 경고. `--json`이면 이것을 결과의 `warnings`에 담는다. */
  readonly warnings: readonly string[];

  constructor(
    code: string,
    message: string,
    options: { exitCode?: number; hint?: string | null; details?: unknown; warnings?: readonly string[] } = {}
  ) {
    super(message);
    this.code = code;
    this.exitCode = options.exitCode ?? EXIT.software;
    this.hint = options.hint ?? null;
    this.details = options.details;
    this.warnings = options.warnings ?? [];
  }
}

/** 던져진 값을 CliError로 바꾼다. 예상하지 못한 오류는 종료 코드 70이 된다. */
export function toCliError(error: unknown): CliError {
  return error instanceof CliError
    ? error
    : new CliError('internal', error instanceof Error ? error.message : String(error));
}

export function usageError(code: string, message: string, hint: string | null = null): CliError {
  return new CliError(code, message, { exitCode: EXIT.usage, hint });
}
