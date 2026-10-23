'use client';

import { useEffect, useRef } from 'react';
import type { CheckRequest } from '@/lib/ask-bridge';
import type { useChatSession } from './useChatSession';

/**
 * Questions the chat asks by itself: a "Check this" request handed to the
 * panel, and the question the home page's Ask box sent to /chat (`?q=`).
 * Each runs once; a reload never asks it again.
 */
export function useAutoAsk(
  ask: ReturnType<typeof useChatSession>['ask'],
  pending: (CheckRequest & { id: number }) | null | undefined,
  start: string | undefined,
) {
  const ran = useRef<number | null>(null);
  useEffect(() => {
    if (!pending || ran.current === pending.id) return;
    ran.current = pending.id;
    const subject = pending.value ? `${pending.value} — "${pending.claim}"` : `"${pending.claim}"`;
    void ask(`Check this: ${subject}`, {
      claim: pending.claim,
      value: pending.value,
      source: pending.source,
    });
    // `ask` is a fresh closure each render; the request id is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const started = useRef(false);
  useEffect(() => {
    if (!start || started.current) return;
    started.current = true;
    // The question is in the thread now; a reload must not ask it again.
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
    void ask(start);
    // Once, on arrival: `ask` is a fresh closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);
}
