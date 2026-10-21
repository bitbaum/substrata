'use client';

import { DetailsMenu } from '../DetailsMenu';
import type { AiKey } from '../ai-key/useAiKey';

const OWN_KEY = '__own-key__';

/**
 * The composer's own control, in chatkit's `tools` slot: which model answers.
 * By default, model options are tucked behind a toggle with a concise
 * explanation so the tool row remains clean, while allowing users to pick a
 * specific model or connect their own AI key.
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

  const currentLabel =
    models.find((m) => m.id === model)?.label ?? (model === 'auto' ? 'Auto' : model);

  return (
    <DetailsMenu className="ask-model-menu">
      <summary className="ask-tool ask-model-summary" title="AI model settings">
        <span className="ask-model-badge">Model: {currentLabel}</span>
      </summary>
      <div className="ask-model-panel">
        <p className="ask-model-desc">
          Answers route across free shared models automatically. Choose a specific model below or
          use your own key.
        </p>
        <label className="ask-model-select-label">
          <span className="sr-only">Choose AI model</span>
          <select
            value={model}
            onChange={(e) => {
              const target = e.target;
              if (target.value === OWN_KEY) {
                target.closest('details')?.removeAttribute('open');
                onToggleKey();
              } else {
                setModel(target.value);
                target.closest('details')?.removeAttribute('open');
              }
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
      </div>
    </DetailsMenu>
  );
}
