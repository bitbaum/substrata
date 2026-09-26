'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AiKeyPanel } from '@/components/portal/ai-key/AiKeyPanel';
import { useAiKey } from '@/components/portal/ai-key/useAiKey';
import {
  SUMMARISE_AT_ONCE,
  TOKENS_PER_DRAFT,
  needsDraft,
  type UpdateLead,
  type UpdateResult,
  type UpdateScope,
} from '@/lib/update-shared';
import { UpdateLeads } from './UpdateLeads';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function post<T>(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    ok: response.ok,
    status: response.status,
    data: (await response.json().catch(() => ({}))) as T,
  };
}

function sweepLine(r: UpdateResult): string {
  if (r.swept === 0)
    return `Searched within the last ${r.cooldownMinutes} minutes already — showing what that found.`;
  const blind = r.couldNotLook > 0 ? `; ${r.couldNotLook} could not be reached` : '';
  return `Searched the web for ${plural(r.swept, 'bottleneck')}: ${plural(r.found, 'new lead')}${blind}.`;
}

/**
 * "Update news now", on bottleneck pages, company pages and the desk.
 *
 * Step one searches the web (no AI, works signed out). Step two, "Summarise
 * with AI", drafts the new leads for review on the READER's own model; with no
 * key it explains why and offers the key panel instead of falling back to the
 * site's free AI, which is kept for questions.
 */
export function UpdateNews({
  scope,
  sweeping = false,
  refreshPage = false,
}: {
  scope: UpdateScope;
  /** A background sweep is running (the desk): reload once, a minute on. */
  sweeping?: boolean;
  /** Re-render the server page after an update (the desk's feed shows the leads itself). */
  refreshPage?: boolean;
}) {
  const router = useRouter();
  const keys = useAiKey();
  const [busy, setBusy] = useState<'update' | 'summarise' | null>(null);
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [message, setMessage] = useState('');
  const [askForKey, setAskForKey] = useState(false);
  const [panel, setPanel] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sweeping) return;
    const timer = window.setTimeout(() => router.refresh(), 60_000);
    return () => window.clearTimeout(timer);
  }, [sweeping, router]);

  async function update() {
    setBusy('update');
    setMessage('');
    const r = await post<UpdateResult & { error?: string }>('/api/updates', { scope }).catch(
      () => null,
    );
    setBusy(null);
    setFailed(!r?.ok);
    if (!r?.ok) return setMessage(r?.data.error ?? 'The update could not run just now.');
    setResult(r.data);
    setMessage(sweepLine(r.data));
    if (refreshPage) router.refresh();
  }

  const waiting = result?.leads.filter(needsDraft).slice(0, SUMMARISE_AT_ONCE) ?? [];

  async function summarise() {
    if (!keys.active) return setAskForKey(true);
    setBusy('summarise');
    setMessage('');
    const r = await post<{
      error?: string;
      needKey?: boolean;
      drafted?: number;
      stopped?: string | null;
      leads?: UpdateLead[];
    }>('/api/updates/draft', { ids: waiting.map((l) => l.id), ...keys.requestFields() }).catch(
      () => null,
    );
    setBusy(null);
    if (r?.data.needKey) return setAskForKey(true);
    if (!r?.ok) return setMessage(r?.data.error ?? 'The summary could not run just now.');
    const fresh = new Map((r.data.leads ?? []).map((l) => [l.id, l]));
    setResult((prev) => prev && { ...prev, leads: prev.leads.map((l) => fresh.get(l.id) ?? l) });
    setMessage(
      r.data.stopped
        ? `Stopped: ${r.data.stopped}`
        : `${plural(r.data.drafted ?? 0, 'draft')} written for review with ${keys.active.label}.`,
    );
  }

  return (
    <section className="update" aria-label="Update news">
      <div className="update-actions">
        <button type="button" className="update-button" onClick={update} disabled={busy !== null}>
          <span
            className={busy === 'update' ? 'update-icon is-spinning' : 'update-icon'}
            aria-hidden
          >
            ↻
          </span>
          {busy === 'update' ? 'Searching the web…' : 'Update news now'}
        </button>
        {result && waiting.length > 0 && (
          <button
            type="button"
            className="research-button-ghost"
            onClick={summarise}
            disabled={busy !== null}
          >
            {busy === 'summarise'
              ? 'Summarising…'
              : `Summarise ${plural(waiting.length, 'lead')} with AI`}
          </button>
        )}
      </div>
      <p className="update-note">
        {result && waiting.length > 0 && keys.active
          ? `Summaries run on ${keys.active.label} — your key, about ${TOKENS_PER_DRAFT.toLocaleString('en-US')} tokens a lead.`
          : 'Searching is free and needs no AI. Summaries use your own AI model.'}
      </p>
      <p role="status" className="update-status">
        {message}
        {failed && (
          <>
            {' '}
            <button type="button" className="update-retry" onClick={update}>
              Try again
            </button>
          </>
        )}
      </p>

      {askForKey && !keys.active && (
        <div className="update-key">
          <p>
            <strong>Summaries run on your own AI model.</strong> The free AI on this site is kept
            for readers’ questions, so it does not write summaries or run in the background. Connect
            a key from any provider you use: it stays in this browser, or — signed in — sealed on
            your account, where it can also run{' '}
            <Link href="/account/settings#auto-updates">automatic updates</Link> for your desk.
          </p>
          <div className="update-actions">
            <button type="button" className="research-button" onClick={() => setPanel((v) => !v)}>
              Connect your model
            </button>
            <Link href="/account/settings#ai" className="research-button-ghost">
              AI settings
            </Link>
          </div>
          {panel && <AiKeyPanel keys={keys} onDone={() => setPanel(false)} />}
        </div>
      )}

      {result &&
        (result.leads.length > 0 ? (
          <UpdateLeads leads={result.leads} now={new Date()} />
        ) : (
          <p className="update-note">
            No open web leads here right now. <Link href="/events">Read the verified events</Link>.
          </p>
        ))}
    </section>
  );
}
