/**
 * "Use my rails": add the bottlenecks an X-ray found to the reader's desk.
 *
 * Receives bottleneck slugs only — the rails, never the holdings that led to
 * them — and merges them into the reader's follows through the same parser
 * every other desk write goes through.
 */
import { currentSession } from '@/lib/auth';
import { bottleneckBySlug } from '@/lib/bottlenecks';
import { updateFollows } from '@/lib/desk-store';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  const session = await currentSession();
  if (!session?.actorId)
    return Response.json({ error: 'Sign in to add rails to your desk.' }, { status: 401 });
  try {
    if (!(await allowRequest(request, 'follow', 120)))
      return Response.json({ error: 'Too many changes. Try again later.' }, { status: 429 });
  } catch {
    return Response.json({ error: 'The desk is not available yet.' }, { status: 503 });
  }
  let slugs: string[];
  try {
    const body = (await boundedJson(request)) as { slugs?: unknown };
    if (!Array.isArray(body.slugs)) throw new Error('no slugs');
    slugs = body.slugs.filter(
      (s): s is string => typeof s === 'string' && Boolean(bottleneckBySlug(s)),
    );
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (slugs.length === 0) return Response.json({ error: 'No known bottleneck.' }, { status: 400 });
  const next = await updateFollows(session.actorId, (current) => ({
    ...current,
    bottlenecks: [...new Set([...current.bottlenecks, ...slugs])],
    muted: current.muted.filter((m) => !slugs.includes(m)),
  }));
  return Response.json({ success: true, added: slugs.length, following: next.bottlenecks.length });
}
