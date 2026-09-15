import { randomUUID } from 'node:crypto';
import { auth } from '@/lib/auth';
import { database } from '@/lib/db';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  let input: Record<string, unknown>;
  try {
    const body = await boundedJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    input = body as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (
    typeof input.message !== 'string' ||
    input.message.trim().length < 10 ||
    input.message.length > 12000 ||
    input.consent !== true
  )
    return Response.json(
      { error: 'Add at least 10 characters and confirm that you want to send your contribution.' },
      { status: 400 },
    );
  const topic = typeof input.topic === 'string' ? input.topic.slice(0, 200) : '';
  const email = typeof input.replyTo === 'string' ? input.replyTo.trim() : '';
  const credit = typeof input.creditName === 'string' ? input.creditName.trim().slice(0, 120) : '';
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    return Response.json({ error: 'Please check the reply email address.' }, { status: 400 });
  try {
    if (!(await allowRequest(request, 'contribution', 8)))
      return Response.json(
        { error: 'Hourly contribution limit reached. Please try again later.' },
        { status: 429 },
      );
    const session = await auth();
    const id = randomUUID();
    await database().query(
      'INSERT INTO research_contributions(id,actor_id,message,topic,reply_to,credit_name) VALUES($1,$2,$3,$4,$5,$6)',
      [id, session?.actorId ?? null, input.message.trim(), topic, email || null, credit || null],
    );
    return Response.json(
      { success: true, data: { receipt: id, status: 'received' } },
      { status: 201 },
    );
  } catch {
    return Response.json(
      { error: 'Your contribution could not be saved. It has not been delivered; please retry.' },
      { status: 503 },
    );
  }
}
