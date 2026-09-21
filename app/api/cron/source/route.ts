import { runScheduledSourcing } from '@/lib/source-store';

export const dynamic = 'force-dynamic';
/** Several web calls per row; the box wrapper allows 300s. */
export const maxDuration = 290;

/**
 * The scheduled producer-sourcing run — the same mechanism as
 * `app/api/cron/sweep`, for the other engine.
 *
 * Called by a systemd timer on the box through `/opt/_appcron/run.sh`, which
 * sends `Authorization: Bearer $CRON_SECRET` read from the app's env — the
 * fleet's convention, and why this is a route rather than a script: the box
 * runs releases, not checkouts.
 *
 * What it does NOT do is touch the coverage file. Candidates go to a review
 * queue (`research_source_candidates`), and a person promotes one by reading
 * the excerpt and writing `sourced(...)` in `config/substrata-coverage.ts`
 * themselves — a timer cannot make that claim on the site's behalf.
 *
 * Requires `scripts/db/004-source-sweep.sql` applied via
 * `scripts/provision-service.py` — the generic deploy workflow does not run
 * it automatically, same as `003-sweep.sql` before it.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Unconfigured is not "allowed": an open endpoint spends web and model
    // budget for anyone who finds it.
    return Response.json({ error: 'Sourcing is not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }

  try {
    const outcome = await runScheduledSourcing();
    return Response.json({ ok: true, ...outcome });
  } catch (error) {
    console.error('source run failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Sourcing run failed.' }, { status: 503 });
  }
}
