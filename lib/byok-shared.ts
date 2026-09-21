/**
 * The BYOK types, the closed vendor list, and validation — the half of
 * `lib/byok.ts` that has no server-only dependency.
 *
 * Split out so a client component can import `ByokConfig` and the vendor
 * labels for its settings panel without pulling `@bitbaum/ai-kit` (and the
 * whole model-chain machinery it brings) into the browser bundle. Nothing
 * here makes a network call; `lib/byok.ts` re-exports all of it, so server
 * code keeps a single import.
 */

export const BYOK_PROVIDERS = ['openai', 'anthropic', 'openrouter'] as const;
export type ByokProvider = (typeof BYOK_PROVIDERS)[number];

export const BYOK_PROVIDER_LABEL: Record<ByokProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
};

export interface ByokConfig {
  provider: ByokProvider;
  apiKey: string;
  model: string;
}

/**
 * A header value and a model id, not free text. Bounds are generous (real
 * keys and model ids are well under these) and exist only to stop someone
 * sending megabytes through a JSON field or smuggling a header via a
 * newline — never to second-guess a vendor's own key format, which changes
 * without notice and is none of this file's business.
 */
export function isValidByokConfig(input: unknown): input is ByokConfig {
  if (!input || typeof input !== 'object') return false;
  const { provider, apiKey, model } = input as Record<string, unknown>;
  if (!(BYOK_PROVIDERS as readonly string[]).includes(provider as string)) return false;
  if (typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > 400) return false;
  if (typeof model !== 'string' || model.length < 1 || model.length > 200) return false;
  if (/[\r\n]/.test(apiKey) || /[\r\n]/.test(model)) return false;
  return true;
}

export class ByokError extends Error {
  constructor(
    readonly provider: ByokProvider,
    message: string,
  ) {
    super(message);
    this.name = 'ByokError';
  }
}

/** For the system prompt and the sources footer — never the key. */
export function byokModelLabel(config: ByokConfig): string {
  return `${BYOK_PROVIDER_LABEL[config.provider]} · ${config.model}`;
}
