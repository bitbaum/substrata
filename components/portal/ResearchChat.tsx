'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatApp, type ChatAppHandle } from '@bitbaum/chatkit/react';
import { localConversationStore } from '@bitbaum/chatkit';
import { HOME_LINK } from '@/config/site-nav';
import type { CheckRequest } from '@/lib/ask-bridge';
import { handedOver, SEND_PARAM } from '@/lib/chat/handoff';
import { logIdFor } from '@/lib/chat/log-id';
import { useAiKey } from './ai-key/useAiKey';
import { AskPanel } from './AskPanel';
import { AnswerFooter } from './chat/AnswerFooter';
import { askComposerProps, titleAfterAnswer } from './chat/askComposer';
import { AskTools } from './chat/AskTools';
import { askTransport, pendingChecks } from './chat/askTransport';
import { chartRenderers } from './chat/chartRenderers';
import { ComposerBeside } from './chat/ComposerBeside';
import { renderLink } from './chat/links';
import type { Turn } from './chat/types';
import { useAssistantStatus } from './chat/useAssistantStatus';
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
  starters,
}: {
  topic: string;
  /** The page the reader is on, so the assistant can resolve "it" and "they". */
  onPath?: string;
  compact?: boolean;
  /** The panel: shown or hidden (it stays mounted, so the chat survives Close). */
  open?: boolean;
  onClose?: () => void;
  /** A "Check this" request to send, as a new chat, as soon as the panel is open. */
  pending?: (CheckRequest & { id: number }) | null;
  /** The empty screen's questions: drawn from the corpus per facet (lib/starters.ts). */
  starters: readonly { label: string; question: string }[];
}) {
  const router = useRouter();
  const { ai, models, model, setModel } = useAssistantStatus();
  const keys = useAiKey();
  const contribution = useContribution(topic);
  const [keyOpen, setKeyOpen] = useState(false);
  const chat = useRef<ChatAppHandle>(null);
  // What the home box handed /chat (`?send=`, lib/chat/handoff.ts): ChatApp
  // sends it once, as a new chat. The panel is never handed anything.
  const [arrival] = useState(() =>
    compact || typeof window === 'undefined' ? null : handedOver(window.location.href),
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SEND_PARAM)) return;
    url.searchParams.delete(SEND_PARAM);
    window.history.replaceState(window.history.state, '', url);
  }, []);
  // "Check this" from a figure: a new chat, sent for the reader.
  const checked = useRef<number | null>(null);
  useEffect(() => {
    if (!pending || checked.current === pending.id) return;
    checked.current = pending.id;
    const subject = pending.value ? `${pending.value} — "${pending.claim}"` : `"${pending.claim}"`;
    const text = `Check this: ${subject}`;
    // The transport reads the claim's source with the turn that carries these words.
    pendingChecks.set(text, { claim: pending.claim, value: pending.value, source: pending.source });
    void chat.current?.send(text, [], { newChat: true });
  }, [pending]);

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
    <div className={compact ? 'companion is-compact' : 'companion'}>
      <ChatApp
        ref={chat}
        name="Ask Substrata"
        transport={transport}
        store={STORE}
        rememberKey={OPEN_CHAT_KEY}
        makeTitle={titleAfterAnswer}
        initialMessage={arrival}
        // A question from the home page (`/chat?q=`) is asked at once, as a new chat.
        deepLinkParam={compact ? undefined : 'q'}
        deepLinkAutoSend
        fill={compact ? 'parent' : 'viewport'}
        // The panel is ~30rem wide whatever the window: its chat list is the
        // drawer, never a rail that leaves the answer a 12rem column.
        railQuery={compact ? 'not all' : undefined}
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
