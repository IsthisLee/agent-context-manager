import { createHash } from 'node:crypto';

/**
 * Project guidance merge helpers.
 * Profile instructions and project-specific instructions remain separate owners.
 */

/**
 * Merge a profile-rendered AGENTS.md with the project's domain-rule extension.
 * @param {string} profileContent - rendered profile instructions
 * @param {string} [existingContent] - existing project AGENTS.md
 * @returns {string}
 */
export function mergeAgentsMd(profileContent, existingContent) {
  if (!existingContent || typeof existingContent !== 'string') return profileContent;

  const headerRegex = /## \d+\.\s*프로젝트 규칙 확장[^\n]*\n+/i;
  const match = existingContent.match(headerRegex);
  if (!match) {
    return `${profileContent.trimEnd()}\n\n## Existing project guidance\n\n${existingContent.trim()}\n`;
  }

  const contentAfterHeader = existingContent.slice(match.index + match[0].length).trim();
  if (!contentAfterHeader) return profileContent;

  const boilerplate = '이 프로젝트에만 적용되는 도메인 규칙은 이 섹션 아래에 추가한다. 프로필에는 역으로 동기화하지 않는다.';
  const customRules = contentAfterHeader.startsWith(boilerplate)
    ? contentAfterHeader.slice(boilerplate.length).trim()
    : contentAfterHeader;
  if (!customRules) return profileContent;

  return `${profileContent.trimEnd()}\n\n${customRules}\n`;
}

/**
 * Return the profile-owned portion of a project AGENTS.md.
 * The project extension section and everything below it belong to the project.
 * @param {string} content
 * @returns {string|null}
 */
export function extractAgentsManagedDocument(content) {
  if (typeof content !== 'string') return null;
  const extension = content.match(/## \d+\.\s*프로젝트 규칙 확장[^\n]*\n+/i);
  if (extension) return content.slice(0, extension.index).trimEnd();
  const preserved = content.match(/## Existing project guidance\s*\n+/i);
  if (preserved) return content.slice(0, preserved.index).trimEnd();
  return content.trimEnd();
}

export function hashAgentsManagedDocument(content) {
  const managed = extractAgentsManagedDocument(content);
  return managed ? createHash('sha256').update(managed).digest('hex') : null;
}

/**
 * Replace only the Agentic-owned block in a generated guidance file.
 * Unmarked legacy files are preserved and receive a new managed block.
 * @param {string} managedContent
 * @param {string} [existingContent]
 * @returns {string}
 */
export function mergeManagedDocument(managedContent, existingContent) {
  const start = '<!-- agentic:managed:start -->';
  const end = '<!-- agentic:managed:end -->';
  const managedBlock = `${start}\n${managedContent.trim()}\n${end}`;
  if (!existingContent || typeof existingContent !== 'string') return `${managedBlock}\n`;

  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  if (pattern.test(existingContent)) return `${existingContent.replace(pattern, managedBlock).trimEnd()}\n`;

  return `${existingContent.trimEnd()}\n\n${managedBlock}\n`;
}

export function extractManagedDocument(content) {
  const start = '<!-- agentic:managed:start -->';
  const end = '<!-- agentic:managed:end -->';
  const match = content?.match(new RegExp(`${start}[\\s\\S]*?${end}`, 'm'));
  return match?.[0] || null;
}

export function hashManagedDocument(content) {
  const managed = extractManagedDocument(content);
  return managed ? createHash('sha256').update(managed).digest('hex') : null;
}
