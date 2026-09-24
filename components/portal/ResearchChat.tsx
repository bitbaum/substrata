'use client';

import { useEffect, useRef } from 'react';
import type { CheckRequest } from '@/lib/ask-bridge';
import { useAiKey } from './ai-key/useAiKey';
import { ChatThread } from './chat/ChatThread';
import { Composer } from './chat/Composer';
import { ContributeForm } from './chat/ContributeForm';
import { useAssistantStatus } from './chat/useAssistantStatus';
import { useChatSession } from './chat/useChatSession';

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
  const ran = useRef<number | null>(null);

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

  return (
    <div className={compact ? 'companion is-compact' : 'companion'}>
      <ChatThread
        turns={chat.turns}
        live={chat.live}
        busy={chat.busy}
        error={chat.error}
        receipt={chat.receipt}
        keyLabel={keys.active?.label ?? null}
        ai={ai}
        compact={compact}
        onAsk={chat.ask}
      />
      <Composer
        compact={compact}
        chat={chat}
        keys={keys}
        models={models}
        model={model}
        setModel={setModel}
      />
      {chat.contribute && <ContributeForm busy={chat.busy} onSubmit={chat.sendContribution} />}
    </div>
  );
}
