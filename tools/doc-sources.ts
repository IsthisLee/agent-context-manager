/**
 * Rules for which sources documents pin. Pinning a whole source root makes one
 * change fail every document at once, so readers stamp without re-reading; a
 * source no document pins can change without any document noticing.
 */

/** Source roots a document must pin module by module, never as a whole. */
export const SOURCE_ROOTS: readonly string[] = ['src'];

const trimSlash = (value: string) => value.replace(/\/+$/, '');

/** Pins that name a whole source root instead of the modules inside it. */
export function wholeRootPins(sources: readonly string[]): string[] {
  return sources.filter(source => SOURCE_ROOTS.includes(trimSlash(source)));
}

/**
 * Source files that nothing covers. A file is covered when a document pins it,
 * directly or through a pinned folder, or when a document cites a name inside
 * it: a citation carries the same digest and fails the same way, so the pin
 * would only repeat it. Paths use `/` and are relative to the repository root.
 */
export function unpinnedSources(sourceFiles: readonly string[], pins: readonly string[], citedFiles: readonly string[] = []): string[] {
  const covering = pins.map(trimSlash).filter(pin => !SOURCE_ROOTS.includes(pin));
  const cited = new Set(citedFiles);
  return sourceFiles.filter(file => !cited.has(file) && !covering.some(pin => file === pin || file.startsWith(`${pin}/`)));
}

/** The recorded-hash marker line of a document that pins sources. */
const RECORDED_HASH = /<!--\s*agctx-doc-sources-sha256:\s*(?:[0-9a-f]{64}|PENDING)\s*-->/;

/**
 * A pinned document as the gate hashes it: its own recorded hash is left out, so
 * restamping it does not change the hash of a document that pins it, and two
 * documents such as the README translations can pin each other.
 */
export function withoutRecordedHash(text: string): string {
  return text.replace(RECORDED_HASH, '<!-- agctx-doc-sources-sha256 -->');
}

/** A block between `<!-- agctx:generated:<name>:start -->` and its end marker, markers included. */
const GENERATED_BLOCK = /(<!-- agctx:generated:(\S+):start -->)[\s\S]*?(<!-- agctx:generated:\2:end -->)/g;

/**
 * A pinned document as the gate hashes it, without the contents of its
 * generated blocks. Evaluations already compare those blocks with their data,
 * so regenerating the status list in one README does not fail the README that
 * pins it.
 */
export function withoutGeneratedBlocks(text: string): string {
  return text.replace(GENERATED_BLOCK, '$1\n$3');
}

/** A pinned section: the marker pair plus the text it owns, which runs to the next marker. */
export interface DocSourceSection {
  sources: string[];
  /** Recorded digest, `PENDING`, or null when the hash line is missing. */
  digest: string | null;
  /** Heading the marker sits under, for a failure message that names the place to re-read. */
  heading: string;
  /** Index of the list marker in the document, so a stamp can replace the right hash line. */
  index: number;
}

const SOURCES_LIST = /<!--\s*agctx-doc-sources:\s*([^\n]+?)\s*-->/g;
const SOURCES_HASH = /<!--\s*agctx-doc-sources-sha256:\s*([0-9a-f]{64}|PENDING)\s*-->/;

/**
 * Every pinned section of a document, in order. A document may carry one marker
 * at the top, as most do, or one marker per section so that a changed source
 * points at the section to re-read instead of the whole document.
 */
export function docSourceSections(content: string): DocSourceSection[] {
  const markers = [...content.matchAll(SOURCES_LIST)];
  return markers.map((marker, order) => {
    const from = marker.index ?? 0;
    const to = order + 1 < markers.length ? markers[order + 1].index ?? content.length : content.length;
    const hash = content.slice(from, to).match(SOURCES_HASH);
    const headings = [...content.slice(0, from).matchAll(/^#{1,6}\s+(.+)$/gm)];
    return {
      sources: marker[1].split(',').map(source => source.trim()).filter(Boolean),
      digest: hash ? hash[1] : null,
      heading: headings.length ? headings[headings.length - 1][1].trim() : '',
      index: from
    };
  });
}

/** The digests a stamp writes: a section's recorded hash and the marker beside a cited name. */
const DIGEST_IN_LINE = /(agctx-doc-sources-sha256:\s*)(?:[0-9a-f]{64}|PENDING)|<!--\s*s:[0-9a-f]{12}\s*-->/g;

/** The same line with every digest blanked, so two lines that differ only in a digest compare equal. */
function withoutDigests(line: string): string {
  return line.replace(DIGEST_IN_LINE, (_whole, prefix: string | undefined) => (prefix ? `${prefix}<digest>` : '<digest>'));
}

/**
 * Markdown documents in a diff whose only change is a digest a stamp writes.
 *
 * Re-reading the document is the point of the gate, and `--stamp` passes without it, so a commit
 * that carries nothing but new digests is the shape of a document nobody re-read. Judged from the
 * diff alone: both sides are compared with their digests blanked, so a document that also gained,
 * lost, or reworded a line is left out. PR #54 is the case this catches, where a README kept the
 * sentence "6개 항목" while its hash moved on.
 */
export function restampOnlyDocuments(diff: string): string[] {
  const found: string[] = [];
  let file: string | null = null;
  let removed: string[] = [];
  let added: string[] = [];
  const settle = () => {
    const bare = file !== null && removed.length > 0 && removed.length === added.length
      && removed.every((line, index) => withoutDigests(line) === withoutDigests(added[index]))
      && removed.some((line, index) => line !== added[index]);
    if (bare && file !== null) found.push(file);
    file = null;
    removed = [];
    added = [];
  };
  for (const line of diff.split('\n')) {
    const header = line.match(/^diff --git a\/(\S+) b\/(\S+)$/);
    if (header) {
      settle();
      file = header[2].endsWith('.md') ? header[2] : null;
      continue;
    }
    if (file === null) continue;
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) continue;
    if (line.startsWith('-')) removed.push(line.slice(1));
    else if (line.startsWith('+')) added.push(line.slice(1));
  }
  settle();
  return found;
}

/**
 * The pinned sources among the files a checkout changed, so a failure names what to re-read
 * instead of repeating the whole pin list. A pinned folder covers every file beneath it.
 */
export function sourcesToReread(pinned: readonly string[], changed: readonly string[]): string[] {
  const pins = pinned.map(trimSlash);
  return changed.filter(file => pins.some(pin => file === pin || file.startsWith(`${pin}/`)));
}

/** What `--stamp` was asked to rewrite: every document, named ones, or nothing until one is named. */
export type StampTargets = { kind: 'all' } | { kind: 'ask' } | { kind: 'paths'; paths: string[] };

/**
 * Read `--stamp` and what follows it. Naming a document is the approval unit: one `--stamp` used to
 * rewrite every drifted document at once, so reading one and running it passed the rest as well.
 */
export function stampTargets(argv: readonly string[]): StampTargets {
  const at = argv.indexOf('--stamp');
  if (at === -1) return { kind: 'ask' };
  const rest = argv.slice(at + 1).filter(value => value !== '--');
  if (rest.includes('--all')) return { kind: 'all' };
  const paths = rest.filter(value => !value.startsWith('-')).map(value => value.replace(/^\.\//, ''));
  return paths.length ? { kind: 'paths', paths } : { kind: 'ask' };
}
