/**
 * A reader's key held in THEIR BROWSER — the only option signed out, and a
 * choice signed in (the other is `lib/byok-vault.ts`, sealed server-side).
 *
 * `localStorage` throws in a private window, with blocked site data, or with
 * storage disabled — none of which may break the chat, so every call is
 * wrapped and a failure degrades to "no key remembered".
 */
import { isByokConfig, type ByokConfig } from '@bitbaum/ai-kit/byok';

const KEY = 'substrata-byok';

export function loadByok(): ByokConfig | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Keys saved before the shared vendor list used `provider`.
    const value = parsed.vendor === undefined ? { ...parsed, vendor: parsed.provider } : parsed;
    return isByokConfig(value)
      ? { vendor: value.vendor, apiKey: value.apiKey, model: value.model }
      : null;
  } catch {
    return null;
  }
}

export function saveByok(config: ByokConfig): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    // Unpersisted, it still works for this session: the caller keeps it in state.
  }
}

export function clearByok(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up if it never stuck.
  }
}
