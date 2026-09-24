/** One model turn, whichever vendor serves it: the free chain or a reader's own key. */
import {
  StreamInterrupted,
  completeStream,
  freeChain,
  usableChain,
  type ChatMessage,
  type Env,
  type Link,
  type Provider,
} from '@bitbaum/ai-kit';
import { completeByok, ByokError, type ByokConfig } from '../byok';
import { readTurn, type ToolRequest } from './parse';
import { StreamGate } from './stream-gate';

// ---------------------------------------------------------------------------
// One model turn, whichever vendor serves it.
// ---------------------------------------------------------------------------

export interface ModelTurnResult {
  text: string;
  calls: ToolRequest[];
  /** `provider/model` that served it. */
  model: string;
}

export type ModelTurn = (input: {
  messages: ChatMessage[];
  tools?: unknown[];
  onText: (text: string) => void;
}) => Promise<ModelTurnResult>;

/** A streamed turn over an ai-kit chain — the free one, or a reader's own OpenAI-shaped key. */
export function streamedTurn(opts: {
  chain: Link[];
  model?: string;
  env?: Env;
  maxTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
  extraHeaders?: Record<string, string>;
}): ModelTurn {
  return async ({ messages, tools, onText }) => {
    const gate = new StreamGate();
    let end: { text: string; toolCalls: { name: string; args: string }[]; id: string } | undefined;
    for await (const delta of completeStream({
      chain: opts.chain,
      model: opts.model,
      env: opts.env,
      messages,
      tools,
      maxTokens: opts.maxTokens,
      timeoutMs: opts.timeoutMs,
      signal: opts.signal,
      extraHeaders: opts.extraHeaders,
    })) {
      if (delta.type === 'text') {
        const shown = gate.feed(delta.text);
        if (shown) onText(shown);
      } else if (delta.type === 'end') {
        end = { text: delta.text, toolCalls: delta.toolCalls, id: delta.id };
      }
    }
    const tail = gate.flush();
    if (tail) onText(tail);
    if (!end) throw new Error('The stream ended without a turn.');
    const read = readTurn(end.text, end.toolCalls, Boolean(tools?.length));
    return { ...read, model: end.id };
  };
}

/**
 * The free chain, with the reader's pick (if any) moved to the front.
 *
 * Only ids already in the chain are honoured — see `isOfferedModel` in
 * chat/models.ts for why an unknown id is an injection, not a preference.
 */
export function freeLinks(requested: string | undefined, env: Env = process.env): Link[] {
  const full = usableChain(freeChain('SUBSTRATA'), env);
  const pick =
    requested && requested !== 'auto' ? full.find((l) => l.model === requested) : undefined;
  return pick ? [pick, ...full.filter((l) => l !== pick)] : full;
}

const BYOK_BASE: Record<'openai' | 'openrouter', string> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

/** A reader's own key, as a one-link chain — streamed and tool-capable where the vendor is OpenAI-shaped. */
export function byokTurn(
  config: ByokConfig,
  limits: { maxTokens: number; timeoutMs: number; signal?: AbortSignal },
): ModelTurn {
  if (config.provider === 'anthropic') {
    // Anthropic's Messages API is not OpenAI-shaped; the tools reach it as the
    // text protocol described in the system prompt, and the reply arrives whole.
    return async ({ messages, tools, onText }) => {
      const { text } = await completeByok(config, messages, limits);
      const read = readTurn(text, [], Boolean(tools?.length));
      if (!read.calls.length) onText(read.text);
      return { ...read, model: `anthropic/${config.model}` };
    };
  }
  const keyEnv = 'SUBSTRATA_BYOK_KEY';
  const provider: Provider = {
    id: config.provider,
    baseUrl: BYOK_BASE[config.provider],
    keyEnv,
    models: [config.model],
    dailyTokens: Number.POSITIVE_INFINITY,
    ...(config.provider === 'openrouter' ? { routed: true } : {}),
  };
  const inner = streamedTurn({
    chain: [{ provider, model: config.model }],
    // A one-entry env scoped to this call, never process.env.
    env: { [keyEnv]: config.apiKey },
    ...limits,
    extraHeaders:
      config.provider === 'openrouter'
        ? { 'HTTP-Referer': 'https://substrata.orangecat.ch', 'X-Title': 'Substrata' }
        : undefined,
  });
  return async (input) => {
    try {
      return await inner(input);
    } catch (err) {
      if (err instanceof StreamInterrupted) throw err;
      throw new ByokError(config.provider, err instanceof Error ? err.message : 'Call failed.');
    }
  };
}
