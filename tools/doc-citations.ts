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
  /** Digest recorded beside the citation, or null when it carries none yet. */
  digest: string | null;
}

/** `path/to/file.ts`의 `name`, with more names joined by `·`, `,`, `와` or `과`, each carrying its digest marker. */
const NAMED_CITATION = /`([\w./-]+\.[A-Za-z0-9]+)`의((?:\s*`[A-Za-z_$][\w$]*`(?:<!--\s*s:[0-9a-f]{12}\s*-->)?\s*[·,]?\s*(?:와|과)?)+)/g;
const NAME = /`([A-Za-z_$][\w$]*)`(?:<!--\s*s:([0-9a-f]{12})\s*-->)?/g;

export function namedCitations(text: string): NamedCitation[] {
  return [...text.matchAll(NAMED_CITATION)]
    .filter(match => repoFile(match[1]))
    .flatMap(match => [...match[2].matchAll(NAME)].map(name => ({ file: match[1], name: name[1], digest: name[2] ?? null })));
}

/** The digest of what a citation points at, or null when that kind of target carries no digest. */
export type DigestLookup = (file: string, name: string) => string | null;

function rewriteNames(names: string, file: string, digestFor: DigestLookup): string {
  return names.replace(NAME, (whole, name: string) => {
    const digest = digestFor(file, name);
    return digest ? `\`${name}\`<!--s:${digest}-->` : `\`${name}\``;
  });
}

/** The document with every citation marker written or refreshed, leaving fenced code blocks alone. */
export function applyCitationMarkers(text: string, digestFor: DigestLookup): string {
  return text
    .split(/(```[\s\S]*?```)/g)
    .map(part => part.startsWith('```')
      ? part
      : part.replace(NAMED_CITATION, (whole, file: string, names: string) =>
        repoFile(file) ? `\`${file}\`의${rewriteNames(names, file, digestFor)}` : whole))
    .join('');
}

/** Citations whose marker is missing or no longer matches what they point at. */
export function citationMarkerProblems(text: string, digestFor: DigestLookup): string[] {
  return namedCitations(text).flatMap(({ file, name, digest }) => {
    const current = digestFor(file, name);
    if (!current) return [];
    if (!digest) return [`${file}의 ${name}: 지문이 없다`];
    return digest === current ? [] : [`${file}의 ${name}: 가리킨 코드가 바뀌었다`];
  });
}
