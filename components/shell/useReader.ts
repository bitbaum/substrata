'use client';

import { useEffect, useState } from 'react';

import type { Reader } from '@/components/portal/AccountMenuView';

let inFlight: Promise<Reader> | null = null;

/** One request per page load, however many components ask. */
function readReader(): Promise<Reader> {
  inFlight ??= fetch('/api/me', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Reader>;
    })
    .catch(() => {
      inFlight = null;
      // Unreachable means anonymous: the research is public, the menu is not.
      return { signedIn: false, name: null, image: null, reviewer: false, authEnabled: false };
    });
  return inFlight;
}

/**
 * Who is reading, learned in the browser — for a page served from a cache,
 * which cannot read the session. `null` until the answer arrives (and when
 * `enabled` is false, so a page that did read the session pays nothing).
 */
export function useReader(enabled: boolean): Reader | null {
  const [reader, setReader] = useState<Reader | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void readReader().then((r) => live && setReader(r));
    return () => {
      live = false;
    };
  }, [enabled]);
  return reader;
}
