import { fetchOfficialSeries } from '@/lib/series-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 290;

/**
 * The daily BLS fetch of official series, called by a systemd timer through
 * `/opt/_appcron/run.sh` with `Authorization: Bearer $CRON_SECRET` — the same
 * gate as /api/cron/sweep. Requires scripts/db/008-series.sql.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'Series fetch is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await fetchOfficialSeries()) });
  } catch (error) {
    console.error('series fetch failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Series fetch failed.' }, { status: 503 });
  }
}
