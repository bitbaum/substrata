/**
 * Site search: one index over everything a reader can land on, ranked for a
 * person typing into a box rather than for a model assembling context.
 *
 * `lib/research-index.ts` is the retrieval projection the assistant uses, and
 * its scoring is tuned for that (OR over a question's meaningful words). This
 * module reads the same entity registry — so search can never know about a
 * thing the profile pages do not — and adds the three kinds of record that are
 * not entities but that a reader searches for all the same: accepted events,
 * evidence-engine candidates and glossary terms.
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
import { GLOSSARY } from '@/config/substrata-glossary';
import { EVENTS, EVENT_EFFECT_LABEL, EVENT_KIND_LABEL } from '@/config/substrata-events';
import { EVIDENCE } from '@/config/substrata-evidence';
import { allEntities } from './entities/registry';
import type { EntityKind } from './entities/types';
import { bottleneckHref, glossaryHref } from './links';
import { allLearn, allNotes, type Note } from './notes';
import {
  SEARCH_TYPES,
  type SearchGroup,
  type SearchHit,
  type SearchResult,
  type SearchType,
  type Segment,
} from './search-types';

export * from './search-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const KIND_TO_TYPE: Record<EntityKind, SearchType> = {
  bottleneck: 'bottleneck',
  company: 'company',
  science: 'science',
  policy: 'policy',
  country: 'country',
  capital: 'capital',
  loop: 'loop',
  facility: 'facility',
  talent: 'talent',
  learn: 'note',
  article: 'note',
};

export interface SearchDoc {
  id: string;
  type: SearchType;
  title: string;
  aka: string[];
  /** One line shown under the title when no better passage matched. */
  summary: string;
  /** Everything else worth matching. Never shown whole. */
  body: string;
  href: string;
  /** Short context for the kicker: an evidence state, a date. */
  meta: string;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const WORD_RE = /[\p{L}\p{N}]+/gu;

/** Lowercase and strip diacritics, so "Zürich" and "zurich" are one word. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

/** Same narrow plural rule as `research-index.ts`: "wafers" → "wafer", "glass" stays. */
function fold(word: string): string {
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

function words(text: string): string[] {
  return (normalize(text).match(WORD_RE) ?? []).map(fold);
}

const STOP = new Set([
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

// ---------------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------------

/** Plain text of a note's blocks, whatever their shape: every string that is not a type tag. */
function noteText(note: Note): string {
  const out: string[] = [];
  const walk = (value: unknown, key = ''): void => {
    if (typeof value === 'string') {
      if (key !== 'type' && key !== 'href' && key !== 'src') out.push(value);
    } else if (Array.isArray(value)) value.forEach((v) => walk(v));
    else if (value && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) walk(v, k);
  };
  walk(note.blocks);
  return out.join(' ');
}

function noteBodies(): Map<string, string> {
  const bodies = new Map<string, string>();
  for (const n of allNotes()) bodies.set(`article:${n.slug}`, noteText(n));
  for (const n of allLearn()) bodies.set(`learn:${n.slug}`, noteText(n));
  return bodies;
}

/**
 * Source URLs are in the retrieval text for the assistant's benefit; to a
 * search they are noise ("asml" matched inside "www.asml.com", and every
 * document gained the words "https" and "com").
 */
function withoutUrls(text: string): string {
  return text.replace(/\bhttps?:\/\/\S+/g, '').replace(/\s+\(\s*\)/g, '');
}

export function searchDocuments(): SearchDoc[] {
  const bodies = noteBodies();
  const entities: SearchDoc[] = allEntities().map((e) => ({
    id: e.id,
    type: KIND_TO_TYPE[e.kind],
    title: e.name,
    // A country's ISO code is an alias, and "cn" or "us" are real searches.
    aka: e.aka,
    summary: e.summary,
    body: withoutUrls(`${e.retrievalText} ${e.topics.join(' ')} ${bodies.get(e.id) ?? ''}`),
    href: e.href,
    meta: e.evidence,
  }));

  const events: SearchDoc[] = EVENTS.map((ev) => ({
    id: `event:${ev.id}`,
    type: 'event' as const,
    title: ev.headline,
    aka: [],
    summary: ev.quote,
    body: [
      ev.bottlenecks.join(' '),
      ev.participants.join(' '),
      ev.jurisdictions.join(' '),
      EVENT_KIND_LABEL[ev.kind],
      EVENT_EFFECT_LABEL[ev.effect],
    ].join(' '),
    href: `/events#${ev.id}`,
    meta: `${ev.date} · ${EVENT_EFFECT_LABEL[ev.effect]}`,
  }));

  const evidence: SearchDoc[] = EVIDENCE.rows
    .filter((row) => row.candidates.length > 0)
    .map((row) => ({
      id: `evidence:${row.material}:${row.producer}`,
      type: 'evidence' as const,
      title: `${row.producer} · ${row.material}`,
      aka: [],
      summary: row.candidates[0].excerpt,
      body: row.candidates.map((c) => `${c.title} ${c.excerpt}`).join(' '),
      href: bottleneckHref(row.material),
      meta: `${row.candidates.length} page${row.candidates.length === 1 ? '' : 's'} found, not yet read`,
    }));

  const glossary: SearchDoc[] = GLOSSARY.map((g) => ({
    id: `glossary:${g.term}`,
    type: 'glossary' as const,
    title: g.term,
    aka: [],
    summary: g.detail,
    body: g.seeAlso?.length ? `See also: ${g.seeAlso.join(', ')}.` : '',
    href: glossaryHref(g.term),
    meta: 'definition',
  }));

  return [...entities, ...events, ...evidence, ...glossary];
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

interface Indexed {
  doc: SearchDoc;
  name: Set<string>;
  nameLength: number;
  aka: Set<string>;
  /** Body word → occurrences, for a gentle term-frequency lift. */
  body: Map<string, number>;
  normTitle: string;
  normAka: string[];
  probeSummary: string;
  probeBody: string;
}

interface SearchIndex {
  docs: Indexed[];
  /** Word → how many documents contain it anywhere. */
  df: Map<string, number>;
  /** Every word, sorted, for prefix lookups by binary search. */
  vocab: string[];
}

function normPhrase(text: string): string {
  return words(text).join(' ');
}

function buildIndex(documents: SearchDoc[]): SearchIndex {
  const df = new Map<string, number>();
  const docs = documents.map((doc) => {
    const nameWords = words(doc.title);
    const name = new Set(nameWords);
    const aka = new Set(doc.aka.flatMap(words));
    const body = new Map<string, number>();
    for (const w of words(`${doc.summary} ${doc.body}`)) body.set(w, (body.get(w) ?? 0) + 1);
    for (const w of new Set([...name, ...aka, ...body.keys()])) df.set(w, (df.get(w) ?? 0) + 1);
    return {
      doc,
      name,
      nameLength: Math.max(nameWords.length, 1),
      aka,
      body,
      normTitle: nameWords.join(' '),
      normAka: doc.aka.map(normPhrase),
      probeSummary: probeOf(doc.summary),
      probeBody: probeOf(doc.body),
    };
  });
  return { docs, df, vocab: [...df.keys()].sort() };
}

let cached: SearchIndex | null = null;
function defaultIndex(): SearchIndex {
  if (!cached) cached = buildIndex(searchDocuments());
  return cached;
}

// ---------------------------------------------------------------------------
// Query expansion
// ---------------------------------------------------------------------------

const PREFIX = 0.7;

interface Expansion {
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

function expand(index: SearchIndex, token: string, last: boolean): Expansion[] {
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

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const NAME = 10;
const AKA = 7;
const BODY = 1.5;

/**
 * How much a type's match is worth, relative to an entity. Evidence rows are
 * named "<producer> · <material>", so they match both halves of most queries
 * and — unweighted — buried the bottleneck they are evidence FOR under seven
 * of its own candidate pages. They are the trail, not the destination.
 */
const TYPE_WEIGHT: Partial<Record<SearchType, number>> = {
  bottleneck: 1.1,
  glossary: 0.9,
  note: 0.9,
  capital: 0.9,
  facility: 0.9,
  loop: 0.9,
  talent: 0.9,
  event: 0.8,
  evidence: 0.55,
};

function idf(index: SearchIndex, word: string): number {
  return Math.log(1 + index.docs.length / (index.df.get(word) ?? 1));
}

interface Match {
  score: number;
  /** Words that matched, for highlighting. */
  words: string[];
  /** Query words matched in the name. */
  inName: number;
}

function scoreToken(index: SearchIndex, d: Indexed, expansions: Expansion[]) {
  let best = 0;
  let inName = false;
  const matched: string[] = [];
  for (const { word, weight = 0 } of expansions) {
    let field = 0;
    if (d.name.has(word)) field = NAME;
    else if (d.aka.has(word)) field = AKA;
    const tf = d.body.get(word) ?? 0;
    const body = tf ? BODY * (1 + Math.log(tf)) : 0;
    const s = (field + body) * weight;
    if (s > 0) matched.push(word);
    if (s > best) {
      best = s;
      inName = field === NAME;
    }
  }
  return { score: best, inName, matched };
}

function scoreDoc(
  index: SearchIndex,
  d: Indexed,
  tokens: Expansion[][],
  phrase: string,
  requireAll: boolean,
): Match | null {
  let score = 0;
  let inName = 0;
  let hitCount = 0;
  const matched: string[] = [];
  for (const expansions of tokens) {
    const t = scoreToken(index, d, expansions);
    if (t.score === 0) {
      if (requireAll) return null;
      continue;
    }
    hitCount++;
    score += t.score;
    if (t.inName) inName++;
    matched.push(...t.matched);
  }
  if (!hitCount) return null;
  // Phrase-level signals: the whole query IS the name, starts it, or sits in it.
  if (phrase) {
    if (d.normTitle === phrase) score += 40;
    else if (d.normAka.includes(phrase)) score += 30;
    else if (d.normTitle.startsWith(`${phrase} `)) score += 12;
    else if (` ${d.normTitle} `.includes(` ${phrase} `)) score += 6;
  }
  // Every word in the name, and a name that is mostly those words, reads as "this is it".
  if (inName === tokens.length) score += 8;
  score += (inName / d.nameLength) * 3;
  // A partial match is ranked by how much of the query it covers first.
  if (!requireAll) score *= hitCount / tokens.length;
  score *= TYPE_WEIGHT[d.doc.type] ?? 1;
  return { score, words: matched, inName };
}

// ---------------------------------------------------------------------------
// Snippets
// ---------------------------------------------------------------------------

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The words to mark, as a regex over the ORIGINAL text. Matching runs on
 * folded words, so a match on "wafer" should also mark "wafers".
 */
function markPattern(matched: string[]): RegExp | null {
  const unique = [...new Set(matched)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!unique.length) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(${unique.map(escapeRe).join('|')})(?:e?s)?(?![\\p{L}\\p{N}])`,
    'giu',
  );
}

/**
 * The copy of a text the mark pattern runs over. Diacritic-stripping keeps
 * string length for the Latin text this corpus holds, but not always; the
 * normalized copy is used only when offsets still line up with the original.
 */
function probeOf(text: string): string {
  const probe = normalize(text);
  return probe.length === text.length ? probe : text.toLowerCase();
}

function segments(text: string, re: RegExp | null, source = probeOf(text)): Segment[] {
  if (!re || !text) return text ? [{ text }] : [];
  const out: Segment[] = [];
  let at = 0;
  re.lastIndex = 0;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index) });
    out.push({ text: text.slice(m.index, m.index + m[0].length), hit: true });
    at = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

const SNIPPET = 190;

/** A window of the summary or body around the first marked word. */
function snippet(d: Indexed, re: RegExp | null, titleMatched: boolean): Segment[] {
  const { doc } = d;
  // When the name already shows why this matched, the plain description is
  // worth more than a passage of body text that happens to repeat the name.
  const candidates: [string, string][] = titleMatched
    ? [[doc.summary, d.probeSummary]]
    : [
        [doc.summary, d.probeSummary],
        [doc.body, d.probeBody],
      ];
  for (const [text, probe] of candidates) {
    if (!re || !text) continue;
    re.lastIndex = 0;
    const m = re.exec(probe);
    if (!m) continue;
    if (text.length <= SNIPPET) return segments(text, re, probe);
    let start = Math.max(0, m.index - 60);
    if (start > 0) {
      const space = text.indexOf(' ', start);
      start = space > -1 && space < m.index ? space + 1 : start;
    }
    let end = Math.min(text.length, start + SNIPPET);
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end);
      if (space > m.index) end = space;
    }
    const cut = segments(text.slice(start, end), re, probe.slice(start, end));
    if (start > 0) cut.unshift({ text: '…' });
    if (end < text.length) cut.push({ text: '…' });
    return cut;
  }
  const text = doc.summary || doc.body;
  return [
    { text: text.length > SNIPPET ? `${text.slice(0, SNIPPET).replace(/\s+\S*$/, '')}…` : text },
  ];
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

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
