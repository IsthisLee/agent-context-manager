import path from 'node:path';

/**
 * The repository-relative path fed into a doc-source hash, always with `/`.
 * `path.relative` uses the platform separator, so without this a hash stamped on
 * macOS or Linux would never verify on Windows.
 * @param pathApi - injectable so tests can exercise `path.win32`
 */
export function docSourceHashPath(root: string, filePath: string, pathApi: typeof path = path): string {
  return pathApi.relative(root, filePath).split(pathApi.sep).join('/');
}
