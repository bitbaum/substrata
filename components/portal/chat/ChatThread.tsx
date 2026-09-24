'use client';

import { useEffect, useRef } from 'react';
import { CHAT_STARTERS } from '@/config/substrata-chat';
import { ChatTurn, LiveTurn } from './ChatTurn';
import type { LiveAnswer, Turn } from './types';

/** The scrolling thread: the empty state, every turn, the live answer, and the status lines. */
export function ChatThread({
  turns,
  live,
  busy,
  error,
  receipt,
  keyLabel,
  ai,
  compact,
  onAsk,
}: {
  turns: Turn[];
  live: LiveAnswer | null;
  busy: boolean;
  error: string;
  receipt: string;
  /** The reader's own AI, when a key is active: "Anthropic · claude-opus-5". */
  keyLabel: string | null;
  ai: 'unknown' | 'up' | 'down';
  compact: boolean;
  onAsk: (question: string) => Promise<void>;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy, live]);

  return (
    <div className="companion-thread" ref={scroller}>
      {turns.length === 0 && (
        <div className="companion-empty">
          <p className="companion-kicker">
            Substrata ·{' '}
            {keyLabel
              ? `answering as ${keyLabel}`
              : ai === 'up'
                ? 'assistant connected'
                : ai === 'down'
                  ? 'assistant unavailable'
                  : 'checking assistant'}
          </p>
          <h2>Ask the corpus.</h2>
          <p>
            {keyLabel ? (
              <>
                Running on your own key, not the shared free tier. Same corpus, same citation rules
                — a numbered row is still the only thing that counts as a finding.
              </>
            ) : (
              <>
                It knows the page you are on and, signed in, the rails you follow. It looks up
                bottlenecks, companies, events and the sweep&apos;s newest leads as it answers, and
                says which claims are sourced, which are unverified, and which are judgement. Have a
                key for any AI — OpenAI, Anthropic, Gemini, OpenRouter and others? Add it below
                (Your AI key) to use it instead of the shared free models.
              </>
            )}
          </p>
          {!compact && (
            <div className="companion-starters">
              {CHAT_STARTERS.map((s) => (
                <button key={s.question} type="button" onClick={() => onAsk(s.question)}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {turns.map((turn, i) => (
        <ChatTurn key={i} turn={turn} isLast={i === turns.length - 1} busy={busy} onAsk={onAsk} />
      ))}
      {live && <LiveTurn live={live} />}
      {error && (
        <p role="alert" className="companion-error">
          {error}
        </p>
      )}
      {receipt && (
        <p className="receipt" role="status">
          Received. Reference {receipt}. Nothing is published until a reviewer reads it.
        </p>
      )}
    </div>
  );
}
