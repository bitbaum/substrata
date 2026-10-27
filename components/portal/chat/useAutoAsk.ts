'use client';

import { useEffect, useRef } from 'react';
import type { CheckRequest } from '@/lib/ask-bridge';
import { SEND_PARAM, takePending } from '@/lib/chat/handoff';
import type { useChatSession } from './useChatSession';

/**
 * Questions the chat asks by itself: a "Check this" request handed to the
 * panel, the question a starter sent to /chat (`?q=`), and a message the home
 * page's box handed over with its attachments (`?send=`, lib/chat/handoff.ts).
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
    if (started.current) return;
    const url = new URL(window.location.href);
    const handed = url.searchParams.get(SEND_PARAM);
    if (!start && !handed) return;
    started.current = true;
    // The message is in the thread now; a reload must not send it again.
    url.searchParams.delete('q');
    url.searchParams.delete(SEND_PARAM);
    window.history.replaceState(null, '', url);
    const message = handed ? takePending(handed) : null;
    if (message) void ask(message.text, undefined, [], message.attachments);
    else if (start) void ask(start);
    // Once, on arrival: `ask` is a fresh closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);
}
