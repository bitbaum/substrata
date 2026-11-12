'use client';

import { Composer } from '@bitbaum/chatkit/react';
import { useState } from 'react';

import { useContribution } from './chat/useContribution';

/**
 * The way a gap becomes a row: send what you know, or ask us to look.
 * Posts to the existing contributions inbox. Nothing is published from here.
 * The box is chatkit's `Composer`, the one Ask uses: say it or type it,
 * Enter sends, and a failed send keeps the draft.
 */
export function Inquire({ topic }: { topic: string }) {
  const contribution = useContribution(topic);
  const [replyTo, setReplyTo] = useState('');

  if (contribution.receipt) {
    return (
      <p className="inquire-receipt" role="status">
        Received. Reference {contribution.receipt}. Nothing is published until a reviewer reads it.
      </p>
    );
  }

  if (!contribution.contribute) {
    return (
      <button
        type="button"
        className="inquire-open"
        onClick={() => contribution.setContribute(true)}
      >
        Know something, or want us to look?
      </button>
    );
  }

  return (
    <div className="inquire-form">
      <p className="inquire-label">What should be on this page?</p>
      <Composer
        ariaLabel="What should be on this page?"
        placeholder="A source, a correction, or a question to research."
        voice={{ transcribeUrl: '/api/transcribe' }}
        labels={{ send: 'Send' }}
        sending={contribution.busy}
        autoFocus
        // The note under the box is the consent: pressing Send says yes to it.
        onSend={(text) => contribution.send(text, { replyTo, consent: true })}
      />
      {contribution.error && <p role="alert">{contribution.error}</p>}
      <label htmlFor="inquire-email">Email if you want a reply (optional)</label>
      <input
        id="inquire-email"
        type="email"
        value={replyTo}
        onChange={(e) => setReplyTo(e.target.value)}
      />
      <p className="inquire-note">Sending this notifies the research inbox. It does not publish.</p>
    </div>
  );
}
