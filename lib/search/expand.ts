/**
 * Query expansion: the corpus words a typed word could mean. Which words those
 * are — exact, the start of a longer word while typing, within the typo budget
 * by length (none under 4 letters, 1 from 4, 2 from 8; a swap is one) — is
 * `@bitbaum/searchkit`'s `candidates`. What stays here is how much each kind
 * is worth to the scorer, and two rules of this corpus.
 */
import { candidates, DEFAULT_TYPO_POLICY, type TypoPolicy } from '@bitbaum/searchkit';
import type { SearchIndex } from './build';
import { STOP } from './text';

export const PREFIX = 0.7;
/** Quality of a correction by its number of typos. */
const TYPO = [1, 0.6, 0.4];
const NO_TYPOS: TypoPolicy = { oneTypoFrom: Infinity, twoTyposFrom: Infinity };

export interface Expansion {
  word: string;
  /** 1 exact, less for a prefix or a correction. */
  quality: number;
  /** quality × idf, computed once per query rather than once per document. */
  weight?: number;
}

/**
 * Typo candidates are a scan of the whole vocabulary, so expansions are
 * memoised per index: a reader typing asks for the same words on every
 * keystroke.
 */
const memo = new WeakMap<SearchIndex, Map<string, Expansion[]>>();

export function expand(index: SearchIndex, token: string, last: boolean): Expansion[] {
  let seen = memo.get(index);
  if (!seen) memo.set(index, (seen = new Map()));
  const key = `${last ? '+' : '-'}${token}`;
  const hit = seen.get(key);
  if (hit) return hit;
  if (seen.size > 2000) seen.clear();
  const out = expandUncached(index, token, last);
  seen.set(key, out);
  return out;
}

function expandUncached(index: SearchIndex, token: string, last: boolean): Expansion[] {
  // A real word is never "corrected" into a neighbour ("neon" is not a slip
  // of "neo"); a word the corpus has only as the start of others still may
  // be ("canno" is Canon as much as "cannot"). A number never is: "2023" is
  // not "2024".
  const exact = index.vocab.counts.has(token) || /^\d+$/.test(token);
  const found = candidates(index.vocab, token, {
    // Prefixes: always for the word being typed, and for any word of 3+
    // letters ("transform" should find "transformer" whether or not it is last).
    prefix: last || token.length >= 3,
    policy: exact ? NO_TYPOS : DEFAULT_TYPO_POLICY,
    // The exact word and the 60 commonest completions.
    limit: 61,
  });
  return (
    found
      // A slip in the START of a longer word ("photres" → "photoresist") is
      // the word being typed; for a finished word it only drags in noise. And
      // nobody misspells a word to mean "are".
      .filter((c) => c.typos === 0 || ((last || !c.prefix) && !STOP.has(c.term)))
      .map((c) => ({
        word: c.term,
        quality: (c.prefix ? PREFIX : 1) * (TYPO[c.typos] ?? TYPO[2]),
      }))
  );
}
