/**
 * The ledger of the site's free AI: who spent today's daily pool.
 *
 * Since 2026-09-25 only readers spend it — Ask and fact-checks, a person
 * waiting. No scheduled job calls the free models (George: "background jobs
 * should not exist if there is a free tier only"); drafting runs on a
 * reader's own key or not at all, and test/no-free-background-ai.test.ts
 * keeps it that way. The `background` class stays so the days before the
 * rule still read correctly on /data.
 *
 * The ledger sees this app's own spend only. The keys are shared with other
 * apps on the box, so a vendor can refuse before this reaches capacity.
 */
import { dayCapacityTokens, freeChain, utcDayKey } from '@bitbaum/ai-kit';
import { database } from './db';

export type SpendClass = 'interactive' | 'background';

/** The day's free capacity across the keyed vendors (ai-kit's estimates, set low). */
export function dayCapacity(env: NodeJS.ProcessEnv = process.env): number {
  return dayCapacityTokens(freeChain('SUBSTRATA'), env);
}

/**
 * Add a reader's call to today's row. Never throws: accounting must not fail
 * an answer. Only `interactive` is accepted — there is no background spend of
 * the free models to record any more.
 */
export async function record(cls: 'interactive', tokens: number): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await database().query(
      `INSERT INTO research_ai_spend(day, class, tokens, calls, held) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(day, class) DO UPDATE SET tokens = research_ai_spend.tokens + $3,
         calls = research_ai_spend.calls + $4, held = research_ai_spend.held + $5`,
      [utcDayKey(new Date()), cls, Math.max(0, Math.round(tokens)), 1, 0],
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
