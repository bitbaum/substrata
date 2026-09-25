import { runAutoUpdates } from '@/lib/auto-updates';

export const dynamic = 'force-dynamic';
/** A page read and up to two model calls per lead; the box wrapper allows 300s. */
export const maxDuration = 290;

/**
 * Automatic AI updates for readers who opted in, each on their own saved key.
 *
 * Same contract as `/api/cron/sweep`: called hourly by a box timer with
 * `Authorization: Bearer $CRON_SECRET`, refused when the secret is unset.
 * It never calls the site's free models — with nobody opted in it makes no
 * model call at all (lib/auto-updates.ts, test/no-free-background-ai.test.ts).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'Not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }
  try {
    const outcome = await runAutoUpdates();
    return Response.json({ ok: true, ...outcome });
  } catch (error) {
    // The message only: a stack or a request could carry a reader's key.
    console.error('auto-updates failed', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Automatic updates failed.' }, { status: 503 });
  }
}
