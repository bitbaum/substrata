import { byokAsk, byokModelLabel } from '@/lib/byok-ask';
import { draftLeads, leadsToDraft } from '@/lib/event-draft-run';
import { readerKey } from '@/lib/reader-key';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';
import { SUMMARIES_PER_HOUR, SUMMARISE_AT_ONCE, openLeads } from '@/lib/update-now';

export const dynamic = 'force-dynamic';
/** Up to three page reads and two model calls each, on the reader's own key. */
export const maxDuration = 120;
const BUDGET_MS = 100_000;

/**
 * "Summarise with AI": draft these leads into events for review — ONLY on the
 * reader's own key (from their browser, or sealed on their account). There is
 * no free fallback: the site's free AI is kept for questions. Without a key
 * the answer says so, and the page offers the key panel.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  let input: unknown;
  try {
    input = await boundedJson(request);
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  const raw = (input as { ids?: unknown } | null)?.ids;
  const ids = Array.isArray(raw)
    ? [
        ...new Set(
          raw.filter((id): id is string => typeof id === 'string' && /^[0-9a-f]{12}$/.test(id)),
        ),
      ]
    : [];
  if (ids.length === 0 || ids.length > SUMMARISE_AT_ONCE)
    return Response.json({ error: 'Pick up to three leads.' }, { status: 400 });
  const reader = await readerKey(input);
  if ('error' in reader) return Response.json({ error: reader.error }, { status: 400 });
  if (!reader.key)
    return Response.json(
      {
        needKey: true,
        error:
          'Summaries run on your own AI model. The free AI on this site is kept for questions.',
      },
      { status: 402 },
    );
  try {
    if (!(await allowRequest(request, 'update-draft', SUMMARIES_PER_HOUR)))
      return Response.json(
        { error: 'Summary limit for this hour reached. Try again later.' },
        { status: 429, headers: { 'Retry-After': '900' } },
      );
    const leads = await leadsToDraft({ ids, limit: SUMMARISE_AT_ONCE });
    const outcome = await draftLeads(leads, byokAsk(reader.key), {
      model: byokModelLabel(reader.key),
      budgetMs: BUDGET_MS,
    });
    return Response.json({
      drafted: outcome.drafted,
      unusable: outcome.unusable,
      couldNotRead: outcome.couldNotRead,
      stopped: outcome.stopped,
      leads: await openLeads({ ids }),
    });
  } catch (error) {
    // The message only — never the request, which may carry the key.
    console.error('summarise failed', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'The summary could not run just now.' }, { status: 503 });
  }
}
