/**
 * The scheduled drafting run: open leads in, drafts out.
 *
 * Bounded twice, because the model budget is shared with every reader who
 * asks the assistant something: a fixed number of leads per run, and a wall
 * clock inside the box's 300-second curl. When the free chain refuses for the
 * day the run stops rather than burning the rest of its list on refusals, and
 * the leads it did not reach are simply first in line next time.
 */
import {
  ChainExhaustedError,
  complete,
  estimateTokens,
  freeChain,
  usableChain,
} from '@bitbaum/ai-kit';
import { backgroundMay, record } from './ai-budget';
import { readPage } from '@bitbaum/ai-kit/web';

import { EVENTS } from '@/config/substrata-events';
import { database } from './db';
import { draftLead, type Ask, type DraftLead, type DraftOutcome } from './event-draft';

/** Leads per run. Hourly, so the backlog clears in about a day and the steady state is only new leads. */
export const DRAFTS_PER_RUN = 5;
/** Vendors background drafting may not use; see freeAsk. */
export const BACKGROUND_EXCLUDED = new Set(['openrouter']);
/** Stop starting new drafts after this long; the box's curl gives up at 300s. */
const RUN_BUDGET_MS = 200_000;
/** A failed look (page unreadable, quote refused) is retried, but not forever. */
export const MAX_ATTEMPTS = 3;
const RETRY_AFTER_HOURS = 6;
/** Free tiers ration tokens per minute; a run that hits that waits once for the window to roll. */
const MINUTE_PAUSE_MS = 60_000;
/**
 * What one lead costs, for the readers-first gate: a page excerpt in, a JSON
 * draft out, up to two calls. Estimated high so the gate errs toward readers.
 */
const LEAD_COST_TOKENS = 12_000;

export interface DraftRunOutcome {
  drafted: number;
  unusable: number;
  couldNotRead: number;
  duplicate: number;
  stopped: string | null;
}

/** Open leads with no usable draft yet, newest first: a fresh lead is the one worth being fast on. */
async function leadsToDraft(limit: number): Promise<DraftLead[]> {
  const result = await database().query<DraftLead>(
    `SELECT c.id, c.bottleneck, c.term, c.url, c.title
       FROM research_sweep_candidates c
       LEFT JOIN research_event_drafts d ON d.candidate_id = c.id
      WHERE c.reviewed_at IS NULL
        AND (d.candidate_id IS NULL
             OR (d.status IN ('unusable', 'could_not_read')
                 AND d.attempts < $2
                 AND d.drafted_at < now() - ($3::float8 * interval '1 hour')))
      ORDER BY c.found_at DESC
      LIMIT $1`,
    [limit, MAX_ATTEMPTS, RETRY_AFTER_HOURS],
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

/** The free chain, asked for JSON-sized answers. Records which link served, for the draft's `model`. */
function freeAsk(served: { id: string | null }): Ask {
  // Background work never draws on OpenRouter: its free tier is about fifty
  // requests a day shared by every app on the box, and that belongs to people
  // asking questions. Drafts wait for a vendor with a pool of its own.
  const chain = usableChain(
    freeChain('SUBSTRATA').filter((p) => !BACKGROUND_EXCLUDED.has(p.id)),
    process.env,
  );
  return async (messages) => {
    const result = await complete({ chain, messages, maxTokens: 2_000, timeoutMs: 45_000 });
    served.id = result.id;
    const usage = (result.raw as { usage?: { total_tokens?: number } } | null)?.usage;
    await record(
      'background',
      usage?.total_tokens ?? estimateTokens(...messages.map((m) => m.content), result.text),
    );
    return result.text;
  };
}

/**
 * Run one draft, pausing once if every free model is at its per-minute limit.
 * Returns why the run must stop instead of a draft when the budget is gone:
 * a daily refusal ends the run, because every later lead would meet it too.
 */
async function draftPacing(
  draft: () => Promise<DraftOutcome>,
  started: number,
): Promise<DraftOutcome | string> {
  for (let pass = 0; ; pass++) {
    try {
      return await draft();
    } catch (error) {
      if (!(error instanceof ChainExhaustedError)) throw error;
      const daily = error.failures.every((f) => /daily|per day|TPD/i.test(f.message));
      const room = Date.now() - started < RUN_BUDGET_MS - MINUTE_PAUSE_MS;
      if (daily || pass > 0 || !room) {
        console.error(
          'drafting stopped:',
          error.failures.map((f) => f.message.slice(0, 160)).join(' | '),
        );
        return daily ? 'model budget (daily)' : 'model budget (per minute)';
      }
      await new Promise((resolve) => setTimeout(resolve, MINUTE_PAUSE_MS));
    }
  }
}

export async function runDraftBatch({
  limit = DRAFTS_PER_RUN,
  ask,
}: { limit?: number; ask?: Ask } = {}): Promise<DraftRunOutcome> {
  const db = database();
  const started = Date.now();
  const outcome: DraftRunOutcome = {
    drafted: 0,
    unusable: 0,
    couldNotRead: 0,
    duplicate: 0,
    stopped: null,
  };
  // One run at a time: two would draft the same newest leads and pay twice.
  // The run row is the lock — inserted only when no unfinished run started
  // within the last few minutes (an older unfinished one died with its process).
  const run = await db.query<{ id: string }>(
    `INSERT INTO research_event_draft_runs (started_at)
     SELECT now()
      WHERE NOT EXISTS (SELECT 1 FROM research_event_draft_runs
                         WHERE finished_at IS NULL AND started_at > now() - interval '6 minutes')
     RETURNING id`,
  );
  if (!run.rows[0]) return { ...outcome, stopped: 'another run in progress' };
  const served = { id: null as string | null };
  const askModel = ask ?? freeAsk(served);
  const known = new Map(EVENTS.map((e) => [e.source, e.id]));

  for (const lead of await leadsToDraft(limit)) {
    if (Date.now() - started > RUN_BUDGET_MS) {
      outcome.stopped = 'time';
      break;
    }
    // Already in the corpus: say so without spending a model call on it.
    const existing = known.get(lead.url);
    if (existing) {
      await save(
        lead,
        { status: 'duplicate', reason: `Already accepted as ${existing}.` },
        null,
        null,
      );
      outcome.duplicate += 1;
      continue;
    }
    const page = await readPage(lead.url, { timeoutMs: 15_000, maxChars: 60_000 });
    if (!page.ok) {
      await save(
        lead,
        { status: 'could_not_read', reason: 'The page could not be fetched.' },
        null,
        null,
      );
      outcome.couldNotRead += 1;
      continue;
    }
    // Readers first: a draft waits for tomorrow rather than spend the slice
    // of today's free budget kept for people asking questions.
    if (!ask) {
      const gate = await backgroundMay(LEAD_COST_TOKENS);
      if (!gate.allowed) {
        outcome.stopped = `budget reserved for readers (${gate.reason})`;
        break;
      }
    }
    const result = await draftPacing(() => draftLead(lead, page.text, askModel), started);
    if (typeof result === 'string') {
      // Nothing is saved for this lead, so it is first in line next time.
      outcome.stopped = result;
      break;
    }
    await save(lead, result, page.text, served.id);
    if (result.status === 'drafted') outcome.drafted += 1;
    else outcome.unusable += 1;
  }

  await db.query(
    `UPDATE research_event_draft_runs
        SET finished_at = now(), drafted = $2, unusable = $3, could_not_read = $4, stopped = $5
      WHERE id = $1`,
    [run.rows[0].id, outcome.drafted, outcome.unusable, outcome.couldNotRead, outcome.stopped],
  );
  return outcome;
}
