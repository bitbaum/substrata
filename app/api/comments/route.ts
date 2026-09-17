import { currentSession } from '@/lib/auth';
import { addMessage, loadMessages, publicMessages } from '@/lib/page-thread';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path') ?? '';
  if (!path.startsWith('/')) return Response.json({ error: 'Bad path' }, { status: 400 });
  try {
    const messages = publicMessages(path, await loadMessages(path));
    return Response.json({
      data: messages.map((m) => ({
        id: m.id,
        authorId: m.authorId,
        body: m.body,
        createdAt: m.createdAt,
      })),
    });
  } catch {
    return Response.json({ data: [] });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  const session = await currentSession();
  if (!session?.actorId) return Response.json({ error: 'Sign in to comment.' }, { status: 401 });
  try {
    // `allowRequest` throws when AUTH_SECRET is unset; answer like the rest of
    // the file instead of surfacing a Next.js digest.
    if (!(await allowRequest(request, 'comment', 20)))
      return Response.json({ error: 'Hourly comment limit reached.' }, { status: 429 });
  } catch {
    return Response.json({ error: 'Comments are not available yet.' }, { status: 503 });
  }
  let input: { path?: string; body?: string };
  try {
    input = (await boundedJson(request)) as { path?: string; body?: string };
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (
    !input.path?.startsWith('/') ||
    typeof input.body !== 'string' ||
    input.body.trim().length < 3
  )
    return Response.json({ error: 'Write a short comment.' }, { status: 400 });
  try {
    const saved = await addMessage(
      input.path,
      session.actorId,
      input.body.trim().slice(0, 4000),
      'human',
    );
    return Response.json({ success: true, data: saved });
  } catch (error) {
    console.error('comment write failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Comments are not available yet.' }, { status: 503 });
  }
}
