import { answerQuestion, availableModels, type ChatTurn } from '@/lib/chat';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';

function turns(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-8)
    .filter(
      (t): t is ChatTurn =>
        !!t &&
        (t.role === 'user' || t.role === 'assistant') &&
        typeof t.content === 'string' &&
        t.content.length <= 4000,
    );
}

export async function GET() {
  return Response.json({ models: availableModels() });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  let input: unknown;
  try {
    input = await boundedJson(request);
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  const question = (input as { question?: unknown })?.question;
  const history = turns((input as { history?: unknown })?.history);
  const modelRaw = (input as { model?: unknown })?.model;
  const model = typeof modelRaw === 'string' && modelRaw.length < 120 ? modelRaw : 'auto';
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
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        try {
          const data = await answerQuestion(question, request.signal, history, model);
          send({ type: 'done', data });
        } catch (error) {
          console.error(
            'Substrata chat unavailable',
            error instanceof Error ? error.name : 'unknown',
          );
          send({
            type: 'error',
            error:
              'The assistant is temporarily unavailable. You can still search the research or send a contribution.',
          });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
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
