/**
 * Readers first. One daily free budget, two classes of spender.
 *
 * Ask (a person waiting) is the priority class, limited only by what the
 * vendors grant. Background jobs — the hourly event drafter, and anything else
 * scheduled that calls a model — spend from a capped slice and stop before the
 * day falls under the floor kept for readers. The rule is `classBudget` from
 * @bitbaum/ai-kit (shared with the fleet); this file owns the ledger.
 *
 * The ledger sees this app's own spend only. The keys are shared with other
 * apps on the box, so a vendor's daily refusal still ends a background run
 * (lib/event-draft-run.ts) whatever this says.
 */
import {
  BACKGROUND_POLICY,
  classBudget,
  dayCapacityTokens,
  freeChain,
  utcDayKey,
  type ClassDecision,
} from '@bitbaum/ai-kit';
import { database } from './db';

export type SpendClass = 'interactive' | 'background';

/**
 * ai-kit's default (≤25% of the day, never below a 50% floor), tunable on the
 * box without a deploy: SUBSTRATA_BACKGROUND_SHARE / SUBSTRATA_READER_FLOOR.
 */
export function classPolicy(env: Record<string, string | undefined> = process.env) {
  const num = (v: string | undefined, d: number | undefined) =>
    v && Number.isFinite(Number(v)) ? Number(v) : d;
  return {
    background: {
      maxShare: num(env.SUBSTRATA_BACKGROUND_SHARE, BACKGROUND_POLICY.maxShare),
      stopBelow: num(env.SUBSTRATA_READER_FLOOR, BACKGROUND_POLICY.stopBelow),
    },
  };
}

export const CLASS_POLICY = classPolicy({});

/** The day's free capacity across the keyed vendors (ai-kit's estimates, set low). */
export function dayCapacity(env: NodeJS.ProcessEnv = process.env): number {
  return dayCapacityTokens(freeChain('SUBSTRATA'), env);
}

export async function spentToday(now = new Date()): Promise<Record<SpendClass, number>> {
  const { rows } = await database().query<{ class: string; tokens: string }>(
    'SELECT class, tokens FROM research_ai_spend WHERE day=$1',
    [utcDayKey(now)],
  );
  const out: Record<SpendClass, number> = { interactive: 0, background: 0 };
  for (const r of rows) if (r.class in out) out[r.class as SpendClass] = Number(r.tokens);
  return out;
}

/**
 * May a background call of about `costTokens` go ahead? Fails CLOSED: a job
 * that cannot read the ledger does not spend — readers matter more than a draft.
 */
export async function backgroundMay(costTokens: number): Promise<ClassDecision> {
  try {
    const spent = await spentToday();
    const decision = classBudget({
      dayCapacityTokens: dayCapacity(),
      spent,
      cls: 'background',
      costTokens,
      policy: classPolicy(),
    });
    if (!decision.allowed) await record('background', 0, { held: true });
    return decision;
  } catch {
    return { allowed: false, reason: 'no-capacity', roomTokens: 0, remainingTokens: 0 };
  }
}

/** Add a call's tokens to today's row for its class. Never throws: accounting must not fail an answer. */
export async function record(
  cls: SpendClass,
  tokens: number,
  opts: { held?: boolean } = {},
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await database().query(
      `INSERT INTO research_ai_spend(day, class, tokens, calls, held) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(day, class) DO UPDATE SET tokens = research_ai_spend.tokens + $3,
         calls = research_ai_spend.calls + $4, held = research_ai_spend.held + $5`,
      [
        utcDayKey(new Date()),
        cls,
        Math.max(0, Math.round(tokens)),
        opts.held ? 0 : 1,
        opts.held ? 1 : 0,
      ],
    );
  } catch {
    // The table may not exist yet on a fresh box; the answer still stands.
  }
}

export interface SpendDay {
  day: string;
  interactive: number;
  background: number;
  held: number;
}

/** The last `days` UTC days of spend, newest first, for /data. */
export async function spendReport(days = 7): Promise<{ capacity: number; days: SpendDay[] }> {
  const { rows } = await database().query<{
    day: Date;
    class: string;
    tokens: string;
    held: number;
  }>(
    `SELECT day, class, tokens, held FROM research_ai_spend
      WHERE day > (now() AT TIME ZONE 'utc')::date - $1::int ORDER BY day DESC`,
    [days],
  );
  const byDay = new Map<string, SpendDay>();
  for (const r of rows) {
    const day = r.day.toISOString().slice(0, 10);
    const row = byDay.get(day) ?? { day, interactive: 0, background: 0, held: 0 };
    if (r.class === 'interactive') row.interactive += Number(r.tokens);
    if (r.class === 'background') {
      row.background += Number(r.tokens);
      row.held += r.held;
    }
    byDay.set(day, row);
  }
  return { capacity: dayCapacity(), days: [...byDay.values()] };
}

/**
 * Free-model questions (Ask and fact-checks together) per visitor per day.
 * The free models are a small daily pool shared with the other apps on the
 * box; a reader's own key is theirs to spend and is not counted.
 */
export const FREE_QUESTIONS_PER_DAY = 40;
