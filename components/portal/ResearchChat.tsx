'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { ChatApp } from '@bitbaum/chatkit/react';
import { localConversationStore } from '@bitbaum/chatkit';
import { HOME_LINK } from '@/config/site-nav';
import type { CheckRequest } from '@/lib/ask-bridge';
import { SEND_PARAM } from '@/lib/chat/handoff';
import { logIdFor } from '@/lib/chat/log-id';
import { useAiKey } from './ai-key/useAiKey';
import { AskPanel } from './AskPanel';
import { AnswerFooter } from './chat/AnswerFooter';
import { askComposerProps, titleAfterAnswer } from './chat/askComposer';
import { AskTools } from './chat/AskTools';
import { askTransport } from './chat/askTransport';
import { chartRenderers } from './chat/chartRenderers';
import { ComposerBeside } from './chat/ComposerBeside';
import { renderLink } from './chat/links';
import type { Turn } from './chat/types';
import { useAssistantStatus } from './chat/useAssistantStatus';
import { useAutoAsk } from './chat/useAutoAsk';
import { useContribution } from './chat/useContribution';

/** The device's chats, one store for the panel and /chat: Expand opens the same chat. */
const STORE = localConversationStore({ key: 'substrata-ask' });
/** Which chat was open, so a reload — or Expand — reopens it. */
export const OPEN_CHAT_KEY = 'substrata-ask:open';

/** The log ids of answers on screen, so a thumb reaches the turn it is about. */
const logIds = new Map<string, string>();

/**
 * Ask: the fleet's chat app — chatkit's `ChatApp`, the same header (Chats ·
 * title · New chat · …), chat list, temporary chat, titles, queue, Stop and
 * reload as Heidi, Loki and OrangeCat — with Substrata's evidence in its
 * slots: the transport (chat/askTransport.ts), charts drawn by chartkit, the
 * tables, leads and web pages under each answer (AnswerFooter), the key and
 * "Send evidence" beside the composer. A fix to how chatting works belongs in
 * bitbaum/chatkit.
 *
 * Two frames, one chat: `compact` is the panel over a page (AskPanel), the
 * page is /chat. Both read the same device store and the same open chat, so
 * Expand is only a bigger frame. Readers keep their chats on this device;
 * Substrata keeps no conversations on its server.
 */
export function ResearchChat({
  topic,
  onPath,
  compact = false,
  open = true,
  onClose,
  pending,
  start,
  starters,
}: {
  topic: string;
  /** The page the reader is on, so the assistant can resolve "it" and "they". */
  onPath?: string;
  compact?: boolean;
  /** The panel: shown or hidden (it stays mounted, so the chat survives Close). */
  open?: boolean;
  onClose?: () => void;
  /** A "Check this" request to send as soon as the panel is open. */
  pending?: (CheckRequest & { id: number }) | null;
  /** A question to send as soon as the page opens (`/chat?q=`). */
  start?: string;
  /** The empty screen's questions: drawn from the corpus per facet (lib/starters.ts). */
  starters: readonly { label: string; question: string }[];
}) {
  const router = useRouter();
  const { ai, models, model, setModel } = useAssistantStatus();
  const keys = useAiKey();
  const contribution = useContribution(topic);
  const [keyOpen, setKeyOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  // A message arriving from elsewhere is a new question: it opens a new chat,
  // not the one that was open (ChatApp reopens the remembered chat on load).
  useState(() => {
    if (typeof window === 'undefined') return;
    const fresh = start || pending || new URL(window.location.href).searchParams.has(SEND_PARAM);
    if (fresh)
      try {
        window.localStorage.removeItem(OPEN_CHAT_KEY);
      } catch {
        // Blocked storage: nothing was remembered either.
      }
  });
  useAutoAsk(root, pending, start);

  // ChatApp reads the newest transport at send time, so a changed model or key applies at once.
  const keyFields = keys.requestFields;
  const transport = useMemo(
    () => askTransport({ topic, onPath, model: () => model, keyFields }),
    [topic, onPath, model, keyFields],
  );

  const toggleKey = () => setKeyOpen((v) => !v);
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

  const app = (
    <div ref={root} className={compact ? 'companion is-compact' : 'companion'}>
      <ChatApp
        name="Ask Substrata"
        transport={transport}
        store={STORE}
        rememberKey={OPEN_CHAT_KEY}
        makeTitle={titleAfterAnswer}
        fill={compact ? 'parent' : 'viewport'}
        starters={starters.map((s) => ({ label: s.label, prompt: s.question }))}
        startersTitle="Ask about a bottleneck, a company or a rule — or add a screenshot of a post and its claims are checked."
        composer={{
          ...askComposerProps(),
          density: 'compact',
          tools: <AskTools keys={keys} keyOpen={keyOpen} onToggleKey={toggleKey} />,
        }}
        thread={{
          renderLink,
          renderers: chartRenderers,
          // Copy · Listen · Share under every answer, the fleet's row.
          share: { title: 'Ask Substrata' },
          labels: { replies: 'Reply or ask next' },
          renderFooter: (m) => {
            if (m.role !== 'assistant' || m.failed) return null;
            const turn = m as unknown as Turn & { logId?: string };
            if (turn.logId) logIds.set(m.id, turn.logId);
            return <AnswerFooter turn={turn} />;
          },
          onFeedback: (f) =>
            void fetch('/api/chat/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...f,
                conversationId: f.conversationId ? logIdFor(f.conversationId) : null,
                messageId: logIds.get(f.messageId) ?? f.messageId,
              }),
            }).catch(() => {
              // Thanks was already said; a lost thumb is not the reader's problem.
            }),
        }}
        headerStart={
          compact ? undefined : (
            <Link href={HOME_LINK.href} className="ck-glass" aria-label="Back to Substrata">
              <span aria-hidden="true">←</span>
            </Link>
          )
        }
        footnote={
          <>
            {who}
            <span className="companion-beside">
              <ComposerBeside
                chat={contribution}
                keys={keys}
                keyOpen={keyOpen}
                onKeyDone={() => setKeyOpen(false)}
                models={models}
                model={model}
                setModel={setModel}
              />
            </span>
          </>
        }
      />
    </div>
  );

  if (compact)
    return (
      <AskPanel
        open={open}
        title="Ask Substrata"
        onClose={() => onClose?.()}
        onExpand={() => {
          onClose?.();
          router.push('/chat');
        }}
      >
        {app}
      </AskPanel>
    );
  return app;
}
