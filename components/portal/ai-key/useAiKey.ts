'use client';

import { useCallback, useEffect, useState } from 'react';
import { byokLabel, type ByokConfig, type ByokVendorId } from '@bitbaum/ai-kit/byok';
import { admitKey, type KeyCheck } from '@/lib/byok-admit';
import { clearByok, loadByok, saveByok } from '@/lib/byok-store';

/** What the account holds — never the key. Mirrors `StoredKey` in lib/byok-vault.ts. */
export type StoredKey = { vendor: ByokVendorId; model: string; hint: string; updatedAt: string };
type Account = { signedIn: boolean; canStore: boolean; stored: StoredKey | null };

/** Every mounted panel (the Ask dock, the settings page) re-reads on this. */
const EVENT = 'substrata-ai-key';

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result as T;
}

/**
 * Ask the vendor whether a key works and what it can use — a pasted key, or
 * with none the one sealed on the account. A plain function, not hook state,
 * so a debounced effect can depend on it without re-firing every render.
 */
export async function checkKey(vendor: ByokVendorId, apiKey?: string): Promise<KeyCheck> {
  const body = apiKey ? { vendor, apiKey } : { vendor, stored: true };
  return call<KeyCheck>('/api/ai-key/models', 'POST', body);
}

/** Refuse locally what the server would refuse: the browser path has no server to ask. */
function admitted(check: KeyCheck | null, model: string): string {
  const admission = admitKey(check, model);
  if (!admission.ok) throw new Error(admission.error);
  return admission.model;
}

/**
 * The reader's own AI key, wherever it is kept: sealed on their account
 * (signed in, when the server can seal), or in this browser only. The account
 * key wins when both exist, because it is the one the reader chose to keep.
 * No key = the free chain, which stays the default.
 */
export function useAiKey() {
  const [browser, setBrowser] = useState<ByokConfig | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  const refresh = useCallback(() => {
    setBrowser(loadByok());
    call<Account>('/api/ai-key', 'GET')
      .then(setAccount)
      .catch(() => setAccount({ signedIn: false, canStore: false, stored: null }));
  }, []);

  useEffect(() => {
    // Mount-time read of browser storage and the account — external systems.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    window.addEventListener(EVENT, refresh);
    return () => window.removeEventListener(EVENT, refresh);
  }, [refresh]);

  const changed = () => window.dispatchEvent(new Event(EVENT));
  const stored = account?.stored ?? null;
  const active: { where: 'account' | 'browser'; label: string } | null = stored
    ? { where: 'account', label: byokLabel(stored) }
    : browser
      ? { where: 'browser', label: byokLabel(browser) }
      : null;

  return {
    browser,
    account,
    active,
    /** The fields a chat request carries for the active key. */
    requestFields(): { byok?: ByokConfig; byokStored?: true } {
      if (stored) return { byokStored: true };
      return browser ? { byok: browser } : {};
    },
    /**
     * Keep a key that passed its check. The account path is checked again by
     * the server before it seals; the browser path is admitted here.
     */
    async save(config: ByokConfig, where: 'account' | 'browser', check: KeyCheck | null) {
      if (where === 'account') {
        await call('/api/ai-key', 'PUT', config);
        clearByok();
      } else {
        saveByok({ ...config, model: admitted(check, config.model) });
      }
      changed();
    },
    async setModel(model: string, check: KeyCheck | null) {
      if (stored) await call('/api/ai-key', 'PATCH', { model });
      else if (browser) saveByok({ ...browser, model: admitted(check, model) });
      changed();
    },
    async remove() {
      if (stored) await call('/api/ai-key', 'DELETE');
      clearByok();
      changed();
    },
  };
}

export type AiKey = ReturnType<typeof useAiKey>;
