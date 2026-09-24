import { availableModels, isOfferedModel } from '@/lib/chat/models';
import type { ChatTurn } from '@/lib/chat/types';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';
import { isValidByokConfig, type ByokConfig } from '@/lib/byok';
import { runAgent, type AgentEvent } from '@/lib/chat-agent/loop';
import { byokTurn, freeLinks, streamedTurn } from '@/lib/chat-agent/turn';
import { readerContext } from '@/lib/chat-context';
import { lookUp, webLookupEnabled } from '@/lib/chat-web';
import { currentSession } from '@/lib/auth';
import { database } from '@/lib/db';
import { parseFollows, type Follows } from '@/lib/follows';
import { searchLeads } from '@/lib/sweep-queue';

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

/** The signed-in reader's follows, or null. A failure here costs context, never the answer. */
async function followsOf(): Promise<Follows | null> {
  const session = await currentSession();
  if (!session?.actorId || !process.env.DATABASE_URL) return null;
  try {
    const row = await database().query<{ topics: unknown }>(
      'SELECT topics FROM research_preferences WHERE actor_id=$1',
      [session.actorId],
    );
    return parseFollows(row.rows[0]?.topics);
  } catch {
    return parseFollows(undefined);
  }
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
    const topicRaw = (input as { topic?: unknown })?.topic;
    const topic = typeof topicRaw === 'string' ? topicRaw.slice(0, 200) : undefined;
    const context = readerContext({ path: onPath, topic, follows: await followsOf() });
    // The free tier's budgets are small and shared; a reader's own frontier
    // key is metered by nobody but them, so it gets room to think.
    const limits = byok
      ? { maxTokens: 4096, timeoutMs: 60_000, signal: request.signal }
      : { maxTokens: 1800, timeoutMs: 25_000, signal: request.signal };
    const turn = byok
      ? byokTurn(byok, limits)
      : streamedTurn({
          chain: freeLinks(model),
          ...limits,
          extraHeaders: {
            'HTTP-Referer': 'https://substrata.orangecat.ch',
            'X-Title': 'Substrata',
          },
        });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: AgentEvent) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            // The reader went away; the loop notices through the signal.
          }
        };
        try {
          await runAgent({
            question,
            history,
            context,
            turn,
            byok,
            emit: send,
            env: {
              signal: request.signal,
              rails:
                context.reader && !context.reader.everything ? context.reader.rails : undefined,
              leads: process.env.DATABASE_URL ? (q) => searchLeads(q) : undefined,
              web: webLookupEnabled() ? (query, signal) => lookUp(query, signal) : undefined,
            },
          });
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
          try {
            controller.close();
          } catch {
            // already closed
          }
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
