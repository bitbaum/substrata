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
import Anthropic from '@anthropic-ai/sdk';
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

/**
 * Anthropic's Messages API — a different shape from every other vendor in
 * this file, so it goes through Anthropic's own SDK rather than being forced
 * through `complete()` or hand-rolled against `fetch`.
 *
 * A hand-rolled client was the first version of this function, and it is
 * exactly the pattern `@bitbaum/ai-kit`'s own `complete.ts` argues against
 * for the OpenAI-shaped vendors: "the conventions differ because nothing
 * ever offered to own them." Anthropic publishes the thing that owns this
 * one — typed errors that already distinguish a bad key from a rate limit
 * from an unrecognised model, a `timeout` option and a `signal` option that
 * race correctly against each other, retry classification for transient
 * failures. Re-deriving that by hand, for a single vendor, in one file, is
 * the duplication ai-kit exists to avoid — just one level more specific.
 */
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
    .filter(
      (m): m is ChatMessage & { role: 'user' | 'assistant' } =>
        m.role === 'user' || m.role === 'assistant',
    )
    .map((m) => ({ role: m.role, content: textOf(m.content) }));

  // No retries: this is one link, not a chain the caller can fall through,
  // and a failure should reach the reader as `ByokError` immediately rather
  // than silently re-trying inside a budget the caller already timed.
  const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 0 });

  try {
    const response = await client.messages.create(
      {
        model: config.model,
        max_tokens: opts.maxTokens,
        ...(system ? { system } : {}),
        messages: rest,
      },
      { timeout: opts.timeoutMs, signal: opts.signal },
    );
    const text = response.content
      .filter((part): part is Anthropic.TextBlock => part.type === 'text')
      .map((part) => part.text)
      .join('');
    if (!text) throw new ByokError('anthropic', 'Anthropic returned an empty reply.');
    return { text };
  } catch (err) {
    if (err instanceof ByokError) throw err;
    throw new ByokError('anthropic', anthropicErrorMessage(err, config.model));
  }
}

/** One message per error kind the reader can actually act on; everything else is the SDK's own. */
function anthropicErrorMessage(err: unknown, model: string): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Anthropic rejected that key.';
  if (err instanceof Anthropic.NotFoundError)
    return `Anthropic does not recognise the model "${model}".`;
  if (err instanceof Anthropic.RateLimitError)
    return 'Anthropic is rate-limiting that key right now.';
  if (err instanceof Anthropic.APIConnectionTimeoutError)
    return 'Anthropic did not answer in time.';
  if (err instanceof Anthropic.APIUserAbortError) return 'Anthropic did not answer in time.';
  if (err instanceof Anthropic.APIConnectionError)
    return `Could not reach Anthropic (${err.message}).`;
  if (err instanceof Anthropic.APIError) return `Anthropic error: ${err.message}`;
  return err instanceof Error ? err.message : 'Anthropic call failed.';
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
