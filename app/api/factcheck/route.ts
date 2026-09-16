import { answerQuestion } from '@/lib/chat';
import { addMessage } from '@/lib/page-thread';
import { allowRequest, boundedJson, sameOrigin } from '@/lib/request-guards';
import { allLearn, allNotes } from '@/lib/notes';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  if (!(await allowRequest(request, 'factcheck', 20)))
    return Response.json({ error: 'Hourly fact-check limit reached.' }, { status: 429 });
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
    const data = await answerQuestion(question, request.signal);
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
