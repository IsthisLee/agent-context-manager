import fs from 'node:fs';
import path from 'node:path';

/**
 * Discussion areas under `docs/discussion`. An area is a folder that holds a
 * `topics/` directory, so the package implementation plan and repository
 * operations keep separate indexes while the same status and summary checks
 * cover both. Areas are returned sorted so error order does not depend on the
 * filesystem.
 */
export function discussionRoots(discussionDir: string): string[] {
  if (!fs.existsSync(discussionDir)) return [];
  return fs
    .readdirSync(discussionDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(discussionDir, entry.name, 'topics')))
    .map(entry => entry.name)
    .sort();
}
