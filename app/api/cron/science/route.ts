import { fetchScience } from '@/lib/science-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 290;

/**
 * The hourly science-feed fetch, called by a systemd timer through
 * `/opt/_appcron/run.sh` with `Authorization: Bearer $CRON_SECRET` — the same
 * gate as /api/cron/filings. Each run searches the bottlenecks searched
 * longest ago; `?bottleneck=<exact name>` searches one now, for a backfill.
 * Requires scripts/db/007-science-pipeline.sql.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'Science fetch is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }
  const only = new URL(request.url).searchParams.get('bottleneck') ?? undefined;
  try {
    return Response.json({ ok: true, ...(await fetchScience(new Date(), only)) });
  } catch (error) {
    console.error('science fetch failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Science fetch failed.' }, { status: 503 });
  }
}
