import { runDraftBatch } from '@/lib/event-draft-run';

export const dynamic = 'force-dynamic';
/** A page read and up to two model calls per lead; the box wrapper allows 300s. */
export const maxDuration = 290;

/**
 * The scheduled drafter: turns open sweep leads into event drafts for review.
 *
 * Same contract as `/api/cron/sweep`: called hourly by a box timer with
 * `Authorization: Bearer $CRON_SECRET`, refused when the secret is unset.
 * It never touches the corpus — drafts wait at /review for a person.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'Drafting is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }
  try {
    const outcome = await runDraftBatch();
    return Response.json({ ok: true, ...outcome });
  } catch (error) {
    console.error('drafting failed', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Drafting failed.' }, { status: 503 });
  }
}
