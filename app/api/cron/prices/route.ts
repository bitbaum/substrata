import { refreshMarketFacts } from '@/lib/market-data/facts-run';
import { fetchAllPrices } from '@/lib/market-data/prices/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 290;

/**
 * Stop starting new price/fact fetches after this long; the box wrapper allows 300s.
 * Stopping at 200s bounds the run well inside the curl timeout so the service
 * never exits with status 28.
 */
export const PRICES_RUN_BUDGET_MS = 200_000;
export const PRICES_PORTION_MS = 140_000;

/**
 * The daily market-data run, called by a systemd timer through
 * `/opt/_appcron/run.sh` with `Authorization: Bearer $CRON_SECRET` — the same
 * gate as /api/cron/series. Daily closes for every seed listing first, then the
 * rest of the tracked universe lines, stalest first, within the time given
 * (research_price_runs), then, in the time left, the EDGAR fundamentals and
 * holders snapshots oldest first (research_market_fact_runs). Requires
 * scripts/db/016-market-data.sql.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'Price fetch is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }
  const started = Date.now();
  const runTimeout = AbortSignal.timeout(PRICES_RUN_BUDGET_MS);
  const signal = request.signal ? AbortSignal.any([request.signal, runTimeout]) : runTimeout;
  const pricesTimeout = AbortSignal.timeout(PRICES_PORTION_MS);
  const pricesSignal = AbortSignal.any([signal, pricesTimeout]);
  try {
    const prices = await fetchAllPrices(
      {},
      { deadline: started + PRICES_PORTION_MS, signal: pricesSignal },
    );
    const facts = await refreshMarketFacts({
      deadline: started + PRICES_RUN_BUDGET_MS,
      signal,
    });
    return Response.json({ ok: true, prices, facts });
  } catch (error) {
    console.error('market data run failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Market data run failed.' }, { status: 503 });
  }
}
