import { currentSession } from '@/lib/auth';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';
import { UPDATE_NOW_COOLDOWN_HOURS, sweepStaleNow } from '@/lib/sweep-store';
import { UPDATES_PER_HOUR, openLeads, parseScope, scopeNames } from '@/lib/update-now';

export const dynamic = 'force-dynamic';
/** A few web searches side by side; the sweep's own timeouts bound it well inside this. */
export const maxDuration = 60;

/**
 * "Update news now", step one: sweep the web for this page's bottlenecks and
 * return the open leads. No model is called, so it is open to every reader,
 * signed out too — rate-limited per visitor, and each bottleneck is swept at
 * most once per cooldown however many people press it.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  let input: unknown;
  try {
    input = await boundedJson(request);
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  const scope = parseScope((input as { scope?: unknown } | null)?.scope);
  if (!scope) return Response.json({ error: 'Nothing to update.' }, { status: 400 });
  const session = scope.kind === 'desk' ? await currentSession() : null;
  try {
    const names = await scopeNames(scope, session?.actorId ?? null);
    if (!names) return Response.json({ error: 'Nothing to update.' }, { status: 404 });
    if (!(await allowRequest(request, 'update-now', UPDATES_PER_HOUR)))
      return Response.json(
        { error: 'You have updated a lot this hour. The news will still be here shortly.' },
        { status: 429, headers: { 'Retry-After': '900' } },
      );
    const sweep = await sweepStaleNow(names, { cooldownHours: UPDATE_NOW_COOLDOWN_HOURS });
    const leads = await openLeads({ names });
    return Response.json({
      covered: names.length,
      swept: sweep.swept.length,
      found: sweep.found,
      couldNotLook: sweep.couldNotLook,
      cooldownMinutes: UPDATE_NOW_COOLDOWN_HOURS * 60,
      leads,
    });
  } catch (error) {
    console.error('update-now failed', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'The update could not run just now.' }, { status: 503 });
  }
}
