'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ChatScreen,
  ChatStarters,
  ChatThread,
  Composer,
  type ChatMessageData,
} from '@bitbaum/chatkit/react';
import { HOME_LINK } from '@/config/site-nav';
import { answerRow } from '@/lib/ask-row';
import { webCitations } from '@/lib/chat/web-citations';
import { chatHref, loadThread, saveThread } from '@/lib/ask-thread';
import type { CheckRequest } from '@/lib/ask-bridge';
import { useAiKey } from './ai-key/useAiKey';
import { AskPanel } from './AskPanel';
import { AnswerFooter } from './chat/AnswerFooter';
import { AskTools } from './chat/AskTools';
import { chartRenderers } from './chat/chartRenderers';
import { ComposerBeside } from './chat/ComposerBeside';
import { renderLink } from './chat/links';
import { thinkingFor } from './chat/thinking';
import { useAssistantStatus } from './chat/useAssistantStatus';
import { useAutoAsk } from './chat/useAutoAsk';
import { useChatSession } from './chat/useChatSession';

/**
 * Ask: the fleet's chat (`@bitbaum/chatkit` — composer, microphone, thread,
 * Copy/Retry, scroll) with Substrata's evidence in its slots. It replaced a
 * hand-built thread and composer that had a dictation button with no server
 * leg, no Retry or Copy, and a scroll that yanked the reader to the bottom on
 * every token. A fix to how chatting works belongs in bitbaum/chatkit.
 *
 * Two frames, one chat: `compact` is the panel over a page (a sheet on a
 * phone, a right-hand panel on a desktop — `AskPanel`), and the page is
 * /chat. Both are chatkit's `ChatScreen`, so the thread scrolls inside the
 * frame and the composer rides above the keyboard in either. Expand hands
 * the thread to /chat whole (`lib/ask-thread.ts`).
 */
export function ResearchChat({
  topic,
  onPath,
  compact = false,
  open = true,
  onClose,
  pending,
  start,
  threadId,
  starters,
}: {
  topic: string;
  /** The page the reader is on, so the assistant can resolve "it" and "they". */
  onPath?: string;
  /** The panel over a page, rather than the /chat page. */
  compact?: boolean;
  /** The panel: shown or hidden (it stays mounted, so the thread survives Close). */
  open?: boolean;
  onClose?: () => void;
  /** A "Check this" request to run as soon as the panel is open. */
  pending?: (CheckRequest & { id: number }) | null;
  /** A question to ask as soon as the page opens — what the home page's Ask box sends. */
  start?: string;
  /** /chat: a thread the panel handed over (`/chat?thread=`). */
  threadId?: string;
  /** The empty screen's questions: drawn from the corpus per facet (lib/starters.ts), by the server. */
  starters: readonly { label: string; question: string }[];
}) {
  const router = useRouter();
  const { ai, models, model, setModel } = useAssistantStatus();
  const keys = useAiKey();
  const chat = useChatSession({ topic, onPath, model, keyFields: keys.requestFields });
  const [keyOpen, setKeyOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useAutoAsk(chat.ask, pending, start);

  // Expand brought the thread here: pick it up whole, under the same
  // conversation id. The URL keeps the id, so a reload finds it again.
  const restored = useRef(false);
  useEffect(() => {
    if (!threadId || restored.current) return;
    restored.current = true;
    const handoff = loadThread(threadId);
    if (handoff) chat.restore(handoff);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  /** The whole thread to /chat: nothing lost, the URL carrying only an id. */
  const expand = () => {
    const id = crypto.randomUUID();
    saveThread({ id, conversationId: chat.conversationIdNow(), topic, onPath, turns: chat.turns });
    onClose?.();
    router.push(chatHref(id));
  };

  const messages: ChatMessageData[] = chat.turns.map((t) => ({
    id: t.id,
    role: t.role,
    // A web page the answer cites is a source chip linked to the page (lib/chat/web-citations.ts).
    ...webCitations(t.content, t.role === 'assistant' ? t.web : undefined),
    // ONE row under the latest answer: the model's suggested replies first,
    // then the questions built from the records it read (`lib/ask-row.ts`).
    // chatkit shows it under the latest answer only, never while a turn runs,
    // and draws nothing at all when the row is empty.
    replies: t.role === 'assistant' ? answerRow(t.replies, t.followUps) : undefined,
    // "Thought for 12s › Read 3 records" above the answer (chat/thinking.ts).
    thinking: thinkingFor(t),
  }));
  if (chat.error && !chat.busy)
    messages.push({ id: 'failed', role: 'assistant', content: chat.error, failed: true });
  const live = chat.live
    ? {
        text: chat.live.text,
        status: chat.live.status,
        steps: chat.live.steps.map((label) => ({ label })),
      }
    : null;
  const ask = (question: string) => void chat.ask(question);
  const focusInput = () => {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const toggleKey = () => setKeyOpen((v) => !v);
  // The one quiet line under the composer: who answers, and the way to a key.
  const who = keys.active ? (
    `Answering with your own AI: ${keys.active.label}`
  ) : ai === 'down' ? (
    'The assistant is unavailable just now'
  ) : (
    <>
      Free models, shared ·{' '}
      <button type="button" className="ask-footnote-button" onClick={toggleKey}>
        Use your own AI key
      </button>
    </>
  );

  const thread = (
    <ChatThread
      messages={messages}
      live={live}
      onStop={chat.stop}
      onRetry={chat.retry}
      // A suggested reply or a follow-up goes exactly where a typed question goes.
      onReply={ask}
      labels={{ replies: 'Reply or ask next' }}
      renderLink={renderLink}
      // A chart block in an answer is drawn by @bitbaum/chartkit (chatkit 0.15).
      renderers={chartRenderers}
      // Copy · Listen · Share under every answer, the fleet's row (chatkit).
      share={{ title: 'Ask Substrata' }}
      // Thumbs under every answer (chatkit 0.14); a thumb down asks why.
      onFeedback={chat.feedback}
      renderFooter={(m) => {
        const turn = chat.turns.find((t) => t.id === m.id);
        return turn?.role === 'assistant' ? <AnswerFooter turn={turn} /> : null;
      }}
      empty={
        <div className="ask-empty">
          {!compact && (
            <>
              <h2>Ask about any bottleneck, company, country or rule.</h2>
              <div className="ask-cta">
                <button type="button" className="ask-cta-button" onClick={focusInput}>
                  Ask a question now
                </button>
              </div>
            </>
          )}
          <p>
            Answers say which claims are sourced and which are judgement, and link every record they
            read.
          </p>
          <ChatStarters
            starters={starters.map((s) => ({ label: s.label, prompt: s.question }))}
            onPick={ask}
          />
        </div>
      }
    />
  );

  // chatkit's composer, ONE configuration on the panel and on /chat (one
  // shape per kind): microphone and send, the key chip only when a key is
  // set, and no label over the box — the placeholder says what it is for.
  // /chat once carried an "Ask a question" kicker and a paperclip the panel
  // did not, so Expand landed on a different box (2026-10-23). No paperclip
  // on either: /api/chat takes a question of at most QUESTION_LENGTH.max
  // characters and no files, so an attached file was only pasted text that a
  // long file pushed past the limit into a refusal.
  const composer = (
    <Composer
      inputRef={inputRef}
      ariaLabel="Ask about a bottleneck, a company, a country, a rule…"
      // Returned, not dropped: a question that was not sent stays in the box.
      onSend={(text) => chat.ask(text)}
      placeholder="Ask about a bottleneck, a company, a country, a rule…"
      sending={chat.busy}
      onStop={chat.stop}
      density="compact"
      voice={{ transcribeUrl: '/api/transcribe' }}
      attach={false}
      labels={{ send: 'Ask' }}
      tools={<AskTools keys={keys} keyOpen={keyOpen} onToggleKey={toggleKey} />}
    />
  );

  const beside = (
    <ComposerBeside
      chat={chat}
      keys={keys}
      keyOpen={keyOpen}
      onKeyDone={() => setKeyOpen(false)}
      models={models}
      model={model}
      setModel={setModel}
    />
  );

  // The panel over a page: chatkit's screen filling the sheet (AskPanel),
  // with no header of its own — the sheet's title row is the header.
  if (compact)
    return (
      <AskPanel open={open} title="Ask Substrata" onClose={() => onClose?.()} onExpand={expand}>
        <ChatScreen
          fill="parent"
          className="companion is-compact"
          renderers={chartRenderers}
          composer={
            <>
              {composer}
              <div className="companion-beside">{beside}</div>
            </>
          }
          footnote={who}
        >
          {thread}
        </ChatScreen>
      </AskPanel>
    );

  // /chat: the fleet's whole-screen chat (chatkit ChatScreen, as Loki and
  // Solon). The conversation is the display; a see-through header with the
  // way back floats at the top, the composer floats at the bottom and rides
  // above a phone keyboard (fill="viewport"); ChatScreen measures both and
  // pads the thread, so the last line always rests above the composer.
  return (
    <ChatScreen
      fill="viewport"
      className="companion"
      renderers={chartRenderers}
      header={
        <>
          <Link href={HOME_LINK.href} className="ck-glass" aria-label="Back to Substrata">
            <span aria-hidden="true">←</span> Substrata
          </Link>
          <span className="companion-title">Ask Substrata</span>
        </>
      }
      composer={
        <>
          {composer}
          <div className="companion-beside">{beside}</div>
        </>
      }
      footnote={who}
    >
      {thread}
    </ChatScreen>
  );
}
