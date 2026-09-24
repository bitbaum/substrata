'use client';

import { ChatThread } from './chat/ChatThread';
import { Composer } from './chat/Composer';
import { ContributeForm } from './chat/ContributeForm';
import { useAssistantStatus } from './chat/useAssistantStatus';
import { useByok } from './chat/useByok';
import { useChatSession } from './chat/useChatSession';

export function ResearchChat({
  topic,
  onPath,
  compact = false,
}: {
  topic: string;
  /** The page the reader is on, so the assistant can resolve "it" and "they". */
  onPath?: string;
  compact?: boolean;
}) {
  const { ai, models, model, setModel } = useAssistantStatus();
  const keys = useByok();
  const chat = useChatSession({ topic, onPath, model, byok: keys.byok });

  return (
    <div className={compact ? 'companion is-compact' : 'companion'}>
      <ChatThread
        turns={chat.turns}
        live={chat.live}
        busy={chat.busy}
        error={chat.error}
        receipt={chat.receipt}
        byok={keys.byok}
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
