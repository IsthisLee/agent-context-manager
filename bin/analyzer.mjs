/**
 * Project guidance merge helpers.
 * Core instructions and project-specific instructions remain separate owners.
 */

/**
 * Merge a Core-rendered AGENTS.md with the project's domain-rule extension.
 * @param {string} coreContent - rendered Core instructions
 * @param {string} [existingContent] - existing project AGENTS.md
 * @returns {string}
 */
export function mergeAgentsMd(coreContent, existingContent) {
  if (!existingContent || typeof existingContent !== 'string') return coreContent;

  const headerRegex = /## \d+\.\s*프로젝트 규칙 확장[^\n]*\n+/i;
  const match = existingContent.match(headerRegex);
  if (!match) {
    return `${coreContent.trimEnd()}\n\n## Existing project guidance\n\n${existingContent.trim()}\n`;
  }

  const contentAfterHeader = existingContent.slice(match.index + match[0].length).trim();
  if (!contentAfterHeader) return coreContent;

  const boilerplate = '이 프로젝트에만 적용되는 도메인 규칙은 이 섹션 아래에 추가한다. Core에는 역으로 동기화하지 않는다.';
  const customRules = contentAfterHeader.startsWith(boilerplate)
    ? contentAfterHeader.slice(boilerplate.length).trim()
    : contentAfterHeader;
  if (!customRules) return coreContent;

  return `${coreContent.trimEnd()}\n\n${customRules}\n`;
}
