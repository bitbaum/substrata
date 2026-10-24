/**
 * Filing the gap an answer ended on (rung 6 of the answer ladder,
 * docs/architecture/2026-10-24-research-systems.md §1 and §5).
 *
 * Every answer that names a missing link — "the buyers of Kazakhstan's uranium
 * output are not in our sources" — files it, so the order of research work
 * follows what people actually ask. This PR ships the seam and a no-op
 * default; storage belongs to the dossier system (`lib/dossier`), which
 * defines `recordDemand(entity, box, question)`.
 *
 * THE ONE PLACE TO BIND STORAGE: call `setGapFiler()` once at start-up (e.g.
 * from `instrumentation.ts` or `app/api/chat/route.ts`):
 *
 *   setGapFiler((g) => recordDemand(g.entity, g.box, g.question));
 *
 * Nothing else changes: the loop already calls `fileGap()`.
 */
import type { EntityId } from '../entities/types';

export interface GapReport {
  /** The reader's question, as asked. */
  question: string;
  /** The entity the missing link hangs on: `country:kz`, `company:asml`. */
  entity?: EntityId;
  /** The dossier box it would fill: see LADDER_BOXES in ladder.ts. */
  box?: string;
  /** Free tags for grouping: resource ids, iso codes, the box. */
  topics: string[];
}

export type GapFiler = (gap: GapReport) => void | Promise<void>;

const noop: GapFiler = () => {};
let filer: GapFiler = noop;

/** Bind real storage. Returns the previous filer, so a test can restore it. */
export function setGapFiler(next: GapFiler | undefined): GapFiler {
  const previous = filer;
  filer = next ?? noop;
  return previous;
}

/**
 * File one gap. Never throws and never delays the answer: a storage failure
 * loses one demand count, not the reader's answer.
 */
export async function fileGap(gap: GapReport, using: GapFiler = filer): Promise<void> {
  try {
    await using(gap);
  } catch {
    // A lost count is cheaper than a failed answer.
  }
}
