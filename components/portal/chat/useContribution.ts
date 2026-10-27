'use client';

import { useState } from 'react';

/**
 * "Have a source we should hold? Send evidence": the one POST beside the
 * chat that is not a question (/api/contributions). Its own state, so the
 * conversation (chatkit's ChatApp) and the contribution never share a flag.
 */
export function useContribution(topic: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [contribute, setContribute] = useState(false);

  async function sendContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: String(form.get('message') ?? ''),
          topic,
          replyTo: form.get('replyTo'),
          creditName: form.get('creditName'),
          consent: form.get('consent') === 'on',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send.');
      setReceipt(result.data.receipt);
      setContribute(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, receipt, contribute, setContribute, sendContribution };
}
