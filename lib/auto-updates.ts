/**
 * Automatic AI updates — only for readers who asked, only on their own key.
 *
 * George's rule (2026-09-25): no background job may spend the site's free AI.
 * So the hourly run has exactly one source of model calls: readers who
 * switched "Automatic AI updates" on at /account/settings and saved a key on
 * their account. For each of them it drafts new leads on THEIR rails with
 * THEIR key, up to the daily cap THEY chose. Nobody opted in = no model call.
 *
 * One reader's key is never spent on another reader's request: the leads a
 * run drafts are the ones on that reader's own desk. (The drafts it leaves
 * are shared at /review, like every lead — that is the point of drafting.)
 */
import { utcDayKey } from '@bitbaum/ai-kit';

import { byokAsk, byokModelLabel } from './byok-ask';
import { openStoredKey } from './byok-vault';
import { database } from './db';
import { draftLeads, leadsToDraft } from './event-draft-run';
import { parseFollows, railsOf } from './follows';

/** Leads per reader per hourly run, so one reader's backlog cannot hold up the next. */
export const AUTO_DRAFTS_PER_RUN = 5;
/** The box wrapper gives a run 300 s; stop starting drafts well before. */
const RUN_BUDGET_MS = 200_000;

export interface AutoUpdateOutcome {
  readers: number;
  drafted: number;
  modelCalls: number;
  skipped: string[];
}

async function usedToday(actorId: string, day: string): Promise<number> {
  const { rows } = await database().query<{ drafts: number }>(
    'SELECT drafts FROM research_auto_draft_days WHERE actor_id=$1 AND day=$2',
    [actorId, day],
  );
  return rows[0]?.drafts ?? 0;
}

async function addToday(actorId: string, day: string, drafts: number): Promise<void> {
  if (drafts <= 0) return;
  await database().query(
    `INSERT INTO research_auto_draft_days (actor_id, day, drafts) VALUES ($1,$2,$3)
     ON CONFLICT (actor_id, day) DO UPDATE SET drafts = research_auto_draft_days.drafts + $3`,
    [actorId, day, drafts],
  );
}

/** Readers who switched automatic updates on. Their key is checked per reader, below. */
async function optedIn(): Promise<{ actorId: string; topics: unknown }[]> {
  const { rows } = await database().query<{ actor_id: string; topics: unknown }>(
    `SELECT actor_id, topics FROM research_preferences
      WHERE topics->'desk'->>'autoDraft' = 'true'`,
  );
  return rows.map((r) => ({ actorId: r.actor_id, topics: r.topics }));
}

export async function runAutoUpdates(now = new Date()): Promise<AutoUpdateOutcome> {
  const started = Date.now();
  const day = utcDayKey(now);
  const outcome: AutoUpdateOutcome = { readers: 0, drafted: 0, modelCalls: 0, skipped: [] };

  for (const reader of await optedIn()) {
    const left = RUN_BUDGET_MS - (Date.now() - started);
    if (left < 30_000) {
      outcome.skipped.push('time');
      break;
    }
    const follows = parseFollows(reader.topics);
    if (!follows.desk.autoDraft) continue;
    // Opted in, but no key on the account (removed since, or sealed under a
    // rotated secret): nothing to spend, and nothing else is spent instead.
    const key = await openStoredKey(reader.actorId).catch(() => null);
    if (!key) {
      outcome.skipped.push('no stored key');
      continue;
    }
    outcome.readers += 1;
    const room = follows.desk.autoDraftPerDay - (await usedToday(reader.actorId, day));
    const leads = await leadsToDraft({
      names: railsOf(follows).map((b) => b.name),
      limit: Math.min(room, AUTO_DRAFTS_PER_RUN),
    });
    if (leads.length === 0) continue;
    const result = await draftLeads(leads, byokAsk(key), {
      model: byokModelLabel(key),
      budgetMs: left - 20_000,
    });
    await addToday(reader.actorId, day, result.modelCalls);
    outcome.drafted += result.drafted;
    outcome.modelCalls += result.modelCalls;
    // A refusal is the reader's vendor talking; it ends THEIR turn, not the run.
    if (result.stopped) outcome.skipped.push('a reader key refused');
  }
  return outcome;
}
