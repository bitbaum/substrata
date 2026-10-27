import { availableModels, isOfferedModel } from '@/lib/chat/models';
import type { ChatTurn } from '@/lib/chat/types';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';
import { readerKey } from '@/lib/reader-key';
import { runAgent, type AgentEvent } from '@/lib/chat-agent/loop';
import { byokTurn, freeCooldown, freeLinks, streamedTurn } from '@/lib/chat-agent/turn';
import { verifyFromBody } from '@/lib/chat-agent/verify';
import { isAnalysis } from '@/lib/chat-agent/route';
import { readerContext } from '@/lib/chat-context';
import { lookUp, readSource, webLookupEnabled } from '@/lib/chat-web';
import { currentSession } from '@/lib/auth';
import { FREE_QUESTIONS_PER_DAY, record } from '@/lib/ai-budget';
import { recordAskTiming, timingOf } from '@/lib/ask-timing';
import { chatTurnLog, uuidOrNull } from '@/lib/chat-review/log';
import { database } from '@/lib/db';
import { parseFollows, type Follows } from '@/lib/follows';
import { searchLeads } from '@/lib/sweep-queue';
import { openJobs } from '@/lib/careers-query';
import { filingsFor } from '@/lib/filings-store';
import { itemsFor } from '@/lib/science-read';
import { SITE } from '@/lib/site';
import { QUESTION_LENGTH } from '@/config/substrata-chat';
import { CHAT_BODY_BYTES, readAttachedText, readImages } from '@/lib/chat/image';
import { bringsMaterial } from '@/lib/chat-agent/read-claims';
import { runClaimCheck } from '@/lib/chat-agent/claim-check';

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
    input = await boundedJson(request, CHAT_BODY_BYTES);
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
  // `isOfferedModel` only knows this deployment's free chain. The key arrives
  // in the body (held in the reader's browser) or, signed in, is opened from
  // the vault for this one request.
  const reader = await readerKey(input);
  if ('error' in reader) return Response.json({ error: reader.error }, { status: 400 });
  const byok = reader.key ?? undefined;
  // Pictures (validated data URLs, never stored) and attached text files (lib/chat/image.ts).
  const pictures = readImages((input as { images?: unknown })?.images);
  if (!pictures.ok) return Response.json({ error: pictures.error }, { status: 400 });
  const images = pictures.images;
  const attached = readAttachedText((input as { attached?: unknown })?.attached);
  const verify = verifyFromBody((input as { verify?: unknown })?.verify);
  if (verify === 'invalid')
    return Response.json({ error: 'Invalid claim to check.' }, { status: 400 });
  // Refuse rather than silently fall back: a caller naming a model we do not
  // offer is either out of date or probing, and both deserve a straight answer.
  if (!byok && !isOfferedModel(model))
    return Response.json({ error: 'Unknown model.' }, { status: 400 });
  if (
    !verify &&
    (typeof question !== 'string' ||
      question.trim().length < QUESTION_LENGTH.min ||
      question.length > QUESTION_LENGTH.max)
  )
    return Response.json(
      {
        error: `Ask a question between ${QUESTION_LENGTH.min} and ${QUESTION_LENGTH.max.toLocaleString('en')} characters.`,
      },
      { status: 400 },
    );
  try {
    if (!(await allowRequest(request, 'chat', 30)))
      return Response.json(
        { error: 'Hourly question limit reached. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '3600' } },
      );
    // The free models are a small daily pool shared with the other apps on
    // the box, so one visitor must not be able to spend it. A reader's own
    // key is theirs to spend and is not capped here.
    if (!byok && !(await allowRequest(request, 'chat-day', FREE_QUESTIONS_PER_DAY, 24)))
      return Response.json(
        {
          error:
            "You have used today's free questions. Add your own AI key in the Ask panel to keep going, or come back tomorrow.",
        },
        { status: 429, headers: { 'Retry-After': '3600' } },
      );
    const topicRaw = (input as { topic?: unknown })?.topic;
    const topic = typeof topicRaw === 'string' ? topicRaw.slice(0, 200) : undefined;
    const context = readerContext({ path: onPath, topic, follows: await followsOf() });
    // The free tier's budgets are small and shared; a reader's own frontier
    // key is metered by nobody but them, so it gets room to think.
    // Research mode writes six sections (research.ts): more room, same caps otherwise.
    const material =
      typeof question === 'string' && !verify && bringsMaterial({ question, images, attached });
    const analysis = typeof question === 'string' && !verify && (material || isAnalysis(question));
    const limits = byok
      ? { maxTokens: analysis ? 6000 : 4096, timeoutMs: 60_000, signal: request.signal }
      : // 1800 cut answers mid-word once reasoning took its share (2026-10-02).
        {
          maxTokens: analysis ? 3600 : 2400,
          timeoutMs: analysis ? 40_000 : 25_000,
          signal: request.signal,
        };
    const turn = byok
      ? byokTurn(byok, limits)
      : streamedTurn({
          chain: freeLinks(model),
          cooldown: freeCooldown,
          reasoning: 'light',
          // Measured 2026-09-25: Groq answers in <1 s, the OpenRouter link that
          // works takes 3-7 s, and one that has shown nothing by 9 s was (in
          // the timing log) hung or thinking into an empty reply — 38 s lost.
          firstTokenMs: 9_000,
          // A reader's question is the priority class; recorded so /data can
          // show it beside background spend. Their own key is not our budget.
          onSpend: (tokens) => void record('interactive', tokens),
          ...limits,
          extraHeaders: {
            'HTTP-Referer': SITE.url,
            'X-Title': 'Substrata',
          },
        });
    // The review log: ids the browser minted for the thread and this answer
    // (lib/chat-review/log.ts), so a thumb later finds the turn it is about.
    const log = chatTurnLog({
      conversationId: uuidOrNull((input as { conversationId?: unknown })?.conversationId),
      messageId: uuidOrNull((input as { messageId?: unknown })?.messageId),
      // A picture is never logged; that one came is.
      question: `${typeof question === 'string' ? question : (verify?.claim ?? '')}${images.length ? ` [${images.length} picture(s) attached]` : ''}${attached ? ' [text attached]' : ''}`,
      surface: onPath,
    });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const asked = Date.now();
        const send = (event: AgentEvent) => {
          log.observe(event);
          if (event.type === 'done')
            void recordAskTiming(timingOf(event.data), event.data.timing?.skipped);
          if (event.type === 'error' && event.kind !== 'byok')
            void recordAskTiming({
              outcome: 'error',
              totalMs: Date.now() - asked,
              calls: 0,
              planned: 0,
              fallbacks: 0,
            });
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            // The reader went away; the loop notices through the signal.
          }
        };
        try {
          await (material ? runClaimCheck : runAgent)({
            images,
            attached,
            question: typeof question === 'string' ? question : '',
            history,
            verify,
            context,
            turn,
            byok,
            replies: true,
            emit: send,
            env: {
              signal: request.signal,
              rails:
                context.reader && !context.reader.everything ? context.reader.rails : undefined,
              leads: process.env.DATABASE_URL ? (q) => searchLeads(q) : undefined,
              jobs: process.env.DATABASE_URL ? (f, limit) => openJobs(f, limit) : undefined,
              science: process.env.DATABASE_URL
                ? (b, limit) => itemsFor(b, null, limit)
                : undefined,
              filings: process.env.DATABASE_URL
                ? (ciks, days) => filingsFor(ciks, days)
                : undefined,
              // onRead: "Reading <site>…" in the reader's steps (it was dropped here before).
              web: webLookupEnabled()
                ? (query, signal, onRead) => lookUp(query, signal, process.env, undefined, onRead)
                : undefined,
              read: (url, claim, signal) => readSource(url, claim, signal),
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
