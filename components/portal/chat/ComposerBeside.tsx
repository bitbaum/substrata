'use client';

import { AiKeyPanel } from '../ai-key/AiKeyPanel';
import type { useAiKey } from '../ai-key/useAiKey';
import { SharedModelSelect } from './AskTools';
import { ContributeForm } from './ContributeForm';
import type { useAssistantStatus } from './useAssistantStatus';
import type { useChatSession } from './useChatSession';

type Status = ReturnType<typeof useAssistantStatus>;

/**
 * What belongs with the composer: the key panel it opens (with the shared
 * models for a reader without one), and the way to hand us a source. One
 * shape in the panel and on the page.
 */
export function ComposerBeside({
  chat,
  keys,
  keyOpen,
  onKeyDone,
  models,
  model,
  setModel,
}: {
  chat: ReturnType<typeof useChatSession>;
  keys: ReturnType<typeof useAiKey>;
  keyOpen: boolean;
  onKeyDone: () => void;
  models: Status['models'];
  model: Status['model'];
  setModel: Status['setModel'];
}) {
  return (
    <>
      {keyOpen && (
        <div className="ask-key">
          {!keys.active && (
            <SharedModelSelect models={models} model={model} setModel={setModel} busy={chat.busy} />
          )}
          <AiKeyPanel keys={keys} onDone={() => onKeyDone()} />
        </div>
      )}
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
    </>
  );
}
