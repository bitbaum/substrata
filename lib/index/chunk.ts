/**
 * The retrieval unit: one chunk of the corpus, derived from config, never the
 * other way round.
 *
 * The corpus in git stays the single source of truth; chunks are a projection
 * built on demand (and, in a later PR, upserted into `research_index` by
 * content hash). This file is the pure part — the shape, the id, the hash and
 * the splitter — and imports nothing from the app, so it can leave for
 * `@bitbaum/indexkit` without carrying Substrata's names with it.
 *
 * See docs/architecture/2026-10-23-knowledge-system.md, Part 1.
 */
import { createHash } from 'node:crypto';

/** Where a chunk came from: one producer per facet in `./chunks/<facet>.ts`. */
export const FACETS = [
  'entity',
  'event',
  'series',
  'policy',
  'science',
  'restriction',
  'quantity',
  'ranking',
  'quality',
] as const;

export type Facet = (typeof FACETS)[number];

/**
 * The closed evidence set the index speaks. It is deliberately smaller than
 * the corpus's free-text labels ("partly sourced; replaceability is a
 * judgement"): a model told seven words can be told what each one means. The
 * mapping from the corpus's own labels lives with the producers
 * (`./chunks/evidence.ts`), because they are the only files that read config.
 */
export const INDEX_EVIDENCE = [
  'sourced',
  'candidate',
  'unverified',
  'judgement',
  'computed',
  'directory',
  'finding',
] as const;

export type IndexEvidence = (typeof INDEX_EVIDENCE)[number];

/** What is embedded and shown to the model: long enough for a record, short enough to read. */
export const CHUNK_TEXT_MAX = 1200;

export interface Chunk {
  /** `<facet>:<row key>#<n>` — stable across builds while the row's key is. */
  id: string;
  facet: Facet;
  /** The entity kind of the primary entity, when the chunk has one. */
  kind?: string;
  /** Every entity id the chunk is about (`country:ne`, `bottleneck:gallium-refined`). */
  entityIds: string[];
  title: string;
  /** At most `CHUNK_TEXT_MAX` characters. */
  text: string;
  /** The site page to cite. */
  href: string;
  /** The primary source, when the row has one. */
  sourceUrl?: string;
  evidence: IndexEvidence;
  /** The date the fact is FOR: an ISO date, or a period such as `2025-Q2`. */
  asOf?: string;
  /** 0..1: how much the row matters, so a tie on words goes to the row that does. */
  significance: number;
  /** sha256 of text and tags; a later reindex re-embeds only when this changes. */
  contentHash: string;
}

export function chunkId(facet: Facet, key: string, n = 0): string {
  return `${facet}:${key}#${n}`;
}

/** The hash a reindex compares, so a chunk whose words did not change is not re-embedded. */
export function contentHash(text: string, tags: readonly string[] = []): string {
  return createHash('sha256').update(text).update('\n').update(tags.join(' ')).digest('hex');
}

/**
 * Split long text into pieces of at most `max` characters, preferring a
 * sentence end, then a word boundary, so no piece opens mid-word. The pieces
 * concatenate back to the original text (modulo the whitespace at the cut).
 */
export function splitText(text: string, max = CHUNK_TEXT_MAX): string[] {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return [];
  if (flat.length <= max) return [flat];
  const pieces: string[] = [];
  let rest = flat;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const sentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('; '));
    const word = window.lastIndexOf(' ');
    const cut = sentence > max / 2 ? sentence + 1 : word > 0 ? word : max;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/** Clamp into 0..1; a producer's arithmetic should never leak a share above one. */
export function unit(value: number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

/**
 * How recent a dated fact is, 0..1: a fact for the last quarter is 1, one two
 * years old is about 0.5, and it keeps tapering rather than falling to zero —
 * an old number is still a number. Periods (`2025`, `2025-Q2`, `2025-07`) are
 * read at their start.
 */
export function recency(asOf: string | undefined, now = new Date()): number {
  if (!asOf) return 0;
  const when = periodStart(asOf);
  if (when === null) return 0;
  const days = (now.getTime() - when) / 86_400_000;
  if (days <= 90) return 1;
  return 1 / (1 + (days - 90) / 640);
}

function periodStart(period: string): number | null {
  const q = period.match(/^(\d{4})-Q([1-4])$/);
  if (q) return Date.UTC(Number(q[1]), (Number(q[2]) - 1) * 3, 1);
  const m = period.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), m[2] ? Number(m[2]) - 1 : 0, m[3] ? Number(m[3]) : 1);
}

/** The chunk, with its hash filled in from its own text and tags. */
export function makeChunk(chunk: Omit<Chunk, 'contentHash'>): Chunk {
  const text =
    chunk.text.length > CHUNK_TEXT_MAX ? chunk.text.slice(0, CHUNK_TEXT_MAX) : chunk.text;
  return {
    ...chunk,
    text,
    significance: unit(chunk.significance),
    contentHash: contentHash(text, [chunk.facet, chunk.evidence, ...chunk.entityIds]),
  };
}
