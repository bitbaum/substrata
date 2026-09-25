/** One model turn, whichever vendor serves it: the free chain or a reader's own key. */
import {
  LinkFailure,
  StreamInterrupted,
  linkId,
  completeStream,
  createLinkCooldown,
  estimateTokens,
  freeChain,
  usableChain,
  type ChatMessage,
  type Env,
  type Link,
} from '@bitbaum/ai-kit';
import { BYOK_SITE, ByokError, byokChain, byokErrorMessage, type ByokConfig } from '../byok';
import { readTurn, type ToolRequest } from './parse';
import { StreamGate } from './stream-gate';

/**
 * Links that refused recently, skipped until their refusal resets. One per
 * process: a spent daily pool otherwise costs a 429 round trip per link on
 * EVERY turn of every question — measured at several seconds a turn on
 * 2026-09-24, when the first four links had spent their day.
 */
export const freeCooldown = createLinkCooldown();

export interface ModelTurnResult {
  text: string;
  calls: ToolRequest[];
  /** `provider/model` that served it. */
  model: string;
  /** Links that refused before it, as `provider/model: kind` — for the timing log. */
  skipped?: string[];
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
  /** Called with an estimate of each turn's tokens (the free chain's interactive ledger). */
  onSpend?: (tokens: number) => void;
  /** Skip links that refused recently (the free chain); a reader's one link never. */
  cooldown?: ReturnType<typeof createLinkCooldown>;
  /**
   * "light": ask reasoning models for their shortest hidden thinking, which is
   * time a reader stares at a status line (ai-kit `reasoningBody`). The free
   * chain; a reader's own key keeps its full reasoning.
   */
  reasoning?: 'light';
  /**
   * Walk on from a link that has shown nothing after this long (ai-kit
   * `firstTokenMs`; never applied to the chain's last link). The free chain.
   */
  firstTokenMs?: number;
}): ModelTurn {
  return async ({ messages, tools, onText }) => {
    const gate = new StreamGate();
    const skipped: string[] = [];
    let end: { text: string; toolCalls: { name: string; args: string }[]; id: string } | undefined;
    for await (const delta of completeStream({
      chain: opts.cooldown ? opts.cooldown.filter(opts.chain) : opts.chain,
      onLinkFailure: (link, error) => {
        skipped.push(
          `${linkId(link)}: ${error instanceof LinkFailure ? (error.kind ?? error.status ?? 'failed') : 'failed'}`,
        );
        opts.cooldown?.record(link, error);
      },
      reasoning: opts.reasoning,
      firstTokenMs: opts.firstTokenMs,
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
    opts.onSpend?.(
      estimateTokens(JSON.stringify(messages), tools ? JSON.stringify(tools) : '', end.text),
    );
    const read = readTurn(end.text, end.toolCalls, Boolean(tools?.length));
    return { ...read, model: end.id, skipped };
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

/** A reader's own key, as a one-link chain — streamed and tool-capable at every vendor on the shared list. */
export function byokTurn(
  config: ByokConfig,
  limits: { maxTokens: number; timeoutMs: number; signal?: AbortSignal },
): ModelTurn {
  const { chain, env, extraHeaders } = byokChain(config, BYOK_SITE);
  const inner = streamedTurn({ chain, env, extraHeaders, ...limits });
  return async (input) => {
    try {
      return await inner(input);
    } catch (err) {
      if (err instanceof StreamInterrupted) throw err;
      const raw = err instanceof Error ? err.message : 'Call failed.';
      throw new ByokError(config.vendor, byokErrorMessage(config, raw));
    }
  };
}
