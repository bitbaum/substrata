'use client';

import { useId, useState } from 'react';
import { BYOK_VENDORS, byokVendor, type ByokVendorId } from '@bitbaum/ai-kit/byok';
import type { AiKey, ModelOption } from './useAiKey';

/**
 * Use any AI you have a key for — in the Ask panel and on /account/settings.
 *
 * Three steps, each one check: pick the provider, paste the key and let the
 * provider list the models it grants (a wrong key fails here, not on the
 * first question), pick a model. Signed in, the key can be sealed on the
 * account; otherwise it stays in this browser. Without a key, Ask uses the
 * free models this site runs.
 */
export function AiKeyPanel({ keys, onDone }: { keys: AiKey; onDone?: () => void }) {
  const id = useId();
  const [vendor, setVendor] = useState<ByokVendorId>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [where, setWhere] = useState<'account' | 'browser'>('account');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const info = byokVendor(vendor);
  const canStore = Boolean(keys.account?.signedIn && keys.account.canStore);
  const target = canStore ? where : 'browser';

  async function run(step: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await step();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  if (keys.active) {
    const stored = keys.account?.stored;
    const current = stored ?? keys.browser;
    return (
      <div className="aikey" role="group" aria-label="Your AI key">
        <p className="aikey-status">
          Answering with <strong>{keys.active.label}</strong>
          {keys.active.where === 'account'
            ? ` — key ${stored?.hint ?? ''} sealed on your account.`
            : ' — key held in this browser only.'}
        </p>
        {current && (
          <div className="aikey-row">
            <label className="aikey-field">
              <span>Model</span>
              <input
                list={`${id}-models`}
                defaultValue={current.model}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== current.model) void run(() => keys.setModel(next));
                }}
              />
            </label>
            <button
              type="button"
              className="aikey-quiet"
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  setModels(
                    await keys.listModels(
                      current.vendor,
                      stored ? undefined : keys.browser?.apiKey,
                    ),
                  ),
                )
              }
            >
              List its models
            </button>
          </div>
        )}
        <ModelList id={`${id}-models`} models={models} />
        <div className="aikey-actions">
          <button
            type="button"
            className="aikey-quiet"
            disabled={busy}
            onClick={() => void run(async () => (await keys.remove(), onDone?.()))}
          >
            Remove key — use the free models
          </button>
        </div>
        {message && <p className="aikey-error">{message}</p>}
      </div>
    );
  }

  return (
    <div className="aikey" role="group" aria-label="Add your AI key">
      <div className="aikey-row">
        <label className="aikey-field">
          <span>Provider</span>
          <select
            value={vendor}
            onChange={(e) => {
              setVendor(e.target.value as ByokVendorId);
              setModels(null);
              setModel('');
            }}
          >
            {BYOK_VENDORS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="aikey-field aikey-grow">
          <span>
            API key{' '}
            {info && (
              <a href={info.keyUrl} target="_blank" rel="noreferrer">
                get one ↗
              </a>
            )}
          </span>
          <input
            type="password"
            autoComplete="off"
            placeholder={info?.keyHint || 'API key'}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value.trim());
              setModels(null);
            }}
          />
        </label>
      </div>
      <div className="aikey-row">
        <button
          type="button"
          className="aikey-quiet"
          disabled={busy || apiKey.length < 8}
          onClick={() =>
            void run(async () => {
              const list = await keys.listModels(vendor, apiKey);
              setModels(list);
              if (!model && list[0]) setModel(pick(list, info?.modelExample));
            })
          }
        >
          {busy && !models ? 'Checking…' : 'Check key'}
        </button>
        <label className="aikey-field aikey-grow">
          <span>Model{models ? ` · ${models.length} available` : ''}</span>
          <input
            list={`${id}-models`}
            placeholder={info ? `e.g. ${info.modelExample}` : 'model id'}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </label>
      </div>
      <ModelList id={`${id}-models`} models={models} />
      {canStore ? (
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
      ) : null}
      <div className="aikey-actions">
        <button
          type="button"
          disabled={busy || apiKey.length < 8 || !model.trim()}
          onClick={() =>
            void run(async () => {
              await keys.save({ vendor, apiKey, model: model.trim() }, target);
              setApiKey('');
              onDone?.();
            })
          }
        >
          Use this key
        </button>
      </div>
      {message && <p className="aikey-error">{message}</p>}
      <p className="aikey-note">
        {target === 'account'
          ? 'Sealed (encrypted) on your Substrata account; the database alone cannot read it. '
          : `Kept in this browser only${keys.account?.signedIn ? '' : ' — sign in to keep it on your account'}. `}
        Each question sends it to {info?.label ?? 'the provider'} and nowhere else; your account
        there is billed, not Substrata&apos;s. The citation rules are the same with any model.
        Without a key, Ask uses the free models this site runs.
      </p>
    </div>
  );
}

function ModelList({ id, models }: { id: string; models: ModelOption[] | null }) {
  return (
    <datalist id={id}>
      {(models ?? []).map((m) => (
        <option key={m.id} value={m.id}>
          {m.tools === false ? 'no tool calls' : ''}
        </option>
      ))}
    </datalist>
  );
}

/** The vendor's example if it is on the list, otherwise the first model that declares tools. */
function pick(models: ModelOption[], example?: string): string {
  if (example && models.some((m) => m.id === example)) return example;
  return (models.find((m) => m.tools) ?? models[0]).id;
}
