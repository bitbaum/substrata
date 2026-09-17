import { currentSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { parseFollows } from '@/lib/follows';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  const session = await currentSession();
  if (!session?.actorId) return Response.json({ error: 'Sign in to follow.' }, { status: 401 });
  // Every other authenticated write is throttled; this one was not, and it is a
  // read-modify-write on a row the caller controls.
  try {
    if (!(await allowRequest(request, 'follow', 120)))
      return Response.json({ error: 'Too many changes. Try again later.' }, { status: 429 });
  } catch {
    return Response.json({ error: 'Following is not available yet.' }, { status: 503 });
  }
  let input: { type?: string; id?: string; on?: boolean };
  try {
    input = (await boundedJson(request)) as { type?: string; id?: string; on?: boolean };
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  const type = input.type;
  const id = input.id;
  const on = Boolean(input.on);
  if ((type !== 'company' && type !== 'technology') || typeof id !== 'string') {
    return Response.json({ error: 'Bad follow.' }, { status: 400 });
  }
  if (type === 'company' && !MARKET_PARTICIPANTS.some((p) => p.slug === id)) {
    return Response.json({ error: 'Unknown company.' }, { status: 400 });
  }
  if (type === 'technology' && !TECHNOLOGIES.some((t) => t.id === id)) {
    return Response.json({ error: 'Unknown technology.' }, { status: 400 });
  }
  const row = await database().query<{ topics: unknown }>(
    'SELECT topics FROM research_preferences WHERE actor_id=$1',
    [session.actorId],
  );
  const follows = parseFollows(row.rows[0]?.topics);
  if (type === 'company') {
    follows.companies = on
      ? [...new Set([...follows.companies, id])]
      : follows.companies.filter((c) => c !== id);
  } else {
    const next = on ? [...follows.technologies, id] : follows.technologies.filter((t) => t !== id);
    follows.technologies = parseFollows({ ...follows, technologies: next }).technologies;
  }
  await database().query(
    'INSERT INTO research_preferences(actor_id,topics) VALUES($1,$2) ON CONFLICT(actor_id) DO UPDATE SET topics=$2,updated_at=now()',
    [session.actorId, JSON.stringify(follows)],
  );
  return Response.json({ success: true, data: follows });
}
