'use client';

import type { AiKey } from '../ai-key/useAiKey';

/**
 * The composer's own control, in chatkit's `tools` slot: the reader's own AI
 * key, when one is set — its label, a tap opens the key panel. Without a
 * key there is NOTHING here: the composer is microphone and send, like the
 * ChatGPT, Grok and Claude apps'. An "Auto" model label used to sit in this
 * slot on every composer (owner, 2026-10-23: "this is terrible"); the
 * shared models route themselves, and the way to a key is the one line
 * under the composer.
 */
export function AskTools({
  keys,
  keyOpen,
  onToggleKey,
}: {
  keys: AiKey;
  keyOpen: boolean;
  onToggleKey: () => void;
}) {
  if (!keys.active) return null;
  return (
    <button
      type="button"
      className="ask-tool"
      onClick={onToggleKey}
      aria-expanded={keyOpen}
      title="Answering with your own AI key — change or remove it"
    >
      {keys.active.label}
    </button>
  );
}

/**
 * Which of the shared free models answers, for a reader with no key of
 * their own. Shown with the key panel, never in the composer: a preference
 * most readers never touch does not earn a place beside the send button.
 */
export function SharedModelSelect({
  models,
  model,
  setModel,
  busy,
}: {
  models: { id: string; label: string }[];
  model: string;
  setModel: (model: string) => void;
  busy: boolean;
}) {
  if (models.length < 2) return null;
  return (
    <label className="ask-model-select">
      <span>Shared model</span>
      <select value={model} onChange={(e) => setModel(e.target.value)} disabled={busy}>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}
