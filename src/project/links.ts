import fs from 'node:fs';
import path from 'node:path';
import { git } from '../shared/git.ts';
import { filesBelow, SKIPPED_FOLDERS } from '../shared/scan.ts';

/**
 * Claude Code reads CLAUDE.md, not AGENTS.md. A monorepo package with its own
 * AGENTS.md needs a CLAUDE.md next to it that imports the file; agctx creates
 * and manages that link unless a person already put a CLAUDE.md there.
 */

export const LINK_TEMPLATE = 'templates/CLAUDE.link.md';

const toPosix = (rel: string) => rel.split(path.sep).join('/');

/** Tracked and untracked but not ignored files in the Git work tree rooted at `dir`; null outside Git or without git. */
function gitListed(dir: string): string[] | null {
  if (!fs.existsSync(path.join(dir, '.git'))) return null;
  try {
    const result = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*AGENTS.md'], { cwd: dir, allowFailure: true });
    return result.status === 0 ? result.stdout.split('\0').filter(rel => rel && fs.existsSync(path.join(dir, rel))) : null;
  } catch {
    return null;
  }
}

/** Project-relative `/` paths of AGENTS.md files below the project root, outside dependency and build folders. */
export function nestedAgentsFiles(targetDir: string): string[] {
  const listed = gitListed(targetDir) ?? filesBelow(targetDir, ['AGENTS.md']).map(file => toPosix(path.relative(targetDir, file)));
  return listed
    .filter(rel => rel.endsWith('/AGENTS.md') && !rel.split('/').slice(0, -1).some(part => SKIPPED_FOLDERS.has(part)))
    .sort();
}

/** A CLAUDE.md a person already placed for `folder`, or null. */
export function personLink(targetDir: string, folder: string): string | null {
  for (const rel of [`${folder}/CLAUDE.md`, `${folder}/.claude/CLAUDE.md`]) {
    try {
      fs.lstatSync(path.join(targetDir, rel));
      return rel;
    } catch {
      // not there
    }
  }
  return null;
}

/** Whether a CLAUDE.md reaches `agentsFile`: a symbolic link to it, or an `@` import outside code. */
export function linksTo(claudeFile: string, agentsFile: string): boolean {
  if (fs.lstatSync(claudeFile).isSymbolicLink()) return true;
  const text = fs.readFileSync(claudeFile, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return [...text.matchAll(/(?:^|\s)@([^\s@`)\]]+)/gm)].some(match => path.resolve(path.dirname(claudeFile), match[1]) === agentsFile);
}
