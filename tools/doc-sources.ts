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
