import { runQuality } from '@/lib/quality/run';
import { dbStore } from '@/lib/quality/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 290;

/**
 * The scheduled data-quality run (lib/quality/run.ts): re-looks at a rotating
 * slice of source links, quotes, tickers and USGS rows, then stores the
 * scorecard behind /data/quality. Called every six hours by a systemd timer
 * through `/opt/_appcron/run.sh` with `Authorization: Bearer $CRON_SECRET`.
 * Requires scripts/db/014-quality.sql. No AI.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'Quality run is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }
  try {
    const { looked, failed, cannotTell, errors } = await runQuality(dbStore);
    return Response.json({ ok: true, looked, failed, cannotTell, errors });
  } catch (error) {
    console.error('quality run failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Quality run failed.' }, { status: 503 });
  }
}
