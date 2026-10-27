'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { CheckRequest } from '@/lib/ask-bridge';
import { sendThroughComposer } from '@/lib/chat/drive-composer';
import { SEND_PARAM, takePending } from '@/lib/chat/handoff';
import { pendingChecks } from './askTransport';

/**
 * Messages the chat sends by itself: a "Check this" request handed to the
 * panel, a starter question sent to /chat (`?q=`), and a message the home
 * page's box handed over with its attachments (`?send=`, lib/chat/handoff.ts).
 * Each goes once, through the composer (lib/chat/drive-composer.ts); a reload
 * never sends it again.
 */
export function useAutoAsk(
  root: RefObject<HTMLElement | null>,
  pending: (CheckRequest & { id: number }) | null | undefined,
  start: string | undefined,
) {
  const ran = useRef<number | null>(null);
  useEffect(() => {
    if (!pending || ran.current === pending.id || !root.current) return;
    ran.current = pending.id;
    const subject = pending.value ? `${pending.value} — "${pending.claim}"` : `"${pending.claim}"`;
    const text = `Check this: ${subject}`;
    // The transport reads the claim's source with the turn that carries these words.
    pendingChecks.set(text, { claim: pending.claim, value: pending.value, source: pending.source });
    void sendThroughComposer(root.current, text);
  }, [pending, root]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current || !root.current) return;
    const url = new URL(window.location.href);
    const handed = url.searchParams.get(SEND_PARAM);
    if (!start && !handed) return;
    started.current = true;
    // The message is in the thread now; a reload must not send it again.
    url.searchParams.delete('q');
    url.searchParams.delete(SEND_PARAM);
    window.history.replaceState(null, '', url);
    const message = handed ? takePending(handed) : null;
    if (message) void sendThroughComposer(root.current, message.text, message.attachments);
    else if (start) void sendThroughComposer(root.current, start);
  }, [start, root]);
}
