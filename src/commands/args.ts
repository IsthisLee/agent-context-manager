export function parseFlag(values: readonly string[], flag: string): string | null | undefined;
export function parseFlag(values: readonly string[], flag: string, fallback: string): string | undefined;
export function parseFlag(
  values: readonly string[],
  flag: string,
  fallback: string | null = null
): string | null | undefined {
  const index = values.indexOf(`--${flag}`);
  return index === -1 ? fallback : values[index + 1];
}

export function hasFlag(values: readonly string[], flag: string): boolean {
  return values.includes(`--${flag}`);
}

export function stripFlag(values: readonly string[], flag: string): string[] {
  const index = values.indexOf(`--${flag}`);
  if (index === -1) return values.slice();
  const removed = values.slice();
  removed.splice(index, index + 1 < removed.length ? 2 : 1);
  return removed;
}
