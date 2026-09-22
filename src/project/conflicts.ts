import { createTwoFilesPatch, diffLines } from 'diff';
import type { ManagedKind } from '../shared/types.ts';

/**
 * agctx 관리 영역 안에서 한 수정을 보여 주고 푸는 순수 도우미.
 * 「base」는 agctx가 마지막으로 쓴 그대로의 관리 영역이다. `.agctx/base/`에 두어서 사용자 수정과
 * 나중의 프로필 변경을 가려낼 수 있게 한다.
 */

export const MANAGED_END = '<!-- agctx:managed:end -->';
export const BASE_DIR = '.agctx/base';
export const BACKUP_DIR = '.agctx/backups';
export const AGCTX_GITIGNORE = '.agctx/.gitignore';

/** 관리 파일의 base 파일. 프로젝트 기준 경로이고 항상 `/`로 나눈다. */
export function baseFilePath(relativePath: string): string {
  return `${BASE_DIR}/${relativePath.replaceAll('\\', '/')}.base`;
}

export function serializeBase(managed: string): string {
  return `${managed}\n`;
}

export function parseBase(content: string): string {
  return content.endsWith('\n') ? content.slice(0, -1) : content;
}

function withTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function splitLines(value: string): string[] {
  const lines = value.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
}

export interface UserEdits {
  addedLines: string[];
  removedLines: string[];
}

/** 사용자가 base와 비교해 관리 영역에 더하거나 뺀 줄. */
export function collectUserEdits(base: string, current: string): UserEdits {
  const addedLines: string[] = [];
  const removedLines: string[] = [];
  for (const part of diffLines(withTrailingNewline(base), withTrailingNewline(current))) {
    if (part.added) addedLines.push(...splitLines(part.value));
    else if (part.removed) removedLines.push(...splitLines(part.value));
  }
  return { addedLines: trimBlankEdges(addedLines), removedLines: removedLines.filter(line => line.trim()) };
}

/**
 * agctx가 절대 다시 쓰지 않는 곳에 사용자 줄을 둔다: 포인터 파일의 관리 블록 바로 아래, 또는
 * AGENTS.md 확장 영역의 끝.
 * @param content - 관리 영역을 이미 다시 만든 파일 내용
 */
export function relocateUserEdits(content: string, lines: readonly string[], kind: ManagedKind): string {
  if (!lines.length) return content;
  const block = lines.join('\n');
  const index = content.indexOf(MANAGED_END);
  if (kind === 'agents' || index === -1) return `${content.trimEnd()}\n\n${block}\n`;
  const head = content.slice(0, index + MANAGED_END.length);
  const tail = content.slice(index + MANAGED_END.length).replace(/^\n+/, '');
  return `${head}\n\n${block}\n${tail ? `\n${tail}` : ''}`;
}

export function formatDiff(oldName: string, newName: string, oldText: string, newText: string): string {
  return createTwoFilesPatch(oldName, newName, withTrailingNewline(oldText), withTrailingNewline(newText), '', '', {
    context: 3
  });
}
