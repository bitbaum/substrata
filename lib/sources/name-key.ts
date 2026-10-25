/**
 * The one name normaliser for matching organisations across sources. Kept in
 * its own module so code below the entity registry (the universe, which the
 * registry builds from) can use it without importing the registry.
 */
const LEGAL_SUFFIX =
  /\b(?:corp|corporation|inc|incorporated|jsc|llp|llc|ltd|limited|ag|plc|sa|nv|pte|pty|gmbh|co|holding|holdings)\b\.?/gi;

/** Lower case, legal suffixes and punctuation dropped: "Cameco Corp." → "cameco". */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[“”"«»]/g, '')
    .replace(LEGAL_SUFFIX, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
