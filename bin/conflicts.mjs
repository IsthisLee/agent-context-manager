import { createTwoFilesPatch } from 'diff';

/**
 * Helpers for managed-area conflicts. A "base" is the managed area exactly as
 * Agentic last wrote it, kept under `.agentic/base/` so later edits can be shown
 * against it.
 */

export const BASE_DIR = '.agentic/base';

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

export function formatDiff(oldName, newName, oldText, newText) {
  return createTwoFilesPatch(oldName, newName, withTrailingNewline(oldText), withTrailingNewline(newText), '', '', { context: 3 });
}
