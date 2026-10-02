import {
  ChainExhaustedError,
  looksLikeSilence,
  speechChain,
  speechConfigured,
  transcribe,
} from '@bitbaum/ai-kit';
import { allowRequest, sameOrigin } from '@/lib/request-guards';

export const dynamic = 'force-dynamic';

/**
 * The microphone's server leg, for chatkit's Composer (`voice.transcribeUrl`).
 *
 * The browser's own recogniser is tried first; where it is missing (Firefox)
 * or accepts `start()` and then says nothing (Chromium without Google's speech
 * service), chatkit records and sends the audio here. Ask had no such route,
 * so on those browsers its Dictate button could only fail.
 *
 * Narrow on purpose: it transcribes and returns the words — it does not answer,
 * translate or store anything; the audio lives for one request. The chain and
 * the silence guard are ai-kit's (`speechChain`, `looksLikeSilence`), shared
 * with every app that has a microphone. A reader dictating is a reader acting,
 * not a background job; it is rate limited per address all the same.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
/** Dictations per address per hour: a person talking, not a pipeline. */
const PER_HOUR = 60;

function refuse(error: string, status: number, operator = false) {
  return Response.json({ error, operator }, { status });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return refuse('Origin not allowed', 403);
  if (!speechConfigured(process.env)) return refuse('transcription is not configured', 503, true);
  if (!(await allowRequest(request, 'transcribe', PER_HOUR)))
    return refuse('Too many recordings this hour. Please type instead for now.', 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refuse('expected an audio upload', 400);
  }
  const audio = form.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) return refuse('expected an audio upload', 400);
  if (audio.size > MAX_BYTES) return refuse('that recording is too long', 413);
  const locale = form.get('locale');

  try {
    const result = await transcribe({
      audio,
      // Whisper reads the container from the name; browsers record webm.
      filename: 'dictation.webm',
      language: typeof locale === 'string' ? locale : undefined,
      chain: speechChain(),
      timeoutMs: TIMEOUT_MS,
      signal: request.signal,
    });
    const said = result.text.trim();
    // Whisper answers silence with a subtitle credit or "Thank you."; typing
    // that into the reader's question would put words in their mouth.
    return Response.json({ text: looksLikeSilence(said) ? '' : said });
  } catch (error) {
    console.warn(
      'Substrata transcribe failed',
      error instanceof ChainExhaustedError
        ? error.failures.map((f) => f.message.slice(0, 120)).join(' | ')
        : error instanceof Error
          ? error.name
          : 'unknown',
    );
    return refuse('transcription is not available right now', 502, true);
  }
}
