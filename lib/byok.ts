/**
 * Bring your own key — the server half.
 *
 * The vendor list, the validation and the call shape are `@bitbaum/ai-kit/byok`,
 * shared with OrangeCat and Loki, so a vendor added there reaches Ask with a
 * version bump. Every vendor on it speaks the OpenAI shape (Anthropic and
 * Gemini included), so a reader's key streams and calls tools through the same
 * `completeStream` as the free chain — no vendor SDK here.
 *
 * Where the key lives between requests is the reader's choice: their browser
 * (`lib/byok-store.ts`), or — signed in — sealed in this app's database
 * (`lib/byok-vault.ts`). Either way it is never logged, and an error reported
 * to the reader is built from the vendor's answer, not from the request.
 */
import { byokVendor, isByokConfig, type ByokConfig } from '@bitbaum/ai-kit/byok';

export * from '@bitbaum/ai-kit/byok';

/** Attribution OpenRouter shows on its app pages; free to send. */
export const BYOK_SITE = { url: 'https://substrata.orangecat.ch', title: 'Substrata' };

export class ByokError extends Error {
  constructor(
    readonly vendor: string,
    message: string,
  ) {
    super(message);
    this.name = 'ByokError';
  }
}

/**
 * A vendor failure in words a reader can act on. The raw message names the
 * link and status (never the key — ai-kit builds it from the response).
 */
export function byokErrorMessage(config: Pick<ByokConfig, 'vendor' | 'model'>, raw: string) {
  const label = byokVendor(config.vendor)?.label ?? config.vendor;
  if (/: 401\b|: 403\b|authentication|invalid.*key/i.test(raw))
    return `${label} rejected that key.`;
  if (/: 404\b|not.?found|does not exist/i.test(raw))
    return `${label} does not recognise the model "${config.model}".`;
  if (/: 429\b/.test(raw)) return `${label} is rate-limiting that key right now.`;
  if (/: 402\b|credit|billing|quota/i.test(raw))
    return `${label} refused for billing — check the credit on that account.`;
  if (/timed? ?out|abort/i.test(raw)) return `${label} did not answer in time.`;
  return `${label} error: ${raw.slice(0, 200)}`;
}

/** A browser-held config from a request body, or undefined. Throws nothing. */
export function byokFromBody(raw: unknown): ByokConfig | 'invalid' | undefined {
  if (raw === undefined || raw === null) return undefined;
  // Accept the pre-1.12 shape (`provider`) a reader's browser may still hold.
  const legacy = raw as { provider?: unknown; vendor?: unknown };
  const candidate =
    legacy && typeof legacy === 'object' && legacy.vendor === undefined && legacy.provider
      ? { ...(raw as object), vendor: legacy.provider }
      : raw;
  return isByokConfig(candidate) ? (candidate as ByokConfig) : 'invalid';
}
