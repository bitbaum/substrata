/**
 * The reviewer's side of the sweep: the open queue and the verdicts on it.
 * Reading leads for a desk or for Ask is `sweep-queue.ts`.
 */
import { database } from './db';
import { expiredLeadSql, openLeadSql } from './lead-expiry';

export interface QueuedCandidate {
  id: string;
  bottleneck: string;
  term: string;
  url: string;
  title: string;
  published: string | null;
  excerpt: string;
  effectGuess: string;
  foundAt: string;
}

/**
 * The leads a reviewer has not yet decided on.
 *
 * Newest first, because a sweep that has just run is the reason someone opens
 * this page. Reviewed rows stay in the table as the record of a decision —
 * re-finding a URL must never resurrect something already rejected — but they
 * are not work, so they are not listed. Nor are expired leads (see
 * `lead-expiry.ts`): nobody decided on them in time, and they are listed by
 * `expiredCandidates` instead.
 */
export async function openCandidates(limit = 100): Promise<QueuedCandidate[]> {
  return candidates(openLeadSql(), limit);
}

/**
 * Leads nobody decided on within LEAD_EXPIRY_DAYS, newest first. They are
 * still in the table — expiry is a reading, not a deletion — so they can be
 * read — and still decided on, since a verdict only needs `reviewed_at IS NULL`.
 */
export async function expiredCandidates(limit = 200): Promise<QueuedCandidate[]> {
  return candidates(expiredLeadSql(), limit);
}

/** `where` is one of the constant predicates from lead-expiry.ts, never input. */
async function candidates(where: string, limit: number): Promise<QueuedCandidate[]> {
  const result = await database().query<{
    id: string;
    bottleneck: string;
    term: string;
    url: string;
    title: string;
    published: string | null;
    excerpt: string;
    effect_guess: string;
    found_at: Date;
  }>(
    `SELECT id, bottleneck, term, url, title, published, excerpt, effect_guess, found_at
       FROM research_sweep_candidates
      WHERE ${where}
      ORDER BY found_at DESC, bottleneck
      LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    bottleneck: row.bottleneck,
    term: row.term,
    url: row.url,
    title: row.title,
    published: row.published,
    excerpt: row.excerpt,
    effectGuess: row.effect_guess,
    foundAt: row.found_at.toISOString(),
  }));
}

/**
 * Record a reviewer's decision.
 *
 * Accepting does NOT publish. The corpus is files in git and a row reaches a
 * page only when a person commits it; this marks which leads are worth that
 * work and takes the rest out of the queue for good.
 */
export async function recordVerdict(
  id: string,
  verdict: 'accepted' | 'rejected',
  actorId: string,
): Promise<void> {
  await database().query(
    `UPDATE research_sweep_candidates
        SET reviewed_at = now(), reviewed_by = $3, verdict = $2
      WHERE id = $1 AND reviewed_at IS NULL`,
    [id, verdict, actorId],
  );
}
