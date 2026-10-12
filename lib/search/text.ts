/**
 * Search text handling: how a string becomes the words the index and the
 * query agree on. Folding (case, accents, ß/æ/ø) is `@bitbaum/searchkit`'s;
 * what stays here is this corpus's own: the narrow plural rule and the stop
 * words.
 *
 * A word is a whole run of letters and digits. searchkit's `tokenize` also
 * splits camelCase, which turns "SiC", "GaN" and "InP" — real searches here —
 * into two words each, so the runs are taken whole.
 */
import { fold, type Range } from '@bitbaum/searchkit';

const WORD_RE = /[\p{L}\p{N}]+/gu;

/** Same narrow plural rule as `research-index.ts`: "wafers" → "wafer", "glass" stays. */
export function singular(word: string): string {
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

/** One word of a text, with where it sits in the ORIGINAL text, for marking. */
export interface Term extends Range {
  term: string;
}

export function terms(text: string): Term[] {
  return [...text.matchAll(WORD_RE)].map((m) => ({
    term: singular(fold(m[0])),
    start: m.index,
    end: m.index + m[0].length,
  }));
}

export function words(text: string): string[] {
  return terms(text).map((t) => t.term);
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
