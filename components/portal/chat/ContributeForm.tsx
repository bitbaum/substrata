'use client';

import { Composer } from '@bitbaum/chatkit/react';
import { useState } from 'react';

import type { useContribution } from './useContribution';

/**
 * Evidence for the private inbox. A different action from asking, so its own
 * box, but the same composer (chatkit's `Composer`): say it or type it, Enter
 * sends, and a refused or failed send keeps the draft. Not a <form>: the
 * composer sends on its own, so nothing submits twice.
 */
export function ContributeForm({ chat }: { chat: ReturnType<typeof useContribution> }) {
  const [replyTo, setReplyTo] = useState('');
  const [creditName, setCreditName] = useState('');
  const [consent, setConsent] = useState(false);

  return (
    <div className="inquire-form companion-inbox">
      <p className="inquire-label">What should the research team know?</p>
      <Composer
        ariaLabel="What should the research team know?"
        placeholder="A source, a document, or a correction."
        voice={{ transcribeUrl: '/api/transcribe' }}
        labels={{ send: 'Send' }}
        sending={chat.busy}
        autoFocus
        onSend={(text) => chat.send(text, { replyTo, creditName, consent })}
      />
      {chat.error && <p role="alert">{chat.error}</p>}
      <label htmlFor="contrib-email">Reply email (optional)</label>
      <input
        id="contrib-email"
        type="email"
        value={replyTo}
        onChange={(e) => setReplyTo(e.target.value)}
      />
      <label htmlFor="contrib-credit">Credit name (optional)</label>
      <input
        id="contrib-credit"
        maxLength={120}
        value={creditName}
        onChange={(e) => setCreditName(e.target.value)}
      />
      <label className="consent-line">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Send this to the private inbox. It does not publish.
      </label>
    </div>
  );
}
