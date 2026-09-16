'use client';

import { useState } from 'react';

/**
 * The way a gap becomes a row: send what you know, or ask us to look.
 * Posts to the existing contributions inbox. Nothing is published from here.
 */
export function Inquire({ topic }: { topic: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [error, setError] = useState('');

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          topic,
          replyTo,
          consent: true,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send.');
      setReceipt(result.data.receipt);
      setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <p className="inquire-receipt" role="status">
        Received. Reference {receipt}. Nothing is published until a reviewer reads it.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="inquire-open" onClick={() => setOpen(true)}>
        Know something, or want us to look?
      </button>
    );
  }

  return (
    <form onSubmit={send} className="inquire-form">
      <label htmlFor="inquire-message">What should be on this page?</label>
      <textarea
        id="inquire-message"
        required
        minLength={10}
        maxLength={12000}
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="A source, a correction, or a question to research."
      />
      <label htmlFor="inquire-email">Email if you want a reply (optional)</label>
      <input
        id="inquire-email"
        type="email"
        value={replyTo}
        onChange={(e) => setReplyTo(e.target.value)}
      />
      <p className="inquire-note">Sending this notifies the research inbox. It does not publish.</p>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="research-button">
        {busy ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
