export function parseFlag(values, flag, fallback = null) {
  const index = values.indexOf(`--${flag}`);
  return index === -1 ? fallback : values[index + 1];
}

export function hasFlag(values, flag) {
  return values.includes(`--${flag}`);
}

export function stripFlag(values, flag) {
  const index = values.indexOf(`--${flag}`);
  if (index === -1) return values.slice();
  const removed = values.slice();
  removed.splice(index, index + 1 < removed.length ? 2 : 1);
  return removed;
}
