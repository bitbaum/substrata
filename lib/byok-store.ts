/**
 * Where a reader's own key lives BETWEEN requests: their own browser, and
 * nowhere this project runs. `lib/byok.ts` says the server never persists it;
 * this is the other half of that promise, kept out of the component so it can
 * be read without a DOM.
 *
 * `localStorage` throws in a private window, with blocked site data, or with
 * storage disabled outright — none of which should break the chat, so every
 * call here is wrapped and a failure degrades to "no key remembered" rather
 * than to a crash.
 */
import { BYOK_PROVIDERS, type ByokConfig } from './byok-shared';

const KEY = 'substrata-byok';

function isByokConfig(value: unknown): value is ByokConfig {
  if (!value || typeof value !== 'object') return false;
  const { provider, apiKey, model } = value as Record<string, unknown>;
  return (
    (BYOK_PROVIDERS as readonly string[]).includes(provider as string) &&
    typeof apiKey === 'string' &&
    apiKey.length > 0 &&
    typeof model === 'string' &&
    model.length > 0
  );
}

export function loadByok(): ByokConfig | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isByokConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveByok(config: ByokConfig): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    // A reader who cannot persist it can still use it for this one session —
    // the caller keeps it in component state either way.
  }
}

export function clearByok(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up if it never stuck in the first place.
  }
}
