'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ChatStarters,
  ChatThread,
  Composer,
  type ChatMessageData,
  type RenderLink,
  useViewportHeight,
} from '@bitbaum/chatkit/react';
import type { Attachment } from '@bitbaum/chatkit';
import { CHAT_STARTERS } from '@/config/substrata-chat';
import { answerRow } from '@/lib/ask-row';
import type { CheckRequest } from '@/lib/ask-bridge';
import { AiKeyPanel } from './ai-key/AiKeyPanel';
import { useAiKey } from './ai-key/useAiKey';
import { AnswerFooter } from './chat/AnswerFooter';
import { AskTools } from './chat/AskTools';
import { ContributeForm } from './chat/ContributeForm';
import { useAssistantStatus } from './chat/useAssistantStatus';
import { useChatSession } from './chat/useChatSession';

/** Same-site links stay in the app (client navigation); everything else opens beside it. */
const renderLink: RenderLink = ({ href, internal, className, children }) =>
  internal ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  );

/** Text files go into the question; pictures are not read here yet. */
function withAttachments(text: string, attachments: Attachment[]): string {
  const files = attachments
    .filter((a): a is Extract<Attachment, { kind: 'text' }> => a.kind === 'text')
    .map((a) => `Attached ${a.name}:\n${a.content.slice(0, 2500)}`);
  return [text, ...files].filter((t) => t.trim()).join('\n\n');
}

/**
 * Ask: the fleet's chat (`@bitbaum/chatkit` — composer, microphone, thread,
 * Copy/Retry, scroll) with Substrata's evidence in its slots. It replaced a
 * hand-built thread and composer that had a dictation button with no server
 * leg, no Retry or Copy, and a scroll that yanked the reader to the bottom on
 * every token. A fix to how chatting works belongs in bitbaum/chatkit.
 */
export function ResearchChat({
  topic,
  onPath,
  compact = false,
  pending,
}: {
  topic: string;
  /** The page the reader is on, so the assistant can resolve "it" and "they". */
  onPath?: string;
  compact?: boolean;
  /** A "Check this" request to run as soon as the panel is open. */
  pending?: (CheckRequest & { id: number }) | null;
}) {
  const { ai, models, model, setModel } = useAssistantStatus();
  const keys = useAiKey();
  const chat = useChatSession({ topic, onPath, model, keyFields: keys.requestFields });
  const [keyOpen, setKeyOpen] = useState(false);
  const ran = useRef<number | null>(null);
  // The visible height, which shrinks when a phone keyboard opens; on /chat
  // the column is sized to it so the composer stays above the keyboard.
  const root = useRef<HTMLDivElement>(null);
  useViewportHeight(root);

  useEffect(() => {
    if (!pending || ran.current === pending.id) return;
    ran.current = pending.id;
    const subject = pending.value ? `${pending.value} — "${pending.claim}"` : `"${pending.claim}"`;
    void chat.ask(`Check this: ${subject}`, {
      claim: pending.claim,
      value: pending.value,
      source: pending.source,
    });
    // `chat.ask` is a fresh closure each render; the request id is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const messages: ChatMessageData[] = chat.turns.map((t, i) => ({
    id: String(i),
    role: t.role,
    content: t.content,
    // ONE row under the latest answer: the model's suggested replies first,
    // then the questions built from the records it read (`lib/ask-row.ts`).
    // chatkit shows it under the latest answer only, never while a turn runs.
    replies: t.role === 'assistant' ? answerRow(t.replies, t.followUps) : undefined,
  }));
  if (chat.error && !chat.busy)
    messages.push({ id: 'failed', role: 'assistant', content: chat.error, failed: true });
  const live = chat.live
    ? { text: chat.live.text, status: chat.live.steps.at(-1) ?? chat.live.status }
    : null;
  const ask = (question: string) => void chat.ask(question);
  const who = keys.active
    ? `Answering with your own AI: ${keys.active.label}`
    : ai === 'down'
      ? 'The assistant is unavailable just now'
      : 'Free models, shared · add your own AI key for more';

  return (
    <div ref={root} className={compact ? 'companion is-compact' : 'companion'}>
      <ChatThread
        messages={messages}
        live={live}
        onStop={chat.stop}
        onRetry={chat.retry}
        // A suggested reply or a follow-up goes exactly where a typed question goes.
        onReply={ask}
        labels={{ replies: 'Reply or ask next' }}
        renderLink={renderLink}
        renderFooter={(m) => {
          const turn = chat.turns[Number(m.id)];
          return turn?.role === 'assistant' ? <AnswerFooter turn={turn} /> : null;
        }}
        empty={
          <div className="ask-empty">
            {!compact && <h2>Ask about any bottleneck, company, country or rule.</h2>}
            <p>
              Answers say which claims are sourced and which are judgement, and link every record
              they read.
            </p>
            <ChatStarters
              starters={CHAT_STARTERS.map((s) => ({ label: s.label, prompt: s.question }))}
              onPick={ask}
            />
          </div>
        }
      />
      <Composer
        // Returned, not dropped: a question that was not sent stays in the box.
        onSend={(text, attachments) => chat.ask(withAttachments(text, attachments))}
        placeholder="Ask about a bottleneck, a company, a country, a rule…"
        sending={chat.busy}
        onStop={chat.stop}
        density={compact ? 'compact' : 'comfortable'}
        voice={{ transcribeUrl: '/api/transcribe' }}
        // Only text is read; a picture gets a sentence saying so, never silence.
        attach={{ maxFiles: 3, maxTextChars: 20_000, maxImageBytes: 1 }}
        labels={{
          send: 'Ask',
          attach: 'Attach a text file (.txt, .md, .csv)',
          attachNotes: {
            imageTooLarge: (name) => `${name}: pictures are not read here yet — paste the text.`,
          },
        }}
        tools={
          <AskTools
            keys={keys}
            models={models}
            model={model}
            setModel={setModel}
            busy={chat.busy}
            keyOpen={keyOpen}
            onToggleKey={() => setKeyOpen((v) => !v)}
          />
        }
        hint={who}
      />
      {keyOpen && <AiKeyPanel keys={keys} onDone={() => setKeyOpen(false)} />}
      <p className="ask-aside">
        {chat.receipt ? (
          <span role="status">
            Received. Reference {chat.receipt}. Nothing is published until a reviewer reads it.
          </span>
        ) : (
          <>
            Have a source we should hold?{' '}
            <button type="button" onClick={() => chat.setContribute((v) => !v)}>
              {chat.contribute ? 'Cancel' : 'Send evidence'}
            </button>
          </>
        )}
      </p>
      {chat.contribute && <ContributeForm busy={chat.busy} onSubmit={chat.sendContribution} />}
    </div>
  );
}
