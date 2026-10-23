/**
 * Retrieval over chunks: the ADR's hybrid score, in process.
 *
 *   score = 0.45·lexical + 0.35·cosine + 0.15·significance + 0.05·recency
 *
 * There are no vectors in process (they arrive with the store, PR 4), so the
 * lexical weight takes the cosine share: 0.80·lexical. Lexical is the corpus's
 * existing rarity-weighted whole-word match (`scoreDocuments`), normalised to
 * the best hit, so the in-process ranking is the database ranking minus
 * vectors and tests on a laptop with no DATABASE_URL rank the way the site does.
 *
 * `rank` is the generic part (chunks in, hits out) and reads no config; only
 * `retrieve` binds it to this corpus's chunks.
 */
import { foldedWords, scoreDocuments, type ResearchDocument } from '../research-index';
import { recency, type Chunk, type Facet } from './chunk';
import { buildChunks } from './build';

export const WEIGHTS = { lexical: 0.45, cosine: 0.35, significance: 0.15, recency: 0.05 } as const;

/**
 * A chunk that clears zero only through one near-ubiquitous word is shared
 * vocabulary, not a match (the same floor `lib/chat/retrieve.ts` uses), and is
 * dropped rather than ranked low: a low hit still reads as a citation.
 */
export const MIN_LEXICAL = 0.2;

/** Boost for a chunk about an entity the caller already knows the question is about. */
const HINT_BONUS = 0.25;

/**
 * Question words and category nouns: they carry a question's structure, not
 * its subject, and in a corpus of companies and materials every row could
 * claim them.
 */
const STOP = new Set(
  (
    'what which where when would could should about explain understand does have this that with they ' +
    'their there make makes the are and for how why who whom whose tell show give know known its was were ' +
    'any some many much more most main key major biggest best worst right now really actually actual ' +
    'company companies firm firms organisation organisations organization organizations is a an of in on ' +
    'to me my do did can from into over than then them these those be been being it as at by or if not'
  ).split(' '),
);

export interface RetrieveOptions {
  k?: number;
  /** Entity ids the question is already known to be about (the page, a resolved name). */
  entityHints?: readonly string[];
  /** Only these facets. */
  facets?: readonly Facet[];
  now?: Date;
}

export interface Hit {
  chunk: Chunk;
  score: number;
  /** The normalised lexical part, 0..1: relative to the best hit for this question. */
  lexical: number;
  /** The rarity-weighted word score before normalising: comparable across questions. */
  raw: number;
  /**
   * The share of the question's words the chunk contains, 0..1. A question
   * whose best hit holds one word in four ("a good recipe for banana bread"
   * meeting "the scarce good") is not about anything in the corpus, however
   * rare that one word is; this is what says so.
   */
  matched: number;
}

/**
 * The recency term. Two rules on top of `recency(asOf)`:
 * - an undated chunk is a maintained record (an entity, a series definition),
 *   read as current — it is what the corpus says today;
 * - a finding's date is the day the check ran, not the day a fact was true, so
 *   it earns no recency at all and cannot outrank the facts it is about on
 *   freshness alone.
 */
export function freshness(chunk: Pick<Chunk, 'asOf' | 'evidence'>, now = new Date()): number {
  if (chunk.evidence === 'finding') return 0;
  return chunk.asOf ? recency(chunk.asOf, now) : 1;
}

/** The words of a question that can discriminate between chunks. */
export function queryWords(question: string): string[] {
  const words = question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(words)].filter((w) => w.length > 1 && !STOP.has(w));
}

const documentsOf = new WeakMap<readonly Chunk[], ResearchDocument[]>();

function asDocuments(chunks: readonly Chunk[]): ResearchDocument[] {
  let docs = documentsOf.get(chunks);
  if (!docs) {
    docs = chunks.map((c) => ({
      id: c.id,
      kind: (c.kind ?? c.facet) as ResearchDocument['kind'],
      title: c.title,
      href: c.href,
      text: c.text,
      sources: c.sourceUrl ? [c.sourceUrl] : [],
      evidence: c.evidence,
      topics: [c.facet],
    }));
    documentsOf.set(chunks, docs);
  }
  return docs;
}

/** Rank `chunks` against a question. Pure: no config, no network. */
export function rank(
  chunks: readonly Chunk[],
  question: string,
  opts: RetrieveOptions = {},
): Hit[] {
  const k = opts.k ?? 8;
  const now = opts.now ?? new Date();
  const hints = new Set(opts.entityHints ?? []);
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const words = queryWords(question);
  const wanted = [...foldedWords(words.join(' '))];
  const scored = scoreDocuments(asDocuments(chunks), words).filter((s) => s.score >= MIN_LEXICAL);
  const best = Math.max(0, ...scored.map((s) => s.score));
  const lexicalWeight = WEIGHTS.lexical + WEIGHTS.cosine;
  const hits: Hit[] = [];
  for (const { document, score } of scored) {
    const chunk = byId.get(document.id)!;
    if (opts.facets && !opts.facets.includes(chunk.facet)) continue;
    const lexical = best > 0 ? score / best : 0;
    const hinted = chunk.entityIds.some((id) => hints.has(id)) ? HINT_BONUS : 0;
    hits.push({
      chunk,
      lexical,
      raw: score,
      matched: 0,
      score:
        lexicalWeight * lexical +
        WEIGHTS.significance * chunk.significance +
        WEIGHTS.recency * freshness(chunk, now) +
        hinted,
    });
  }
  const top = hits
    .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
    .slice(0, k);
  // Only the hits returned are re-read for coverage: k chunks, not the corpus.
  for (const hit of top) {
    const have = foldedWords(`${hit.chunk.title} ${hit.chunk.text} ${hit.chunk.facet}`);
    hit.matched = wanted.length ? wanted.filter((w) => have.has(w)).length / wanted.length : 0;
  }
  return top;
}

/** The corpus's chunks, ranked against a question. */
export function retrieve(question: string, opts: RetrieveOptions = {}): Hit[] {
  return rank(buildChunks(opts.now), question, opts);
}
