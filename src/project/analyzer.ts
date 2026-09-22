import { createHash } from 'node:crypto';
import { SUPPORTED_LOCALES, t } from '../i18n/index.ts';
import { MANAGED_END } from './conflicts.ts';

/**
 * Project guidance merge helpers.
 * Profile instructions and project-specific instructions remain separate owners.
 */

// Fallback boundary for an AGENTS.md written before agctx put a marker in the
// file. Guessing where a heading ends is what made the boundary fragile: the
// heading is rendered in the active locale, and people renumber and re-level
// headings in their own file, so the number, the dot and the heading level are
// all optional here. A boundary that is not recognised makes the whole file
// managed and every edit a conflict, which is why MANAGED_END now decides and
// this pattern only carries older files until the next sync writes the marker.
const EXTENSION_HEADER = /^#{2,6}\s*(?:\d+\.?\s*)?(?:프로젝트 규칙 확장|Project rule extensions)[^\n]*\n+/im;
const EXTENSION_BOILERPLATES = SUPPORTED_LOCALES.map(locale => t(locale, 'scaffold.extBody'));

/** The profile-owned part of a rendered AGENTS.md: everything up to the marker. */
function managedHead(rendered: string): string {
  const marker = rendered.indexOf(MANAGED_END);
  return marker === -1 ? rendered.trimEnd() : rendered.slice(0, marker + MANAGED_END.length);
}

/**
 * Merge a profile-rendered AGENTS.md with the project's domain-rule extension.
 * @param profileContent - rendered profile instructions
 * @param existingContent - existing project AGENTS.md
 */
export function mergeAgentsMd(profileContent: string, existingContent?: string | null): string {
  if (!existingContent || typeof existingContent !== 'string') return profileContent;

  // Everything below the marker is the project's, heading and all, so it is
  // carried over as written instead of being rebuilt from the scaffold text.
  const marker = existingContent.indexOf(MANAGED_END);
  if (marker !== -1) {
    const kept = existingContent
      .slice(marker + MANAGED_END.length)
      .replace(/^\n+/, '')
      .trimEnd();
    const head = managedHead(profileContent);
    return kept ? `${head}\n\n${kept}\n` : `${head}\n`;
  }

  const match = existingContent.match(EXTENSION_HEADER);
  if (!match) {
    return `${profileContent.trimEnd()}\n\n## Existing project guidance\n\n${existingContent.trim()}\n`;
  }

  const contentAfterHeader = existingContent.slice((match.index ?? 0) + match[0].length).trim();
  if (!contentAfterHeader) return profileContent;

  const boilerplate = EXTENSION_BOILERPLATES.find(text => contentAfterHeader.startsWith(text));
  const customRules = boilerplate ? contentAfterHeader.slice(boilerplate.length).trim() : contentAfterHeader;
  if (!customRules) return profileContent;

  return `${profileContent.trimEnd()}\n\n${customRules}\n`;
}

/**
 * Return the profile-owned portion of a project AGENTS.md.
 * The project extension section and everything below it belong to the project.
 */
export function extractAgentsManagedDocument(content: string | null | undefined): string | null {
  if (typeof content !== 'string') return null;
  const marker = content.indexOf(MANAGED_END);
  if (marker !== -1) return content.slice(0, marker + MANAGED_END.length);
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
 * Replace only the agctx-owned block in a generated guidance file.
 * Unmarked legacy files are preserved and receive a new managed block.
 * Agents parse rule frontmatter only from the first line, so template
 * frontmatter stays outside the block at the top of the file. Frontmatter
 * already at the top of the file is kept as the user's.
 */
export function mergeManagedDocument(managedContent: string, existingContent?: string | null): string {
  const start = '<!-- agctx:managed:start -->';
  const end = '<!-- agctx:managed:end -->';
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
  const start = '<!-- agctx:managed:start -->';
  const end = '<!-- agctx:managed:end -->';
  const match = content?.match(new RegExp(`${start}[\\s\\S]*?${end}`, 'm'));
  return match?.[0] || null;
}

export function hashManagedDocument(content: string | null | undefined): string | null {
  const managed = extractManagedDocument(content);
  return managed ? createHash('sha256').update(managed).digest('hex') : null;
}

/**
 * A line that opens its own Markdown block, so a rewrapped paragraph is never
 * joined across it: headings, list items, quotes, table rows, rules and HTML.
 */
const BLOCK_START = /^\s*(?:#{1,6}[ \t]|[-*+][ \t]|\d+[.)][ \t]|>|\||<|-{3,}\s*$|\*{3,}\s*$|(?:```|~~~))/;

/** A line whose block is that one line, so the next line never joins onto it. */
const BLOCK_CLOSES = /^\s*(?:#{1,6}[ \t]|\||<|-{3,}\s*$|\*{3,}\s*$|(?:```|~~~))/;

/**
 * The same text with the differences a Markdown formatter makes flattened
 * away, for telling "the editor reformatted this on save" apart from "a person
 * edited this". Only shapes formatters converge on are touched, never words,
 * so two texts that normalise the same carry the same rules.
 *
 * Paragraphs are joined onto one line because a single newline inside a
 * paragraph is a space in Markdown, which is what lets `proseWrap: always`
 * refold every paragraph without changing what an agent reads. Fenced code is
 * left alone, where a newline does mean something.
 */
export function formatterNormalized(text: string): string {
  const lines = text
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/, '').replace(/^(\s*)[*+]([ \t]+)/, '$1-$2'));
  const out: Array<{ text: string; fenced: boolean }> = [];
  let fenced = false;
  for (const line of lines) {
    const opensFence = /^\s*(?:```|~~~)/.test(line);
    const inFence = fenced || opensFence;
    const joinable = !inFence && line.trim() !== '' && !BLOCK_START.test(line);
    const previous = out.at(-1);
    if (
      joinable &&
      previous !== undefined &&
      !previous.fenced &&
      previous.text.trim() !== '' &&
      !BLOCK_CLOSES.test(previous.text)
    ) {
      previous.text = `${previous.text} ${line.trim()}`;
    } else {
      out.push({ text: line, fenced: inFence });
    }
    if (opensFence) fenced = !fenced;
  }
  // Blank lines go last, after they have done their job of ending a paragraph.
  // How many sit between two blocks is the formatter's business, not a rule.
  return out
    .filter(entry => entry.fenced || entry.text.trim() !== '')
    .map(entry => entry.text)
    .join('\n')
    .trimEnd();
}

export interface UnstableLine {
  /** 1-based line number inside the text that was checked. */
  line: number;
  reason: string;
}

/**
 * Lines a Markdown formatter would rewrite.
 *
 * Editors that format on save rewrite the whole file, so a person who only
 * edits their own rules below the boundary still changes bytes inside the
 * managed area, and the changed bytes read as a conflict they did not cause.
 * Prettier turned `* **Project:**` into `- **Project:**` in one project this
 * way (2026-09-20 실측). Whatever agctx writes into a managed area therefore
 * has to already be in the shape formatters converge on.
 */
export function formatterUnstableLines(text: string): UnstableLine[] {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const found: UnstableLine[] = [];
  let fenced = false;
  lines.forEach((line, index) => {
    if (/^\s*(?:```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) return;
    const at = index + 1;
    const next = lines[index + 1];
    if (/^\s*[*+][ \t]+\S/.test(line)) found.push({ line: at, reason: 'bullet marker is not -' });
    if (/[ \t]$/.test(line)) found.push({ line: at, reason: 'trailing whitespace' });
    if (/^#{1,6}[ \t]/.test(line) && next !== undefined && next.trim() !== '')
      found.push({ line: at, reason: 'no blank line after heading' });
    if (line === '' && index > 0 && lines[index - 1] === '')
      found.push({ line: at, reason: 'consecutive blank lines' });
  });
  return found;
}
