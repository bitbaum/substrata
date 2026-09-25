/**
 * Drafting: open leads in, drafts out — on a READER's model, never the site's.
 *
 * The site's free models are rationed and shared with every other app on the
 * box; they are kept for people asking questions. So drafting has no free
 * path at all: every call here goes through an `Ask` the caller built from a
 * reader's own key (`lib/byok-ask.ts`) — a reader pressing "Summarise with
 * AI", or the hourly run for readers who opted in (`lib/auto-updates.ts`).
 * `test/no-free-background-ai.test.ts` fails the build if that changes.
 *
 * Bounded by a lead count the caller passes and by a wall clock. A key that
 * refuses (billing, rate limit, bad model) ends the batch: every later lead
 * would meet the same refusal, and it is the reader's money being refused.
 */
import { readPage } from '@bitbaum/ai-kit/web';

import { EVENTS } from '@/config/substrata-events';
import { ByokError } from './byok';
import { database } from './db';
import { draftLead, type Ask, type DraftLead, type DraftOutcome } from './event-draft';

/** A failed look (page unreadable, quote refused) is retried, but not forever. */
export const MAX_ATTEMPTS = 3;
const RETRY_AFTER_HOURS = 6;

export interface DraftResult {
  id: string;
  status: DraftOutcome['status'] | 'could_not_read' | 'duplicate';
  reason: string;
}

export interface DraftRunOutcome {
  drafted: number;
  unusable: number;
  couldNotRead: number;
  duplicate: number;
  /** Leads that reached the model: what the reader's key paid for. */
  modelCalls: number;
  stopped: string | null;
  results: DraftResult[];
}

/**
 * Open leads with no usable draft yet, newest first — on these bottlenecks,
 * or with these ids. A fresh lead is the one worth being fast on.
 */
export async function leadsToDraft({
  names = null,
  ids = null,
  limit,
}: {
  names?: readonly string[] | null;
  ids?: readonly string[] | null;
  limit: number;
}): Promise<DraftLead[]> {
  if (limit <= 0) return [];
  const result = await database().query<DraftLead>(
    `SELECT c.id, c.bottleneck, c.term, c.url, c.title
       FROM research_sweep_candidates c
       LEFT JOIN research_event_drafts d ON d.candidate_id = c.id
      WHERE c.reviewed_at IS NULL
        AND ($4::text[] IS NULL OR c.bottleneck = ANY($4::text[]))
        AND ($5::text[] IS NULL OR c.id = ANY($5::text[]))
        AND (d.candidate_id IS NULL
             OR (d.status IN ('unusable', 'could_not_read')
                 AND d.attempts < $2
                 AND d.drafted_at < now() - ($3::float8 * interval '1 hour')))
      ORDER BY c.found_at DESC
      LIMIT $1`,
    [limit, MAX_ATTEMPTS, RETRY_AFTER_HOURS, names, ids],
  );
  return result.rows;
}

async function save(
  lead: DraftLead,
  outcome: DraftOutcome | { status: 'could_not_read' | 'duplicate'; reason: string },
  pageText: string | null,
  model: string | null,
): Promise<void> {
  const drafted = outcome.status === 'drafted' ? outcome : null;
  await database().query(
    `INSERT INTO research_event_drafts
       (candidate_id, status, suggestion, reason, draft, notes, page_text, model)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (candidate_id) DO UPDATE SET
       status = $2, suggestion = $3, reason = $4, draft = $5, notes = $6,
       page_text = COALESCE($7, research_event_drafts.page_text), model = $8,
       attempts = research_event_drafts.attempts + 1, drafted_at = now()`,
    [
      lead.id,
      outcome.status,
      drafted?.suggestion ?? (outcome.status === 'duplicate' ? 'not_an_event' : null),
      outcome.reason,
      drafted?.draft ? JSON.stringify(drafted.draft) : null,
      drafted?.notes ?? [],
      pageText,
      model,
    ],
  );
}

/**
 * Draft these leads with this model. `model` is what the draft records as its
 * author ("vendor/model") — never the key. Each batch leaves a run row, so
 * /data/freshness can say when drafting last happened and whether it worked.
 */
export async function draftLeads(
  leads: readonly DraftLead[],
  ask: Ask,
  { model, budgetMs }: { model: string; budgetMs: number },
): Promise<DraftRunOutcome> {
  const db = database();
  const started = Date.now();
  const outcome: DraftRunOutcome = {
    drafted: 0,
    unusable: 0,
    couldNotRead: 0,
    duplicate: 0,
    modelCalls: 0,
    stopped: null,
    results: [],
  };
  if (leads.length === 0) return outcome;
  const run = await db.query<{ id: string }>(
    'INSERT INTO research_event_draft_runs (started_at) VALUES (now()) RETURNING id',
  );
  const known = new Map(EVENTS.map((e) => [e.source, e.id]));

  for (const lead of leads) {
    if (Date.now() - started > budgetMs) {
      outcome.stopped = 'time';
      break;
    }
    // Already in the corpus: say so without spending a model call on it.
    const existing = known.get(lead.url);
    if (existing) {
      const reason = `Already accepted as ${existing}.`;
      await save(lead, { status: 'duplicate', reason }, null, null);
      outcome.duplicate += 1;
      outcome.results.push({ id: lead.id, status: 'duplicate', reason });
      continue;
    }
    const page = await readPage(lead.url, { timeoutMs: 15_000, maxChars: 60_000 });
    if (!page.ok) {
      const reason = 'The page could not be fetched.';
      await save(lead, { status: 'could_not_read', reason }, null, null);
      outcome.couldNotRead += 1;
      outcome.results.push({ id: lead.id, status: 'could_not_read', reason });
      continue;
    }
    let result: DraftOutcome;
    try {
      outcome.modelCalls += 1;
      result = await draftLead(lead, page.text, ask);
    } catch (error) {
      // Nothing is saved for this lead, so it is first in line next time.
      outcome.stopped =
        error instanceof ByokError ? error.message : 'The model did not answer. Try again later.';
      break;
    }
    await save(lead, result, page.text, model);
    if (result.status === 'drafted') outcome.drafted += 1;
    else outcome.unusable += 1;
    outcome.results.push({ id: lead.id, status: result.status, reason: result.reason });
  }

  await db.query(
    `UPDATE research_event_draft_runs
        SET finished_at = now(), drafted = $2, unusable = $3, could_not_read = $4, stopped = $5
      WHERE id = $1`,
    [run.rows[0].id, outcome.drafted, outcome.unusable, outcome.couldNotRead, outcome.stopped],
  );
  return outcome;
}
