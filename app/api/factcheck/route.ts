import { currentSession } from '@/lib/auth';
import { record } from '@/lib/ai-budget';
import { runAgentToAnswer } from '@/lib/chat-agent/loop';
import { freeCooldown, freeLinks, streamedTurn } from '@/lib/chat-agent/turn';
import { readerContext } from '@/lib/chat-context';
import { lookUp, readSource, webLookupEnabled } from '@/lib/chat-web';
import { addMessage } from '@/lib/page-thread';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';
import { allLearn, allNotes } from '@/lib/notes';

export const dynamic = 'force-dynamic';

/**
 * Ask the assistant to check an article, and post the result into its thread.
 *
 * This writes to the same public thread a human needs an account to post in,
 * and every call spends model budget. `page-thread.ts` only enforces `canWrite`
 * for human authors, so the `ai` author kind is not a second gate — this one is
 * the gate. Unauthenticated, it let any visitor post machine-written comments
 * on every article, permanently, and bill us for the privilege.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  const session = await currentSession();
  if (!session?.actorId)
    return Response.json({ error: 'Sign in to ask for a fact-check.' }, { status: 401 });
  let input: { path?: string };
  try {
    input = (await boundedJson(request)) as { path?: string };
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  const path = input.path ?? '';
  const note = path.startsWith('/notes/')
    ? allNotes().find((n) => path === `/notes/${n.slug}`)
    : path.startsWith('/learn/')
      ? allLearn().find((n) => path === `/learn/${n.slug}`)
      : undefined;
  if (!note) return Response.json({ error: 'No article at that path.' }, { status: 404 });
  const question = `Fact-check the article on this page, "${note.title}" (summary: ${note.summary}). Look up the records it relies on. For each claim that matters, say whether the corpus supports it and with what evidence state (Sourced, Candidate source, Unverified lead, analyst judgement); flag any claim nothing supports. Quote the deciding row or passage and link it. Do not invent sources.`;
  try {
    // Inside the try: `allowRequest` throws when AUTH_SECRET is unset, and this
    // route should answer 503 like the rest of the file rather than a raw 500.
    if (!(await allowRequest(request, 'factcheck', 20)))
      return Response.json({ error: 'Hourly fact-check limit reached.' }, { status: 429 });
    // The same agent loop as Ask — the same tools, the same honesty rules and
    // the same records-read list — rather than a second, weaker retrieval path.
    // Web material, where it is used, arrives labelled as unchecked.
    const data = await runAgentToAnswer({
      question,
      history: [],
      context: readerContext({ path, follows: null }),
      turn: streamedTurn({
        chain: freeLinks('auto'),
        cooldown: freeCooldown,
        onSpend: (tokens) => void record('interactive', tokens),
        maxTokens: 1800,
        timeoutMs: 25_000,
        signal: request.signal,
      }),
      env: {
        signal: request.signal,
        web: webLookupEnabled() ? (q, signal) => lookUp(q, signal) : undefined,
        read: (url, claim, signal) => readSource(url, claim, signal),
      },
    });
    // A "budget is used up" notice is not a fact-check; it never goes into the
    // public thread as one.
    if (!data.degraded)
      try {
        await addMessage(path, 'substrata-factcheck', data.answer.slice(0, 8000), 'ai');
      } catch {
        /* table may not exist yet; still return the check */
      }
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('factcheck unavailable', error instanceof Error ? error.name : 'unknown');
    return Response.json(
      { error: 'Fact-check is temporarily unavailable. The assistant may be unconfigured.' },
      { status: 503 },
    );
  }
}
