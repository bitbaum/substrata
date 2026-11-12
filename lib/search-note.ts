/**
 * A run's search note: what the search backends did, in ai-kit's own words
 * (`describeAttempts`: "searxng unreachable; brave 6"). The sweep and producer
 * sourcing keep one per run (scripts/db/018-search-notes.sql) and
 * /data/freshness shows it beside a failing feed, so "no search reached a
 * backend" comes with which backend and how.
 */
import { describeAttempts, type WebSearchResult } from '@bitbaum/ai-kit/web';

export type SearchReport = Pick<WebSearchResult, 'status' | 'attempts'>;

/** The note for one search: "searxng timeout", or "no backend" when none was tried. */
export function searchNote(result: SearchReport): string {
  return (describeAttempts(result.attempts) || 'no backend').slice(0, 300);
}

const RANK: Record<WebSearchResult['status'], number> = { found: 0, nothing: 1, could_not_look: 2 };

/**
 * Collects the notes of a run's searches and keeps the one that explains the
 * most: the latest search that could not look, else the latest that found
 * nothing, else the latest that found pages.
 */
export function searchNotes() {
  let kept: { rank: number; note: string } | null = null;
  return {
    add(result: SearchReport) {
      const rank = RANK[result.status];
      if (!kept || rank >= kept.rank) kept = { rank, note: searchNote(result) };
    },
    get note(): string | null {
      return kept?.note ?? null;
    },
  };
}
