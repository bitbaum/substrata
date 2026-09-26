/**
 * When an unread sweep lead stops being work.
 *
 * A lead nobody decided on within LEAD_EXPIRY_DAYS of being found is EXPIRED:
 * it stays in `research_sweep_candidates` (never deleted, never given a
 * verdict), but it leaves the review queue and the queue's freshness age. The
 * rule is applied when the table is read, not by a job that rewrites rows, so
 * there is no timer to fall behind and no row that says "expired" while its
 * reviewer column says otherwise (George, 2026-09-26).
 *
 * Why: without it the queue's age only ever grows, and "stale" meant "nobody
 * reviewed" instead of "something is broken".
 *
 * Kept free of the database so the boundary is tested, and the SQL and the
 * JavaScript read the same constant.
 */

/** Days an unreviewed lead stays in the review queue. Method: `lead-expiry`. */
export const LEAD_EXPIRY_DAYS = 30;

/**
 * The review queue: OPEN leads only — unreviewed and younger than
 * LEAD_EXPIRY_DAYS. Judged by `queueState` in lib/freshness/status.ts.
 *
 * Late: the oldest open lead has waited longer than a reviewer should let it —
 * reported, not an outage. Stale: the oldest OPEN lead is older than the
 * expiry itself, which the expiry makes impossible — so stale means the expiry
 * or the queue query is broken, never merely "nobody reviewed". One day of
 * slack keeps a clock difference between the database and the app from
 * reading as a break.
 */
export const REVIEW_QUEUE_LATE_DAYS = 7;
export const REVIEW_QUEUE_STALE_DAYS = LEAD_EXPIRY_DAYS + 1;

const DAY_MS = 86_400_000;

export type LeadState = 'open' | 'expired' | 'reviewed';

/**
 * A lead's place in the queue. Open while younger than LEAD_EXPIRY_DAYS;
 * expired from that instant on. Must agree with `openLeadSql`.
 */
export function leadState(
  lead: { foundAt: string | Date; reviewedAt?: string | Date | null },
  now: Date = new Date(),
): LeadState {
  if (lead.reviewedAt) return 'reviewed';
  const found = new Date(lead.foundAt).getTime();
  return now.getTime() - found < LEAD_EXPIRY_DAYS * DAY_MS ? 'open' : 'expired';
}

function column(alias: string | undefined, name: string): string {
  if (alias !== undefined && !/^[a-z_][a-z0-9_]*$/.test(alias)) {
    throw new Error(`Not a table alias: ${alias}`);
  }
  return alias ? `${alias}.${name}` : name;
}

/** SQL: an unreviewed lead still in the queue. `alias` is a constant table alias, never input. */
export function openLeadSql(alias?: string): string {
  return `(${column(alias, 'reviewed_at')} IS NULL AND ${column(alias, 'found_at')} > now() - interval '${LEAD_EXPIRY_DAYS} days')`;
}

/** SQL: an unreviewed lead past the expiry — kept, counted, never queued. */
export function expiredLeadSql(alias?: string): string {
  return `(${column(alias, 'reviewed_at')} IS NULL AND ${column(alias, 'found_at')} <= now() - interval '${LEAD_EXPIRY_DAYS} days')`;
}

/** Where the expired leads are listed, for every page that counts them. */
export const EXPIRED_LEADS_HREF = '/data/freshness/expired';
