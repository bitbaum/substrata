/**
 * The search backends every Substrata web search walks: the ones this
 * deployment configures (SearXNG, Brave, Tavily — `defaultProviders`), then
 * ai-kit's keyless ones (GDELT news, then Wikipedia — `withKeylessFallback`).
 * On 2026-11-11 the box's SearXNG stopped answering and, with no paid key,
 * the Ask assistant, the event sweep and producer sourcing could not look
 * anything up for a day. The keyless backends are partial indexes, so an empty
 * answer from them never becomes "nothing on the web" (ai-kit's rule).
 *
 * Whether looking up is offered at all still follows the configured backends
 * (`webLookupEnabled`): a deployment, or a test, with none makes no request.
 */
import { withKeylessFallback, type SearchProvider } from '@bitbaum/ai-kit/web';
import { SITE } from './site';

/** Wikimedia asks API clients to name themselves and a way to reach them. */
export const SEARCH_USER_AGENT = `Substrata research (+${SITE.url})`;

export function searchProviders(
  doFetch: typeof globalThis.fetch = globalThis.fetch,
  env: NodeJS.ProcessEnv = process.env,
): SearchProvider[] {
  return withKeylessFallback(env, { userAgent: SEARCH_USER_AGENT }, doFetch);
}
