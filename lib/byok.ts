/**
 * Bring your own key.
 *
 * The free chain (`freeChain('SUBSTRATA')`) exists so the assistant works for
 * a reader who has done nothing. It is deliberately the bottom of the
 * capability ladder: small models, rationed daily, chosen because they cost
 * this deployment nothing. A reader who supplies their own key to a frontier
 * vendor is not that reader, and should not be served the same way.
 *
 * Three vendors, fixed, not a free-form base URL:
 *
 *   openai      — OpenAI's own API, OpenAI chat-completions shape.
 *   openrouter  — one key, most frontier models (Anthropic, OpenAI, Google,
 *                 xAI, …) behind it, same OpenAI chat-completions shape.
 *   anthropic   — Anthropic's native Messages API, which is NOT the OpenAI
 *                 shape every provider in ai-kit's chain speaks, so it is
 *                 called directly here rather than forced through `complete`.
 *
 * A closed list rather than a caller-supplied base URL is the point: this
 * server makes the outbound request on the reader's behalf, and an arbitrary
 * URL there is a standing SSRF invitation with the reader's own bearer token
 * attached. Three named vendors is a feature request away from four; a fourth
 * base URL from the browser is a vulnerability.
 *
 * THE KEY IS NEVER PERSISTED. It arrives on the request, is held only for the
 * lifetime of that request's completion call, and is never written to a log,
 * a database row, or an error reported upstream (`ByokError` messages are
 * built from the vendor's own response, not from the request that produced
 * it). Where it lives BETWEEN requests is the reader's own browser — this
 * module has no opinion on that and no code path that could persist it even
 * by accident.
 */
import { complete, type ChatMessage, type Env, type Provider } from '@bitbaum/ai-kit';
import { BYOK_PROVIDER_LABEL, ByokError, type ByokConfig } from './byok-shared';

// The vendor list, types and validation have no server-only dependency and
// live in `byok-shared.ts` so a client component can import them without
// pulling this file's `@bitbaum/ai-kit` import into the browser bundle.
// Re-exported here so server code — which also needs `completeByok` — keeps
// one import.
export * from './byok-shared';

const OPENAI_COMPATIBLE: Record<'openai' | 'openrouter', string> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

/** Text out of a message, dropping image parts — this assistant sends text only. */
function textOf(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

async function completeOpenAiCompatible(
  config: ByokConfig,
  messages: ChatMessage[],
  opts: { maxTokens: number; timeoutMs: number; signal?: AbortSignal },
): Promise<{ text: string }> {
  const baseUrl = OPENAI_COMPATIBLE[config.provider as 'openai' | 'openrouter'];
  // A one-entry env, scoped to this call — never `process.env`, so the key
  // cannot leak into any OTHER caller that happens to read the same object.
  const keyEnv = 'SUBSTRATA_BYOK_KEY';
  const env: Env = { [keyEnv]: config.apiKey };
  const provider: Provider = {
    id: config.provider,
    baseUrl,
    keyEnv,
    models: [config.model],
    // Required by the type but meaningless here: `dailyTokens` feeds the
    // fair-share rationing this call never goes through — a reader's own key
    // is metered by their own vendor account, not by anything in this repo.
    dailyTokens: Number.POSITIVE_INFINITY,
    ...(config.provider === 'openrouter'
      ? {
          routed: true,
          // OpenRouter reads these for its public attribution page; sending
          // them is free and is the polite thing to do on someone else's key.
        }
      : {}),
  };
  try {
    const result = await complete({
      chain: [{ provider, model: config.model }],
      env,
      messages,
      maxTokens: opts.maxTokens,
      timeoutMs: opts.timeoutMs,
      signal: opts.signal,
      ...(config.provider === 'openrouter'
        ? {
            extraHeaders: {
              'HTTP-Referer': 'https://substrata.orangecat.ch',
              'X-Title': 'Substrata',
            },
          }
        : {}),
    });
    return { text: result.text };
  } catch (err) {
    throw new ByokError(
      config.provider,
      err instanceof Error ? err.message : `${BYOK_PROVIDER_LABEL[config.provider]} call failed.`,
    );
  }
}

/** Anthropic's Messages API — a different shape, called directly. */
async function completeAnthropic(
  config: ByokConfig,
  messages: ChatMessage[],
  opts: { maxTokens: number; timeoutMs: number; signal?: AbortSignal },
): Promise<{ text: string }> {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => textOf(m.content))
    .join('\n\n');
  const rest = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: textOf(m.content) }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: opts.maxTokens,
        ...(system ? { system } : {}),
        messages: rest,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    throw new ByokError(
      'anthropic',
      timedOut
        ? 'Anthropic did not answer in time.'
        : `Could not reach Anthropic (${err instanceof Error ? err.message : String(err)}).`,
    );
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }

  const body = (await response.json().catch(() => null)) as {
    content?: { type?: string; text?: string }[];
    error?: { message?: string; type?: string };
  } | null;

  if (!response.ok) {
    const detail = body?.error?.message ?? `HTTP ${response.status}`;
    const message =
      response.status === 401
        ? 'Anthropic rejected that key.'
        : response.status === 404
          ? `Anthropic does not recognise the model "${config.model}".`
          : response.status === 429
            ? 'Anthropic is rate-limiting that key right now.'
            : `Anthropic error: ${detail}`;
    throw new ByokError('anthropic', message);
  }

  const text = (body?.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('');
  if (!text) throw new ByokError('anthropic', 'Anthropic returned an empty reply.');
  return { text };
}

/**
 * One entry point for both shapes. Returns just the text, because that is all
 * `answerQuestion` ever reads off a completion — the free-chain path and this
 * one share a call site rather than two copies of the calling code.
 */
export async function completeByok(
  config: ByokConfig,
  messages: ChatMessage[],
  opts: { maxTokens: number; timeoutMs: number; signal?: AbortSignal },
): Promise<{ text: string }> {
  return config.provider === 'anthropic'
    ? completeAnthropic(config, messages, opts)
    : completeOpenAiCompatible(config, messages, opts);
}
