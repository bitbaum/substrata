/**
 * Query expansion: each query word may match exactly, as a prefix (so results
 * appear while the reader is still typing) or — only when the word does not
 * exist anywhere in the corpus — within one or two edits.
 */
import type { SearchIndex } from './build';

export const PREFIX = 0.7;

export interface Expansion {
  word: string;
  /** 1 exact, less for a prefix or a correction. */
  quality: number;
  /** quality × idf, computed once per query rather than once per document. */
  weight?: number;
}

/** Optimal-string-alignment distance, bailing out once it cannot be ≤ max. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows.push([i]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, rows[i - 2][j - 2] + 1);
      rows[i][j] = v;
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
  }
  return rows[a.length][b.length];
}

function prefixWords(vocab: string[], prefix: string): string[] {
  let lo = 0,
    hi = vocab.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (vocab[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  const out: string[] = [];
  for (let i = lo; i < vocab.length && vocab[i].startsWith(prefix); i++) out.push(vocab[i]);
  return out;
}

export function expand(index: SearchIndex, token: string, last: boolean): Expansion[] {
  const out: Expansion[] = [];
  if (index.df.has(token)) out.push({ word: token, quality: 1 });
  // Prefixes: always for the word being typed, and for any word of 3+ letters
  // ("transform" should find "transformer" whether or not it is last).
  if (token.length >= (last ? 1 : 3)) {
    const more = prefixWords(index.vocab, token)
      .filter((w) => w !== token)
      .sort((a, b) => (index.df.get(b) ?? 0) - (index.df.get(a) ?? 0))
      .slice(0, 60);
    for (const word of more) out.push({ word, quality: PREFIX });
  }
  // Corrections only for a word the corpus does not contain at all, so a real
  // word is never "corrected" into a neighbour.
  if (!out.length && token.length >= 4 && !/^\d+$/.test(token))
    out.push(...corrections(index, token));
  return out;
}

/**
 * Words within one edit (two for long words) of a word the corpus lacks. A
 * scan of the whole vocabulary, so it is memoised per index: a reader typing
 * a misspelling asks for the same correction on every keystroke after it.
 */
const correctionCache = new WeakMap<SearchIndex, Map<string, Expansion[]>>();

function corrections(index: SearchIndex, token: string): Expansion[] {
  let memo = correctionCache.get(index);
  if (!memo) correctionCache.set(index, (memo = new Map()));
  const hit = memo.get(token);
  if (hit) return hit;
  const max = token.length >= 8 ? 2 : 1;
  const found: Expansion[] = [];
  for (const word of index.vocab) {
    if (word.length < 3 || Math.abs(word.length - token.length) > max) continue;
    const d = editDistance(token, word, max);
    if (d <= max) found.push({ word, quality: d === 1 ? 0.6 : 0.4 });
  }
  if (memo.size > 2000) memo.clear();
  memo.set(token, found);
  return found;
}
