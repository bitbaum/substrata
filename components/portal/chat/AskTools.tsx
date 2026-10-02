'use client';

import type { AiKey } from '../ai-key/useAiKey';

const OWN_KEY = '__own-key__';

/**
 * The composer's own control, in chatkit's `tools` slot: which model answers.
 * One quiet control: the free model list (its last choice opens the key
 * panel), or — once the reader added a key — the name of their own AI.
 */
export function AskTools({
  keys,
  models,
  model,
  setModel,
  busy,
  keyOpen,
  onToggleKey,
}: {
  keys: AiKey;
  models: { id: string; label: string }[];
  model: string;
  setModel: (model: string) => void;
  busy: boolean;
  keyOpen: boolean;
  onToggleKey: () => void;
}) {
  if (keys.active)
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
  // One control, not two: "your own key" is the last choice in the model list.
  // As two controls they wrapped the composer onto three rows on a phone.
  return (
    <label className="ask-tool ask-model">
      <span className="sr-only">Model</span>
      <select
        value={model}
        onChange={(e) => {
          if (e.target.value === OWN_KEY) onToggleKey();
          else setModel(e.target.value);
        }}
        disabled={busy}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
        <option value={OWN_KEY}>Use your own AI key…</option>
      </select>
    </label>
  );
}
