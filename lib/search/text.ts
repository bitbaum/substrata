/**
 * Search text handling: how a string becomes the words the index and the
 * query agree on (normalized, diacritic-free, narrowly singularized).
 */

const WORD_RE = /[\p{L}\p{N}]+/gu;

/** Lowercase and strip diacritics, so "Zürich" and "zurich" are one word. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

/** Same narrow plural rule as `research-index.ts`: "wafers" → "wafer", "glass" stays. */
export function fold(word: string): string {
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

export function words(text: string): string[] {
  return (normalize(text).match(WORD_RE) ?? []).map(fold);
}

export const STOP = new Set([
  'a',
  'an',
  'and',
  'are',
  'for',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'what',
  'which',
  'who',
  'with',
]);
