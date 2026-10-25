import { refreshMarketFacts } from '@/lib/market-data/facts-run';
import { fetchAllPrices } from '@/lib/market-data/prices/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 290;

/**
 * The daily market-data run, called by a systemd timer through
 * `/opt/_appcron/run.sh` with `Authorization: Bearer $CRON_SECRET` — the same
 * gate as /api/cron/series. Daily closes for every seed listing first
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
  try {
    const prices = await fetchAllPrices();
    const facts = await refreshMarketFacts({ deadline: started + 240_000 });
    return Response.json({ ok: true, prices, facts });
  } catch (error) {
    console.error('market data run failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Market data run failed.' }, { status: 503 });
  }
}
