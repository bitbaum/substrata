import { fetchJobs } from '@/lib/careers-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 290;

/**
 * The daily read of open roles from public job boards, called by a systemd
 * timer through `/opt/_appcron/run.sh` with `Authorization: Bearer $CRON_SECRET`
 * — the same gate as /api/cron/filings. Requires scripts/db/011-jobs.sql.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'Jobs fetch is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await fetchJobs()) });
  } catch (error) {
    console.error('jobs fetch failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Jobs fetch failed.' }, { status: 503 });
  }
}
