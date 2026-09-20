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
 * Source files that no pin covers, directly or through a pinned folder.
 * Paths use `/` and are relative to the repository root.
 */
export function unpinnedSources(sourceFiles: readonly string[], pins: readonly string[]): string[] {
  const covering = pins.map(trimSlash).filter(pin => !SOURCE_ROOTS.includes(pin));
  return sourceFiles.filter(file => !covering.some(pin => file === pin || file.startsWith(`${pin}/`)));
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
