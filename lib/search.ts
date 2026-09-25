/**
 * Site search: one index over everything a reader can land on, ranked for a
 * person typing into a box rather than for a model assembling context.
 *
 * `lib/research-index.ts` is the retrieval projection the assistant uses, and
 * its scoring is tuned for that (OR over a question's meaningful words). This
 * module reads the same entity registry — so search can never know about a
 * thing the profile pages do not — and adds the two kinds of record that are
 * not entities but that a reader searches for all the same: accepted events
 * and glossary terms.
 *
 * Ranking, in order of weight:
 *   1. the name (an exact name match beats everything),
 *   2. other spellings (`aka`),
 *   3. the body (summary, long text, topic tags), with term frequency.
 * Each query word may match exactly, as a prefix (so results appear while the
 * reader is still typing) or — only when the word does not exist anywhere in
 * the corpus — within one or two edits, which is what turns "photresist" into
 * "photoresist" instead of into nothing.
 *
 * The index is derived from static config and built once per process.
 */
import { defaultIndex, buildIndex, type Indexed } from './search/build';
import type { SearchDoc } from './search/corpus';
import { PREFIX, expand } from './search/expand';
import { idf, scoreDoc, type Match } from './search/score';
import { markPattern, segments, snippet } from './search/snippets';
import { STOP, words } from './search/text';
import {
  SEARCH_TYPES,
  type SearchGroup,
  type SearchHit,
  type SearchResult,
  type SearchType,
  type Segment,
} from './search-types';

export * from './search-types';
export { searchDocuments, type SearchDoc } from './search/corpus';

export interface SearchOptions {
  type?: SearchType | null;
  /** Cap on `hits`. */
  limit?: number;
  /** Cap on hits inside each group. */
  perGroup?: number;
  /** Search a given corpus instead of the site's, for tests. */
  documents?: SearchDoc[];
}

export function search(rawQuery: string, options: SearchOptions = {}): SearchResult {
  const query = rawQuery.trim().slice(0, 200);
  const empty: SearchResult = {
    query,
    corrected: null,
    partial: false,
    total: 0,
    counts: {},
    hits: [],
    groups: [],
  };
  const index = options.documents ? buildIndex(options.documents) : defaultIndex();
  let tokens = words(query);
  if (tokens.length > 1) {
    const content = tokens.filter((t) => !STOP.has(t));
    if (content.length) tokens = content;
  }
  tokens = [...new Set(tokens)];
  if (!tokens.length) return empty;

  // The last word keeps its prefix power only when the query does not end in
  // a space, which is how a reader says "that word is finished".
  const typing = !/\s$/.test(rawQuery);
  const expansions = tokens.map((t, i) => {
    const found = expand(index, t, typing && i === tokens.length - 1);
    // A half-typed word is weighted as its COMMONEST completion, not each
    // completion by its own rarity: otherwise "gallium ch" ranks the rare
    // "Chalco" above the obvious "China" just because fewer documents say it.
    const prefixIdf = Math.min(
      ...found.filter((e) => e.quality === PREFIX).map((e) => idf(index, e.word)),
    );
    return found.map((e) => ({
      ...e,
      weight: e.quality * (e.quality === PREFIX ? prefixIdf : idf(index, e.word)),
    }));
  });
  const corrections = new Map<string, string>();
  tokens.forEach((t, i) => {
    const e = expansions[i];
    if (e.length && e.every((x) => x.quality < 0.7)) {
      const best = e.reduce((a, b) =>
        b.quality > a.quality ||
        (b.quality === a.quality && (index.df.get(b.word) ?? 0) > (index.df.get(a.word) ?? 0))
          ? b
          : a,
      );
      corrections.set(t, best.word);
    }
  });
  const phrase = tokens.map((t) => corrections.get(t) ?? t).join(' ');

  const run = (requireAll: boolean) =>
    index.docs
      .map((d) => ({ d, m: scoreDoc(index, d, expansions, phrase, requireAll) }))
      .filter((x): x is { d: Indexed; m: Match } => x.m !== null)
      .sort(
        (a, b) =>
          b.m.score - a.m.score ||
          SEARCH_TYPES.indexOf(a.d.doc.type) - SEARCH_TYPES.indexOf(b.d.doc.type) ||
          a.d.doc.title.localeCompare(b.d.doc.title),
      );

  let ranked = run(true);
  let partial = false;
  if (!ranked.length && expansions.filter((e) => e.length).length > 0 && tokens.length > 1) {
    ranked = run(false);
    partial = ranked.length > 0;
  }
  if (!ranked.length) return { ...empty, corrected: corrections.size ? phrase : null };

  const toHit = ({ d, m }: { d: Indexed; m: Match }): SearchHit => {
    const re = markPattern(m.words);
    const title = segments(d.doc.title, re);
    return {
      id: d.doc.id,
      type: d.doc.type,
      title,
      snippet: snippet(
        d,
        re,
        title.some((s) => s.hit),
      ),
      href: d.doc.href,
      meta: d.doc.meta,
      score: Math.round(m.score * 100) / 100,
    };
  };

  const counts: Partial<Record<SearchType, number>> = {};
  const byType = new Map<SearchType, typeof ranked>();
  for (const r of ranked) {
    counts[r.d.doc.type] = (counts[r.d.doc.type] ?? 0) + 1;
    const list = byType.get(r.d.doc.type);
    if (list) list.push(r);
    else byType.set(r.d.doc.type, [r]);
  }
  const perGroup = options.perGroup ?? 5;
  const groups: SearchGroup[] = [...byType.entries()].map(([type, rows]) => ({
    type,
    count: rows.length,
    hits: rows.slice(0, perGroup).map(toHit),
  }));

  const narrowed = options.type ? (byType.get(options.type) ?? []) : ranked;
  return {
    query,
    corrected: corrections.size ? phrase : null,
    partial,
    total: ranked.length,
    counts,
    hits: narrowed.slice(0, options.limit ?? 50).map(toHit),
    groups,
  };
}

/** Plain text of a segment list, for tests and for aria labels. */
export function plain(segments: Segment[]): string {
  return segments.map((s) => s.text).join('');
}
