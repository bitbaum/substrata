import { answerQuestion, type ChatTurn } from '@/lib/chat';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  let input: unknown;
  try {
    input = await boundedJson(request);
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  const question = (input as { question?: unknown })?.question;
  const rawHistory = (input as { history?: unknown })?.history;
  const history: ChatTurn[] = Array.isArray(rawHistory)
    ? rawHistory
        .slice(-4)
        .filter(
          (t): t is ChatTurn =>
            !!t &&
            (t.role === 'user' || t.role === 'assistant') &&
            typeof t.content === 'string' &&
            t.content.length <= 4000,
        )
    : [];
  if (typeof question !== 'string' || question.trim().length < 3 || question.length > 4000)
    return Response.json(
      { error: 'Ask a question between 3 and 4,000 characters.' },
      { status: 400 },
    );
  try {
    if (!(await allowRequest(request, 'chat', 30)))
      return Response.json(
        { error: 'Hourly question limit reached. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '3600' } },
      );
    return Response.json({
      success: true,
      data: await answerQuestion(question, request.signal, history),
    });
  } catch (error) {
    console.error('Substrata chat unavailable', error instanceof Error ? error.name : 'unknown');
    return Response.json(
      {
        error:
          'The assistant is temporarily unavailable. You can still search the research or send a contribution.',
      },
      { status: 503 },
    );
  }
}
