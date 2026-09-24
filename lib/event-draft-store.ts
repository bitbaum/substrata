/**
 * The review side of drafts: what a reviewer sees, what Accept does, and the
 * queue's own freshness numbers. The run that writes drafts is
 * `event-draft-run.ts`.
 */
import { EVENTS, type CoverageEvent } from '@/config/substrata-events';
import { database } from './db';
import type { DraftEvent } from './event-draft';
import { contextAround, eventProblems, verbatimIn } from './event-rules';

type DraftStatus = 'drafted' | 'unusable' | 'could_not_read' | 'duplicate';

export interface LeadWithDraft {
  id: string;
  bottleneck: string;
  url: string;
  title: string;
  published: string | null;
  excerpt: string;
  foundAt: string;
  draft: {
    status: DraftStatus;
    suggestion: 'event' | 'not_an_event' | null;
    reason: string;
    event: DraftEvent | null;
    notes: string[];
    /** The page around the quote, so the reviewer reads the claim in its setting. */
    context: ReturnType<typeof contextAround>;
    model: string | null;
    attempts: number;
  } | null;
}

/**
 * Open leads with their drafts. Drafts that suggest an event come first: they
 * are where a reviewer's minute buys a row. Then newest first, as before.
 */
export async function openLeadsWithDrafts(limit = 100): Promise<LeadWithDraft[]> {
  const result = await database().query<{
    id: string;
    bottleneck: string;
    url: string;
    title: string;
    published: string | null;
    excerpt: string;
    found_at: Date;
    status: DraftStatus | null;
    suggestion: 'event' | 'not_an_event' | null;
    reason: string | null;
    draft: DraftEvent | null;
    notes: string[] | null;
    page_text: string | null;
    model: string | null;
    attempts: number | null;
  }>(
    `SELECT c.id, c.bottleneck, c.url, c.title, c.published, c.excerpt, c.found_at,
            d.status, d.suggestion, d.reason, d.draft, d.notes, d.page_text, d.model, d.attempts
       FROM research_sweep_candidates c
       LEFT JOIN research_event_drafts d ON d.candidate_id = c.id
      WHERE c.reviewed_at IS NULL
      ORDER BY (d.suggestion = 'event') IS TRUE DESC, c.found_at DESC, c.bottleneck
      LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    bottleneck: row.bottleneck,
    url: row.url,
    title: row.title,
    published: row.published,
    excerpt: row.excerpt,
    foundAt: row.found_at.toISOString(),
    draft: row.status
      ? {
          status: row.status,
          suggestion: row.suggestion,
          reason: row.reason ?? '',
          event: row.draft,
          notes: row.notes ?? [],
          context:
            row.draft && row.page_text ? contextAround(row.draft.quote, row.page_text) : null,
          model: row.model,
          attempts: row.attempts ?? 0,
        }
      : null,
  }));
}

/**
 * Accept an edited draft. Returns the problems if it is not acceptable.
 *
 * The quote is re-verified against the page text the draft was made from, so
 * an edit can shorten a quote but cannot put words on the page. Accepting
 * marks the lead reviewed and parks the row in `accepted_event`; it reaches
 * the corpus file only through `pnpm run research:accept-events` and a commit.
 */
export async function acceptDraft(
  candidateId: string,
  event: CoverageEvent,
  actorId: string,
): Promise<string[]> {
  const db = database();
  const row = await db.query<{ page_text: string | null }>(
    'SELECT page_text FROM research_event_drafts WHERE candidate_id = $1',
    [candidateId],
  );
  const pageText = row.rows[0]?.page_text;
  if (!pageText) return ['This lead has no fetched page to check the quote against.'];
  const problems = eventProblems(event, pageText);
  if (EVENTS.some((e) => e.id === event.id)) problems.push(`The id ${event.id} is already taken.`);
  if (problems.length) {
    // Keep the reviewer's edits, so fixing one field does not mean retyping the rest.
    const edited: Partial<CoverageEvent> = { ...event };
    delete edited.acceptedOn;
    await db.query('UPDATE research_event_drafts SET draft = $2 WHERE candidate_id = $1', [
      candidateId,
      JSON.stringify(edited),
    ]);
    return problems;
  }
  const accepted = { ...event, quote: verbatimIn(event.quote, pageText) ?? event.quote };

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE research_event_drafts
          SET accepted_event = $2, accepted_at = now(), accepted_by = $3
        WHERE candidate_id = $1`,
      [candidateId, JSON.stringify(accepted), actorId],
    );
    await client.query(
      `UPDATE research_sweep_candidates
          SET reviewed_at = now(), reviewed_by = $2, verdict = 'accepted'
        WHERE id = $1 AND reviewed_at IS NULL`,
      [candidateId, actorId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return [];
}

/**
 * Accepted events that are not in the corpus file yet — the work
 * `research:accept-events` does. "In the corpus" is read from the deployed
 * EVENTS, so once the commit ships a row drops off this list by itself.
 */
export async function acceptedAwaitingCommit(): Promise<CoverageEvent[]> {
  const result = await database().query<{ accepted_event: CoverageEvent }>(
    `SELECT accepted_event FROM research_event_drafts
      WHERE accepted_event IS NOT NULL ORDER BY accepted_at`,
  );
  const ids = new Set(EVENTS.map((e) => e.id));
  const sources = new Set(EVENTS.map((e) => e.source));
  return result.rows
    .map((row) => row.accepted_event)
    .filter((e) => !ids.has(e.id) && !sources.has(e.source));
}

export interface ReviewQueue {
  /** Leads nobody has decided on. */
  waiting: number;
  /** When the oldest of them was found; null when none wait. */
  oldestFoundAt: string | null;
  /** Waiting leads whose draft suggests an event and passed the checks. */
  draftsReady: number;
  /** Waiting leads the drafter suggests are not events. */
  suggestedNot: number;
  /** Waiting leads not yet drafted, or whose draft failed. */
  undrafted: number;
  /** Accepted by a reviewer, not yet in the corpus file. */
  awaitingCommit: number;
  lastDraftRunAt: string | null;
}

/** The queue's freshness, for /data, the desk and /review. One round trip plus the commit check. */
export async function reviewQueue(): Promise<ReviewQueue> {
  const db = database();
  const [counts, run, awaiting] = await Promise.all([
    db.query<{
      waiting: string;
      oldest: Date | null;
      ready: string;
      not_event: string;
    }>(
      `SELECT count(*) AS waiting, min(c.found_at) AS oldest,
              count(*) FILTER (WHERE d.status = 'drafted' AND d.suggestion = 'event') AS ready,
              count(*) FILTER (WHERE d.suggestion = 'not_an_event') AS not_event
         FROM research_sweep_candidates c
         LEFT JOIN research_event_drafts d ON d.candidate_id = c.id
        WHERE c.reviewed_at IS NULL`,
    ),
    db.query<{ finished_at: Date }>(
      'SELECT finished_at FROM research_event_draft_runs WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1',
    ),
    acceptedAwaitingCommit(),
  ]);
  const row = counts.rows[0];
  const waiting = Number(row?.waiting ?? 0);
  const ready = Number(row?.ready ?? 0);
  const notEvent = Number(row?.not_event ?? 0);
  return {
    waiting,
    oldestFoundAt: row?.oldest?.toISOString() ?? null,
    draftsReady: ready,
    suggestedNot: notEvent,
    undrafted: waiting - ready - notEvent,
    awaitingCommit: awaiting.length,
    lastDraftRunAt: run.rows[0]?.finished_at?.toISOString() ?? null,
  };
}

/** Whole days between a timestamp and now, for "oldest waiting N days". */
export function daysSince(iso: string, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

/** "less than a day", "1 day", "6 days" — an age a reader can say out loud. */
export function ageLabel(iso: string, now = new Date()): string {
  const days = daysSince(iso, now);
  return days === 0 ? 'less than a day' : `${days} day${days === 1 ? '' : 's'}`;
}
