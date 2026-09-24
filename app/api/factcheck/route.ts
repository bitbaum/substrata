import { currentSession } from '@/lib/auth';
import { answerQuestion } from '@/lib/chat/answer';
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
  const question = `Fact-check this Substrata article against the research corpus. Title: ${note.title}. Summary: ${note.summary}. Flag any claim that is not supported, and distinguish sourced findings from judgements. Do not invent sources.`;
  try {
    // Inside the try: `allowRequest` throws when AUTH_SECRET is unset, and this
    // route should answer 503 like the rest of the file rather than a raw 500.
    if (!(await allowRequest(request, 'factcheck', 20)))
      return Response.json({ error: 'Hourly fact-check limit reached.' }, { status: 429 });
    // A fact-check is corpus-only by definition: the ladder that lets the
    // reader's assistant answer from the open web or from background would let
    // this one defend an article with material the records do not hold.
    const data = await answerQuestion(question, request.signal, [], 'auto', undefined, {
      allowOutside: false,
    });
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
