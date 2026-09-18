import { runScheduledSweep } from '@/lib/sweep-store';

export const dynamic = 'force-dynamic';
/** Several web calls per node; the box wrapper allows 300s. */
export const maxDuration = 290;

/**
 * The scheduled event sweep.
 *
 * Called by a systemd timer on the box through `/opt/_appcron/run.sh`, which
 * sends `Authorization: Bearer $CRON_SECRET` read from the app's env. That is
 * the fleet's convention, and it is why this is a route rather than a script:
 * the box runs releases, not checkouts.
 *
 * What it does NOT do is touch the corpus. Findings go to a review queue, and
 * a person promotes them in a commit — the site's claim is that a row was read
 * and accepted, and a timer cannot do that. It also means nothing is lost when
 * the next deploy replaces the release directory.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Unconfigured is not "allowed": an open sweep endpoint spends web and
    // model budget for anyone who finds it.
    return Response.json({ error: 'Sweep is not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }

  try {
    const outcome = await runScheduledSweep();
    return Response.json({ ok: true, ...outcome });
  } catch (error) {
    console.error('sweep failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Sweep failed.' }, { status: 503 });
  }
}
