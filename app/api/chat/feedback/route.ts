import { feedbackSchema, storeFeedback } from '@/lib/chat-review/feedback';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';

/**
 * A thumb under an Ask answer (chatkit's `onFeedback`). Same gate as
 * /api/chat — the page's own origin, rate limited per IP — and nothing about
 * the reader is kept: the ids are the random ones the thread already uses.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  let input: unknown;
  try {
    input = await boundedJson(request);
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: 'Invalid feedback.' }, { status: 400 });
  try {
    if (!(await allowRequest(request, 'chat-feedback', 60)))
      return Response.json({ error: 'Too many, please try later.' }, { status: 429 });
    await storeFeedback(parsed.data);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('chat feedback failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Could not keep that just now.' }, { status: 503 });
  }
}
