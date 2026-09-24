'use client';

import { useState } from 'react';
import type { ByokConfig, ByokProvider } from '@/lib/byok-shared';
import { clearByok, loadByok, saveByok } from '@/lib/byok-store';

export type ByokDraft = { provider: ByokProvider; apiKey: string; model: string };

/**
 * The reader's own frontier-model key: the saved one, the panel, and its draft.
 * `saveByokDraft` returns the message for the chat's error line ('' once saved).
 */
export function useByok() {
  // The reader's own key, if they have set one. Read once on mount — never
  // sent anywhere except as part of this component's own POST body, and never
  // written back except through `saveByok`/`clearByok` below.
  const [byok, setByok] = useState<ByokConfig | null>(() =>
    typeof window === 'undefined' ? null : loadByok(),
  );
  const [byokOpen, setByokOpen] = useState(false);
  const [byokDraft, setByokDraft] = useState<ByokDraft>({
    provider: 'openrouter',
    apiKey: '',
    model: '',
  });

  function saveByokDraft(): string {
    const config: ByokConfig = {
      provider: byokDraft.provider,
      apiKey: byokDraft.apiKey.trim(),
      model: byokDraft.model.trim(),
    };
    if (config.apiKey.length < 8 || config.model.length < 1) {
      return 'Enter a key and a model id.';
    }
    saveByok(config);
    setByok(config);
    setByokDraft({ provider: config.provider, apiKey: '', model: '' });
    setByokOpen(false);
    return '';
  }

  function removeByok() {
    clearByok();
    setByok(null);
  }

  return {
    byok,
    byokOpen,
    setByokOpen,
    byokDraft,
    setByokDraft,
    saveByokDraft,
    removeByok,
  };
}
