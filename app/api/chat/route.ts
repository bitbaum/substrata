import { answerQuestion, availableModels, isOfferedModel, type ChatTurn } from '@/lib/chat';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';
import { ByokError, isValidByokConfig, type ByokConfig } from '@/lib/byok';

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
  // The page the reader is on. Bounded and required to be a local path: it
  // reaches retrieval, so it may not be an arbitrary string.
  const pathRaw = (input as { onPath?: unknown })?.onPath;
  const onPath =
    typeof pathRaw === 'string' && pathRaw.startsWith('/') && pathRaw.length <= 300
      ? pathRaw
      : undefined;
  const modelRaw = (input as { model?: unknown })?.model;
  const model = typeof modelRaw === 'string' && modelRaw.length < 120 ? modelRaw : 'auto';
  // A reader's own key names its own model, from a vendor's own catalogue —
  // `isOfferedModel` only knows this deployment's free chain, so it has
  // nothing to say about a BYOK request and must not be asked to.
  const byokRaw = (input as { byok?: unknown })?.byok;
  let byok: ByokConfig | undefined;
  if (byokRaw !== undefined && byokRaw !== null) {
    if (!isValidByokConfig(byokRaw))
      return Response.json({ error: 'Invalid key configuration.' }, { status: 400 });
    byok = byokRaw;
  }
  // Refuse rather than silently fall back: a caller naming a model we do not
  // offer is either out of date or probing, and both deserve a straight answer.
  if (!byok && !isOfferedModel(model))
    return Response.json({ error: 'Unknown model.' }, { status: 400 });
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
          const data = await answerQuestion(question, request.signal, history, model, onPath, {
            byok,
          });
          send({ type: 'done', data });
        } catch (error) {
          console.error(
            'Substrata chat unavailable',
            error instanceof Error ? error.name : 'unknown',
          );
          // A BYOK failure is the vendor talking to the reader, not this
          // deployment breaking — "your key was rejected" is information the
          // reader can act on, and burying it behind "temporarily
          // unavailable" would send them to check OUR status page for a
          // problem that is on their own account.
          send({
            type: 'error',
            error:
              error instanceof ByokError
                ? error.message
                : 'The assistant is temporarily unavailable. You can still search the research or send a contribution.',
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
