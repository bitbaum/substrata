'use client';

import { useEffect, useId, useState } from 'react';
import { BYOK_VENDORS, byokVendor, type ByokVendorId } from '@bitbaum/ai-kit/byok';
import { admitKey } from '@/lib/byok-admit';
import { KeyStatus, ModelPicker } from './KeyCheckParts';
import type { AiKey } from './useAiKey';
import { useKeyCheck } from './useKeyCheck';

/**
 * Use any AI you have a key for — in the Ask panel and on /account/settings.
 *
 * One paste: pick the provider, paste the key, and it is checked with that
 * provider on the spot. If it works, the models it can use appear with the
 * strongest preselected; if not, the provider's own refusal is shown. "Use
 * this key" stays off until a check passed — a dead key is never kept, in the
 * browser or on the account. Without a key, Ask uses the free models this
 * site runs.
 */
export function AiKeyPanel({ keys, onDone }: { keys: AiKey; onDone?: () => void }) {
  const [mode, setMode] = useState<'view' | 'model' | 'replace'>('view');
  if (!keys.active) return <AddKey keys={keys} onDone={onDone} />;
  if (mode === 'replace')
    return <AddKey keys={keys} onDone={() => setMode('view')} onCancel={() => setMode('view')} />;
  if (mode === 'model') return <ChangeModel keys={keys} onDone={() => setMode('view')} />;
  return <ActiveKey keys={keys} onDone={onDone} onChange={setMode} />;
}

function useRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(step: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await step();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function ActiveKey({
  keys,
  onDone,
  onChange,
}: {
  keys: AiKey;
  onDone?: () => void;
  onChange: (mode: 'model' | 'replace') => void;
}) {
  const { busy, error, run } = useRun();
  const stored = keys.account?.stored;
  return (
    <div className="aikey" role="group" aria-label="Your AI key">
      <p className="aikey-status">
        Answering with <strong>{keys.active?.label}</strong>
        {stored
          ? ` — key ${stored.hint} sealed on your account.`
          : ' — key held in this browser only.'}
      </p>
      <div className="aikey-actions">
        <button type="button" className="aikey-quiet" onClick={() => onChange('model')}>
          Change model
        </button>
        <button type="button" className="aikey-quiet" onClick={() => onChange('replace')}>
          Replace key
        </button>
        <button
          type="button"
          className="aikey-quiet"
          disabled={busy}
          onClick={() => void run(async () => (await keys.remove(), onDone?.()))}
        >
          Remove key — use the free models
        </button>
      </div>
      {error && <p className="aikey-error">{error}</p>}
    </div>
  );
}

/** Pick another model for the key already kept — no paste needed, the kept key is checked. */
function ChangeModel({ keys, onDone }: { keys: AiKey; onDone: () => void }) {
  const id = useId();
  const { busy, error, run } = useRun();
  const stored = keys.account?.stored;
  const current = stored ?? keys.browser;
  const vendor = (current?.vendor ?? 'openrouter') as ByokVendorId;
  const kc = useKeyCheck(vendor, '', current?.model);
  const { run: check } = kc;
  const browserKey = stored ? undefined : keys.browser?.apiKey;

  useEffect(() => {
    // One check of the kept key when this opens — an external system.
    void check(vendor, browserKey);
  }, [check, vendor, browserKey]);

  const admission = admitKey(kc.check, kc.model);
  const label = byokVendor(vendor)?.label ?? vendor;
  return (
    <div className="aikey" role="group" aria-label="Change model">
      <KeyStatus status={kc.status} label={label} />
      {kc.check?.ok && (
        <ModelPicker
          id={`${id}-model`}
          check={kc.check}
          model={kc.model}
          onChange={kc.setModel}
          example={byokVendor(vendor)?.modelExample}
        />
      )}
      <div className="aikey-actions">
        <button
          type="button"
          disabled={busy || !admission.ok}
          onClick={() => void run(async () => (await keys.setModel(kc.model, kc.check), onDone()))}
        >
          Use this model
        </button>
        <button type="button" className="aikey-quiet" onClick={onDone}>
          Cancel
        </button>
      </div>
      {error && <p className="aikey-error">{error}</p>}
    </div>
  );
}

function AddKey({
  keys,
  onDone,
  onCancel,
}: {
  keys: AiKey;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const { busy, error, run } = useRun();
  const [vendor, setVendor] = useState<ByokVendorId>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [where, setWhere] = useState<'account' | 'browser'>('account');
  const kc = useKeyCheck(vendor, apiKey);
  const info = byokVendor(vendor);
  const label = info?.label ?? vendor;
  const canStore = Boolean(keys.account?.signedIn && keys.account.canStore);
  const target = canStore ? where : 'browser';
  const admission = admitKey(kc.check, kc.model);

  return (
    <div className="aikey" role="group" aria-label="Add your AI key">
      <div className="aikey-row">
        <label className="aikey-field" htmlFor={`${id}-vendor`}>
          <span>Provider</span>
          <select
            id={`${id}-vendor`}
            value={vendor}
            onChange={(e) => {
              setVendor(e.target.value as ByokVendorId);
              kc.reset();
            }}
          >
            {BYOK_VENDORS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="aikey-field aikey-grow" htmlFor={`${id}-key`}>
          <span>
            API key{' '}
            {info && (
              <a href={info.keyUrl} target="_blank" rel="noreferrer">
                get one from {label} ↗
              </a>
            )}
          </span>
          <input
            id={`${id}-key`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={`Paste your ${label} key${info?.keyHint ? ` (${info.keyHint})` : ''}`}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value.trim());
              kc.reset();
            }}
          />
        </label>
      </div>
      <KeyStatus
        status={kc.status}
        label={label}
        idle={`Checked with ${label} as soon as you paste it.`}
      />
      {kc.check?.ok && (
        <ModelPicker
          id={`${id}-model`}
          check={kc.check}
          model={kc.model}
          onChange={kc.setModel}
          example={info?.modelExample}
        />
      )}
      {canStore && (
        <fieldset className="aikey-where">
          <legend className="sr-only">Where to keep the key</legend>
          <label>
            <input
              type="radio"
              checked={where === 'account'}
              onChange={() => setWhere('account')}
            />{' '}
            On my account, sealed (works on any device)
          </label>
          <label>
            <input
              type="radio"
              checked={where === 'browser'}
              onChange={() => setWhere('browser')}
            />{' '}
            This browser only
          </label>
        </fieldset>
      )}
      <div className="aikey-actions">
        <button
          type="button"
          disabled={busy || !admission.ok}
          onClick={() =>
            void run(async () => {
              await keys.save({ vendor, apiKey, model: kc.model.trim() }, target, kc.check);
              setApiKey('');
              onDone?.();
            })
          }
        >
          {busy ? 'Saving…' : 'Use this key'}
        </button>
        {onCancel && (
          <button type="button" className="aikey-quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {error && <p className="aikey-error">{error}</p>}
      <p className="aikey-note">
        {target === 'account'
          ? 'Sealed (encrypted) on your Substrata account; the database alone cannot read it. '
          : `Kept in this browser only${keys.account?.signedIn ? '' : ' — sign in to keep it on your account'}. `}
        Each question sends it to {label} and nowhere else; your account there is billed, not
        Substrata&apos;s. The citation rules are the same with any model. Without a key, Ask uses
        the free models this site runs.
      </p>
    </div>
  );
}
