import path from 'node:path';

/**
 * The repository-relative path fed into a doc-source hash, always with `/`.
 * `path.relative` uses the platform separator, so without this a hash stamped on
 * macOS or Linux would never verify on Windows.
 * @param {string} root
 * @param {string} filePath
 * @param {typeof path} [pathApi] - injectable so tests can exercise `path.win32`
 * @returns {string}
 */
export function docSourceHashPath(root, filePath, pathApi = path) {
  return pathApi.relative(root, filePath).split(pathApi.sep).join('/');
}
