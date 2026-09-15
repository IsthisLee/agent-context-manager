import { createHash } from 'node:crypto';
import { SUPPORTED_LOCALES, t } from '../i18n/index.ts';

/**
 * Project guidance merge helpers.
 * Profile instructions and project-specific instructions remain separate owners.
 */

// The extension header is rendered in the active locale, so recognize every
// locale's heading. Otherwise an English project loses its boundary and any
// domain rule added under it reads as an edit to the profile-owned region.
const EXTENSION_HEADER = /## \d+\.\s*(?:프로젝트 규칙 확장|Project rule extensions)[^\n]*\n+/i;
const EXTENSION_BOILERPLATES = SUPPORTED_LOCALES.map(locale => t(locale, 'scaffold.extBody'));

/**
 * Merge a profile-rendered AGENTS.md with the project's domain-rule extension.
 * @param profileContent - rendered profile instructions
 * @param existingContent - existing project AGENTS.md
 */
export function mergeAgentsMd(profileContent: string, existingContent?: string | null): string {
  if (!existingContent || typeof existingContent !== 'string') return profileContent;

  const match = existingContent.match(EXTENSION_HEADER);
  if (!match) {
    return `${profileContent.trimEnd()}\n\n## Existing project guidance\n\n${existingContent.trim()}\n`;
  }

  const contentAfterHeader = existingContent.slice((match.index ?? 0) + match[0].length).trim();
  if (!contentAfterHeader) return profileContent;

  const boilerplate = EXTENSION_BOILERPLATES.find(text => contentAfterHeader.startsWith(text));
  const customRules = boilerplate
    ? contentAfterHeader.slice(boilerplate.length).trim()
    : contentAfterHeader;
  if (!customRules) return profileContent;

  return `${profileContent.trimEnd()}\n\n${customRules}\n`;
}

/**
 * Return the profile-owned portion of a project AGENTS.md.
 * The project extension section and everything below it belong to the project.
 */
export function extractAgentsManagedDocument(content: string | null | undefined): string | null {
  if (typeof content !== 'string') return null;
  const extension = content.match(EXTENSION_HEADER);
  if (extension) return content.slice(0, extension.index).trimEnd();
  const preserved = content.match(/## Existing project guidance\s*\n+/i);
  if (preserved) return content.slice(0, preserved.index).trimEnd();
  return content.trimEnd();
}

export function hashAgentsManagedDocument(content: string | null | undefined): string | null {
  const managed = extractAgentsManagedDocument(content);
  return managed ? createHash('sha256').update(managed).digest('hex') : null;
}

const LEADING_FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

/**
 * Replace only the Agentic-owned block in a generated guidance file.
 * Unmarked legacy files are preserved and receive a new managed block.
 * Agents parse rule frontmatter only from the first line, so template
 * frontmatter stays outside the block at the top of the file. Frontmatter
 * already at the top of the file is kept as the user's.
 */
export function mergeManagedDocument(managedContent: string, existingContent?: string | null): string {
  const start = '<!-- agentic:managed:start -->';
  const end = '<!-- agentic:managed:end -->';
  const template = managedContent.trim();
  const frontmatter = template.match(LEADING_FRONTMATTER)?.[0] || '';
  const managedBlock = `${start}\n${template.slice(frontmatter.length).trim()}\n${end}`;
  const withFrontmatter = (content: string) => (frontmatter ? `${frontmatter}\n${content}` : content);
  if (!existingContent || typeof existingContent !== 'string') return withFrontmatter(`${managedBlock}\n`);

  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  const merged = pattern.test(existingContent)
    ? `${existingContent.replace(pattern, managedBlock).trimEnd()}\n`
    : `${existingContent.trimEnd()}\n\n${managedBlock}\n`;
  return LEADING_FRONTMATTER.test(existingContent) ? merged : withFrontmatter(merged);
}

export function extractManagedDocument(content: string | null | undefined): string | null {
  const start = '<!-- agentic:managed:start -->';
  const end = '<!-- agentic:managed:end -->';
  const match = content?.match(new RegExp(`${start}[\\s\\S]*?${end}`, 'm'));
  return match?.[0] || null;
}

export function hashManagedDocument(content: string | null | undefined): string | null {
  const managed = extractManagedDocument(content);
  return managed ? createHash('sha256').update(managed).digest('hex') : null;
}
