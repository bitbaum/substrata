import { assistantScope } from '@/lib/chat-agent/prompt';
import { bearerMatches, exportWindow, readTranscripts } from '@/lib/chat-review/export';

export const dynamic = 'force-dynamic';

/**
 * The day's Ask conversations for Loki's nightly chat review (chatkit 0.14,
 * `ChatTranscript[]`). Bearer `CHAT_REVIEW_TOKEN`, the one value shared by
 * every app on the box; refused with 503 while it is unset so a deployment
 * without the secret exports nothing rather than everything.
 */
export async function GET(request: Request) {
  const token = process.env.CHAT_REVIEW_TOKEN;
  if (!token) return Response.json({ error: 'Chat review is not configured.' }, { status: 503 });
  if (!bearerMatches(request.headers.get('authorization'), token))
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  if (!process.env.DATABASE_URL)
    return Response.json({ error: 'No database on this deployment.' }, { status: 503 });
  const { since, limit } = exportWindow(new URL(request.url).searchParams);
  try {
    const transcripts = await readTranscripts(since, limit);
    return Response.json(
      { product: 'substrata', scope: assistantScope(), transcripts },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('chat review export failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Export failed.' }, { status: 503 });
  }
}
