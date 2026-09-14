import { createTwoFilesPatch, diffLines } from 'diff';

/**
 * Pure helpers for showing and resolving edits made inside Agentic-managed areas.
 * A "base" is the managed area exactly as Agentic last wrote it, kept under
 * `.agentic/base/` so user edits can be told apart from later profile changes.
 */

export const MANAGED_END = '<!-- agentic:managed:end -->';
export const BASE_DIR = '.agentic/base';
export const BACKUP_DIR = '.agentic/backups';
export const AGENTIC_GITIGNORE = '.agentic/.gitignore';

/** Project-relative base file for a managed file, always `/`-separated. */
export function baseFilePath(relativePath) {
  return `${BASE_DIR}/${relativePath.replaceAll('\\', '/')}.base`;
}

export function serializeBase(managed) {
  return `${managed}\n`;
}

export function parseBase(content) {
  return content.endsWith('\n') ? content.slice(0, -1) : content;
}

function withTrailingNewline(text) {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function splitLines(value) {
  const lines = value.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function trimBlankEdges(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
}

/**
 * Lines the user added to or removed from a managed area, relative to its base.
 * @param {string} base
 * @param {string} current
 * @returns {{ addedLines: string[], removedLines: string[] }}
 */
export function collectUserEdits(base, current) {
  const addedLines = [];
  const removedLines = [];
  for (const part of diffLines(withTrailingNewline(base), withTrailingNewline(current))) {
    if (part.added) addedLines.push(...splitLines(part.value));
    else if (part.removed) removedLines.push(...splitLines(part.value));
  }
  return { addedLines: trimBlankEdges(addedLines), removedLines: removedLines.filter(line => line.trim()) };
}

/**
 * Put user lines where Agentic never rewrites them: right below the managed
 * block of a pointer file, or at the end of the AGENTS.md extension section.
 * @param {string} content - file content whose managed area is already regenerated
 * @param {string[]} lines
 * @param {'agents'|'pointer'} kind
 */
export function relocateUserEdits(content, lines, kind) {
  if (!lines.length) return content;
  const block = lines.join('\n');
  const index = content.indexOf(MANAGED_END);
  if (kind === 'agents' || index === -1) return `${content.trimEnd()}\n\n${block}\n`;
  const head = content.slice(0, index + MANAGED_END.length);
  const tail = content.slice(index + MANAGED_END.length).replace(/^\n+/, '');
  return `${head}\n\n${block}\n${tail ? `\n${tail}` : ''}`;
}

export function formatDiff(oldName, newName, oldText, newText) {
  return createTwoFilesPatch(oldName, newName, withTrailingNewline(oldText), withTrailingNewline(newText), '', '', { context: 3 });
}
