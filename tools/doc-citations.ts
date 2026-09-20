/**
 * How a document points at code. Line numbers move whenever anything above
 * them changes, so a document names the file and the name inside it instead,
 * and `check:docs` verifies that the name is still there. The decision is in
 * docs/discussion/repository/topics/code-citation-style.md.
 */

/** Documents that record history keep the citations they were written with. */
const EXEMPT_PREFIXES: readonly string[] = ['docs/discussion/', 'docs/adr/'];
const EXEMPT_FILES: readonly string[] = ['CHANGELOG.md'];

export function citationExempt(relativePath: string): boolean {
  const posix = relativePath.replaceAll('\\', '/');
  return EXEMPT_PREFIXES.some(prefix => posix.startsWith(prefix)) || EXEMPT_FILES.includes(posix);
}

/** Folders and root files this repository owns; other paths belong to another tool or to a user project. */
const REPO_FOLDERS: readonly string[] = ['src/', 'tools/', 'evals/', 'templates/', 'skills/', '.agents/', '.github/', 'docs/'];
const REPO_FILES: readonly string[] = ['package.json', 'tsconfig.json', 'tsconfig.build.json', 'AGENTS.md', 'README.md', 'README.en.md', 'SECURITY.md', 'CHANGELOG.md'];

export function repoFile(citedPath: string): boolean {
  return REPO_FOLDERS.some(folder => citedPath.startsWith(folder)) || REPO_FILES.includes(citedPath);
}

/** `path/to/file.ts:12` or `path/to/file.ts:12-20` inside backticks. */
const LINE_CITATION = /`([\w./-]+\.[A-Za-z0-9]+:\d+(?:-\d+)?)`/g;

export function lineNumberCitations(text: string): string[] {
  return [...text.matchAll(LINE_CITATION)].map(match => match[1]).filter(citation => repoFile(citation.split(':')[0]));
}

export interface NamedCitation {
  file: string;
  name: string;
}

/** `path/to/file.ts`의 `name`, with more names joined by `·`, `,`, `와` or `과`. */
const NAMED_CITATION = /`([\w./-]+\.[A-Za-z0-9]+)`의((?:\s*`[A-Za-z_$][\w$]*`\s*[·,]?\s*(?:와|과)?)+)/g;
const NAME = /`([A-Za-z_$][\w$]*)`/g;

export function namedCitations(text: string): NamedCitation[] {
  return [...text.matchAll(NAMED_CITATION)]
    .filter(match => repoFile(match[1]))
    .flatMap(match => [...match[2].matchAll(NAME)].map(name => ({ file: match[1], name: name[1] })));
}
