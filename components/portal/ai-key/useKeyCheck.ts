'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ByokVendorId } from '@bitbaum/ai-kit/byok';
import type { KeyCheck } from '@/lib/byok-admit';
import { checkKey } from './useAiKey';

export type CheckStatus =
  { state: 'idle' } | { state: 'checking' } | { state: 'done'; check: KeyCheck };

/** Long enough that a paste lands as one check; short enough to feel immediate. */
const SETTLE_MS = 600;
/** Nothing a vendor issues is shorter; below this a key is still being typed. */
const MIN_KEY = 8;

/**
 * A key checked as it is pasted — no "Check" button to find. Each new paste
 * cancels the answer to the previous one, so a slow reply about an old key can
 * never mark a new one as working. On success the model is preselected: the
 * `prefer`red one when the key can use it, else the strongest it can.
 */
export function useKeyCheck(vendor: ByokVendorId, apiKey: string, prefer?: string) {
  const [status, setStatus] = useState<CheckStatus>({ state: 'idle' });
  const [model, setModel] = useState('');
  const seq = useRef(0);

  const run = useCallback(
    async (forVendor: ByokVendorId, key?: string) => {
      const mine = ++seq.current;
      setStatus({ state: 'checking' });
      let check: KeyCheck;
      try {
        check = await checkKey(forVendor, key);
      } catch (e) {
        check = {
          ok: false,
          message: e instanceof Error ? e.message : 'Could not check the key.',
          models: [],
          suggested: null,
        };
      }
      if (mine !== seq.current) return;
      setStatus({ state: 'done', check });
      if (check.ok)
        setModel(
          prefer && (check.models.length === 0 || check.models.includes(prefer))
            ? prefer
            : (check.suggested ?? ''),
        );
    },
    [prefer],
  );

  /** Forget the last answer at once — it was about a key or provider that has changed. */
  const reset = useCallback(() => {
    seq.current += 1;
    setStatus({ state: 'idle' });
    setModel('');
  }, []);

  useEffect(() => {
    const key = apiKey.trim();
    if (key.length < MIN_KEY) return;
    const timer = setTimeout(() => void run(vendor, key), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [apiKey, vendor, run]);

  const check = status.state === 'done' ? status.check : null;
  return { status, check, model, setModel, run, reset };
}
