'use client';

/**
 * The X-ray form. Holdings are read from the textarea or a CSV the reader
 * picks (read in the browser, never uploaded as a file), POSTed once to
 * /api/xray, and the answer is kept in this component's state only — no
 * URL, no storage, gone on reload.
 */
import { useState } from 'react';

import type { PortfolioXray } from '@/lib/xray/portfolio';
import { XrayReport, type Filing } from './XrayReport';

export type XrayResponse = PortfolioXray & { filings: Filing[] | null; filingDays: number };

export function XrayClient({ sample, signedIn }: { sample: string; signedIn: boolean }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<XrayResponse | null>(null);

  async function run(input: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/xray', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'The X-ray failed.');
      setResult(body as XrayResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The X-ray failed.');
    } finally {
      setBusy(false);
    }
  }

  function readFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(file.slice(0, 20_000));
  }

  return (
    <>
      <form
        className="xray-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(text);
        }}
      >
        <label className="xray-label" htmlFor="xray-input">
          Holdings, one per line — ticker, optional exchange, optional weight
        </label>
        <textarea
          id="xray-input"
          className="xray-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={sample}
          rows={9}
          spellCheck={false}
          autoComplete="off"
        />
        <div className="xray-actions">
          <button type="submit" className="research-button" disabled={busy || !text.trim()}>
            {busy ? 'X-raying…' : 'X-ray these holdings'}
          </button>
          <button
            type="button"
            className="research-button-ghost"
            onClick={() => {
              setText(sample);
              void run(sample);
            }}
            disabled={busy}
          >
            Try the sample
          </button>
          <label className="research-button-ghost xray-file">
            Read a CSV
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(e) => readFile(e.target.files?.[0])}
            />
          </label>
        </div>
      </form>
      {error && (
        <p className="xray-error" role="alert">
          {error}
        </p>
      )}
      {result && <XrayReport data={result} signedIn={signedIn} />}
    </>
  );
}
