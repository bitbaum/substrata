'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Composer } from '@bitbaum/chatkit/react';

import { OPEN_EVENT } from '@/lib/ask-bridge';
import { askHref, type HomeAsk } from '@/lib/home-asks';

/**
 * Ask, as the front page's first control: the same chatkit composer /chat
 * uses, and a few questions to start from. Sending (or pressing a suggestion)
 * opens /chat with the question, which starts it — the answer is not drawn
 * here, so the page stays short and the conversation gets the whole screen.
 */
export function AskBox({ asks }: { asks: readonly HomeAsk[] }) {
  const router = useRouter();
  const input = useRef<HTMLTextAreaElement>(null);
  const ask = (question: string) => {
    router.push(askHref(question));
    return true;
  };

  // Anything on the page that says "open Ask" lands in this box.
  useEffect(() => {
    const focus = () => {
      input.current?.focus();
      input.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    window.addEventListener(OPEN_EVENT, focus);
    return () => window.removeEventListener(OPEN_EVENT, focus);
  }, []);

  return (
    <div className="home-ask">
      <Composer
        inputRef={input}
        onSend={(text) => ask(text)}
        placeholder="Ask about any bottleneck…"
        ariaLabel="Ask about any bottleneck…"
        voice={{ transcribeUrl: '/api/transcribe' }}
        labels={{ send: 'Ask' }}
      />
      <p className="home-asks-label">Or start from one of these</p>
      <ul className="home-asks">
        {asks.map((a) => (
          <li key={a.label}>
            <button type="button" className="home-ask-option" onClick={() => ask(a.question)}>
              {a.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
