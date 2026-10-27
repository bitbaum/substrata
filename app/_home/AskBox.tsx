'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { AskComposer } from '@/components/portal/chat/AskComposer';
import { OPEN_EVENT } from '@/lib/ask-bridge';
import { savePending, sendHref } from '@/lib/chat/handoff';
import { askHref, type HomeAsk } from '@/lib/home-asks';

/**
 * Ask, as the front page's first control: THE composer /chat and the panel
 * use (`AskComposer` — "+" for a screenshot, microphone, send), and a few
 * questions to start from. Sending hands the message, attachments and all,
 * to /chat (lib/chat/handoff.ts), which sends it at once as a new chat: the
 * answer is not drawn here, so the conversation gets the whole screen.
 */
export function AskBox({ asks }: { asks: readonly HomeAsk[] }) {
  const router = useRouter();
  const input = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState('');

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
      <AskComposer
        inputRef={input}
        density="comfortable"
        onSend={(text, attachments) => {
          const id = savePending({ text, attachments });
          if (id) {
            router.push(sendHref(id));
            return true;
          }
          if (attachments.length) {
            // This browser would not hold the pictures for the hop to /chat: say so, keep them.
            setNote(
              'This browser blocked the hand-over of your attachment. Open Ask and add it there.',
            );
            return false;
          }
          router.push(askHref(text));
          return true;
        }}
      />
      {note && (
        <p className="home-ask-note" role="status">
          {note}
        </p>
      )}
      <p className="home-asks-label">Or start from one of these</p>
      <ul className="home-asks">
        {asks.map((a) => (
          <li key={a.label}>
            <button
              type="button"
              className="home-ask-option"
              onClick={() => router.push(askHref(a.question))}
            >
              {a.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
