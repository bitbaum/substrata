/**
 * The cron's second half: refresh the EDGAR snapshots (fundamentals, holders)
 * of every seed company that files with the SEC, within a deadline, one run
 * row in research_market_fact_runs. A snapshot younger than 20 hours is left
 * alone, so a run that ran out of time picks up where it stopped next day.
 */
import { database } from '@/lib/db';
import { MARKET_SEED } from './identity';
import { fundamentals } from './fundamentals/read';
import { holders } from './holders/read';

const FRESH_MS = 20 * 60 * 60 * 1000;

export interface FactsRun {
  looked: number;
  stored: number;
  failed: number;
}

export async function refreshMarketFacts(opts: { deadline: number }): Promise<FactsRun> {
  const db = database();
  const run = await db.query<{ id: string }>(
    'INSERT INTO research_market_fact_runs DEFAULT VALUES RETURNING id',
  );
  const out: FactsRun = { looked: 0, stored: 0, failed: 0 };
  for (const c of MARKET_SEED.filter((x) => x.cik)) {
    if (Date.now() > opts.deadline) break;
    out.looked += 1;
    const [f, h] = await Promise.all([fundamentals(c, {}, FRESH_MS), holders(c, {}, FRESH_MS)]);
    // A typed "not available" (no XBRL at the SEC) is a stored answer, not a failure.
    const failed = [f, h].filter((x) => 'unavailable' in x && /could not be read/.test(x.reason));
    if (failed.length) out.failed += 1;
    else out.stored += 1;
  }
  await db.query(
    `UPDATE research_market_fact_runs SET finished_at = now(), looked = $2, stored = $3, failed = $4
      WHERE id = $1`,
    [run.rows[0].id, out.looked, out.stored, out.failed],
  );
  return out;
}
