/**
 * A reader's own key as a plain `Ask` — the ONLY way drafting reaches a model.
 *
 * The chain is built from the reader's key alone (`byokChain`), and it is
 * always passed: ai-kit's `complete()` falls back to the free chain when it is
 * given none, which is exactly the spend this module exists to rule out. The
 * env handed over holds only the reader's key, so even that fallback would
 * find no free vendor to call.
 */
import { complete } from '@bitbaum/ai-kit';

import { BYOK_SITE, ByokError, byokChain, byokErrorMessage, type ByokConfig } from './byok';
import type { Ask } from './event-draft';

/** What a draft records as its author: vendor and model, never the key. */
export function byokModelLabel(config: Pick<ByokConfig, 'vendor' | 'model'>): string {
  return `${config.vendor}/${config.model} (reader's key)`;
}

export function byokAsk(config: ByokConfig): Ask {
  const { chain, env, extraHeaders } = byokChain(config, BYOK_SITE);
  if (chain.length === 0) throw new ByokError(config.vendor, 'That key names no model.');
  return async (messages) => {
    try {
      const result = await complete({
        chain,
        env,
        extraHeaders,
        messages,
        maxTokens: 2_000,
        timeoutMs: 45_000,
      });
      return result.text;
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Call failed.';
      throw new ByokError(config.vendor, byokErrorMessage(config, raw));
    }
  };
}
