/**
 * Every chunk the corpus projects to, built once per process (the corpus is
 * committed files; it cannot change under a running build).
 *
 * The producers are the only files under `lib/index/` that read config — this
 * file just asks each of them in turn — so the day the index leaves for
 * `@bitbaum/indexkit`, the producers stay here and everything else goes.
 */
import { FACETS, type Chunk, type Facet } from './chunk';
import { entityChunks } from './chunks/entity';
import { eventChunks } from './chunks/event';
import { policyChunks } from './chunks/policy';
import { qualityChunks } from './chunks/quality';
import { quantityChunks } from './chunks/quantity';
import { rankingChunks } from './chunks/ranking';
import { restrictionChunks } from './chunks/restriction';
import { scienceChunks } from './chunks/science';
import { seriesChunks } from './chunks/series';

/** One producer per facet; the record type makes a facet without one a build error. */
export const PRODUCERS: Record<Facet, () => Chunk[]> = {
  entity: entityChunks,
  event: () => eventChunks(),
  series: seriesChunks,
  policy: policyChunks,
  science: scienceChunks,
  restriction: restrictionChunks,
  quantity: quantityChunks,
  ranking: rankingChunks,
  quality: () => qualityChunks(),
};

let built: { day: string; chunks: Chunk[] } | null = null;

/**
 * The whole index, in facet order. Memoised per UTC day, like the quality
 * checks it includes: recency and the date-dependent checks move with the
 * calendar, nothing else can.
 */
export function buildChunks(now = new Date()): Chunk[] {
  const day = now.toISOString().slice(0, 10);
  if (built?.day === day) return built.chunks;
  const chunks: Chunk[] = [];
  const ids = new Set<string>();
  for (const facet of FACETS) {
    for (const chunk of PRODUCERS[facet]()) {
      // A duplicate id would make one row overwrite another in the store; fail loudly instead.
      if (ids.has(chunk.id)) throw new Error(`duplicate chunk id ${chunk.id}`);
      ids.add(chunk.id);
      chunks.push(chunk);
    }
  }
  built = { day, chunks };
  return chunks;
}

/** Chunks per facet, for a status line and the tests. */
export function chunkCounts(chunks: readonly Chunk[] = buildChunks()): Record<Facet, number> {
  const counts = Object.fromEntries(FACETS.map((f) => [f, 0])) as Record<Facet, number>;
  for (const chunk of chunks) counts[chunk.facet] += 1;
  return counts;
}
