import { fetchFilings } from '@/lib/filings-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 290;

/**
 * The hourly EDGAR fetch, called by a systemd timer through
 * `/opt/_appcron/run.sh` with `Authorization: Bearer $CRON_SECRET` — the same
 * gate as /api/cron/sweep. Requires scripts/db/006-filings.sql.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'Filings fetch is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await fetchFilings()) });
  } catch (error) {
    console.error('filings fetch failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Filings fetch failed.' }, { status: 503 });
  }
}
