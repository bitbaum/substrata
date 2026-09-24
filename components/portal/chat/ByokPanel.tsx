'use client';

import {
  BYOK_PROVIDERS,
  BYOK_PROVIDER_LABEL,
  byokModelLabel,
  type ByokConfig,
  type ByokProvider,
} from '@/lib/byok-shared';
import type { ByokDraft } from './useByok';

/** The frontier-key panel under the composer: remove the saved key, or enter one. */
export function ByokPanel({
  byok,
  byokDraft,
  setByokDraft,
  onSave,
  onRemove,
  onClose,
}: {
  byok: ByokConfig | null;
  byokDraft: ByokDraft;
  setByokDraft: React.Dispatch<React.SetStateAction<ByokDraft>>;
  onSave: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    // Not a nested <form> — this composer is already one, and a <form>
    // inside a <form> is invalid HTML that browsers resolve
    // inconsistently. Every button below is explicitly type="button".
    <div className="companion-byok" role="group" aria-label="Frontier model key">
      {byok ? (
        <>
          <p>
            Answering with your own key: <strong>{byokModelLabel(byok)}</strong>.
          </p>
          <div className="companion-byok-actions">
            <button
              type="button"
              className="companion-byok-clear"
              onClick={() => {
                onRemove();
                onClose();
              }}
            >
              Remove key and use the free tier
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="companion-byok-row">
            <select
              value={byokDraft.provider}
              onChange={(e) =>
                setByokDraft((d) => ({ ...d, provider: e.target.value as ByokProvider }))
              }
              aria-label="Provider"
            >
              {BYOK_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {BYOK_PROVIDER_LABEL[p]}
                </option>
              ))}
            </select>
            <input
              type="password"
              autoComplete="off"
              placeholder="API key"
              aria-label="API key"
              value={byokDraft.apiKey}
              onChange={(e) => setByokDraft((d) => ({ ...d, apiKey: e.target.value }))}
            />
            <input
              type="text"
              autoComplete="off"
              placeholder="Model id, e.g. gpt-5.1 or claude-opus-5"
              aria-label="Model id"
              value={byokDraft.model}
              onChange={(e) => setByokDraft((d) => ({ ...d, model: e.target.value }))}
            />
          </div>
          <div className="companion-byok-actions">
            <button type="button" onClick={onSave}>
              Use this key
            </button>
            <button type="button" className="companion-byok-clear" onClick={onClose}>
              Cancel
            </button>
          </div>
          <p className="companion-byok-note">
            Stored only in this browser — never on Substrata&apos;s servers — and sent straight to{' '}
            {BYOK_PROVIDER_LABEL[byokDraft.provider]} with each question. A frontier model answers
            with more room and less hedging than the free tier; the citation rules (a finding is a
            numbered row, everything else is labelled) are the same either way.
          </p>
        </>
      )}
    </div>
  );
}
