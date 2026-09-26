'use client';

import type { ReactNode } from 'react';
import type { KeyCheck } from '@/lib/byok-admit';
import type { CheckStatus } from './useKeyCheck';

/**
 * What the check said, in one line: checking, works (with how many models),
 * or the vendor's refusal in its own words. Announced to screen readers.
 */
export function KeyStatus({
  status,
  label,
  idle,
}: {
  status: CheckStatus;
  label: string;
  idle?: string;
}) {
  let body: ReactNode = idle ? <span className="aikey-hint">{idle}</span> : null;
  if (status.state === 'checking')
    body = <span className="aikey-hint">Checking with {label}…</span>;
  if (status.state === 'done')
    body = status.check.ok ? (
      <span className="aikey-ok">
        <span aria-hidden="true">✓ </span>
        {status.check.message}
      </span>
    ) : (
      <span className="aikey-error">
        <span aria-hidden="true">✕ </span>
        {status.check.message}
      </span>
    );
  return (
    <p className="aikey-check" aria-live="polite">
      {body}
    </p>
  );
}

/**
 * The models the key can use, strongest first and preselected. Free text only
 * when the vendor published no list — then there is nothing to choose from.
 */
export function ModelPicker({
  id,
  check,
  model,
  onChange,
  example,
}: {
  id: string;
  check: KeyCheck;
  model: string;
  onChange: (model: string) => void;
  example?: string;
}) {
  return (
    <label className="aikey-field" htmlFor={id}>
      <span>Model</span>
      {check.models.length > 0 ? (
        <select id={id} value={model} onChange={(e) => onChange(e.target.value)}>
          {check.models.map((m) => (
            <option key={m} value={m}>
              {m === check.suggested ? `${m} — strongest available` : m}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          spellCheck={false}
          autoComplete="off"
          placeholder={example ? `e.g. ${example}` : 'model id'}
          value={model}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {check.suggested && model === check.suggested && (
        <small className="aikey-hint">
          Chosen for you: the newest model in the strongest tier this key can use.
        </small>
      )}
    </label>
  );
}
