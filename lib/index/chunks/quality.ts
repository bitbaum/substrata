/**
 * Facet `quality`: each row a data-quality check reports, as a finding. A
 * finding is retrievable — "what is missing on Niger" should reach it — and
 * is not meant to lead: its evidence is `finding`, its significance is low,
 * the retriever gives it no recency (its date is the run's, not a fact's), and
 * the planner (PR 6) will refuse to be confident on one.
 *
 * In-process this reads the pure checks only; the stored network and database
 * verdicts reach the index with the store (PR 4).
 */
import { allEntities } from '../../entities/registry';
import { pureResults } from '../../quality/pure';
import { chunkId, makeChunk, type Chunk } from '../chunk';

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function qualityChunks(now = new Date()): Chunk[] {
  const byHref = new Map(allEntities().map((e) => [e.href, e.id]));
  const seen = new Map<string, number>();
  const day = now.toISOString().slice(0, 10);
  return pureResults(now).flatMap((result) =>
    result.failures.map((failure) => {
      const key = `${result.check}/${slug(failure.row)}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      const about = failure.page ? byHref.get(failure.page) : undefined;
      return makeChunk({
        id: chunkId('quality', key, n),
        facet: 'quality',
        entityIds: about ? [about] : [],
        title: `${result.dataset}/${result.criterion}: ${failure.row}`,
        text: `${result.check} (${result.label}): ${failure.row} — ${failure.problem}`,
        href: failure.page ?? '/data/quality',
        ...(failure.link ? { sourceUrl: failure.link } : {}),
        evidence: 'finding',
        asOf: result.asOf ?? day,
        significance: 0.3,
      });
    }),
  );
}
