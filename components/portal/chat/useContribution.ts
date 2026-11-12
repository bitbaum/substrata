'use client';

import { useState } from 'react';

/** What goes with the words: who to reply to, who to credit, and the reader's yes. */
export type ContributionFields = {
  replyTo?: string;
  creditName?: string;
  consent: boolean;
};

/** The words /api/contributions asks for, said before the request rather than after it. */
export const SHORT_MESSAGE = 'Add at least 10 characters so a reviewer can act on it.';
export const NO_CONSENT = 'Tick the box to send this to the private inbox, then press Send again.';

/**
 * The one POST that is not a question (/api/contributions), for "Know
 * something, or want us to look?" on a page and "Send evidence" beside Ask.
 * Its own state, so the conversation (chatkit's ChatApp) and the
 * contribution never share a flag. `send` answers chatkit's `Composer`
 * `onSend`: `false` keeps the draft, so a refused or failed send is retried
 * from the same box, never retyped.
 */
export function useContribution(topic: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [contribute, setContribute] = useState(false);

  async function send(message: string, fields: ContributionFields): Promise<boolean> {
    if (message.trim().length < 10) {
      setError(SHORT_MESSAGE);
      return false;
    }
    if (!fields.consent) {
      setError(NO_CONSENT);
      return false;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          topic,
          replyTo: fields.replyTo ?? '',
          creditName: fields.creditName ?? '',
          consent: true,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send.');
      setReceipt(result.data.receipt);
      setContribute(false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send. Please retry.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, receipt, contribute, setContribute, send };
}
