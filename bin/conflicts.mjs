import { createTwoFilesPatch } from 'diff';

/** Formatting helpers for showing edits made inside Agentic-managed areas. */

function withTrailingNewline(text) {
  return text.endsWith('\n') ? text : `${text}\n`;
}

export function formatDiff(oldName, newName, oldText, newText) {
  return createTwoFilesPatch(oldName, newName, withTrailingNewline(oldText), withTrailingNewline(newText), '', '', { context: 3 });
}
