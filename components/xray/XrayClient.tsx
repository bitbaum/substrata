'use client';

/**
 * The X-ray form. Holdings are read from the textarea or a CSV the reader
 * picks (read in the browser, never uploaded as a file), POSTed once to
 * /api/xray, and the answer is kept in this component's state only — no
 * URL, no storage, gone on reload.
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Empty } from '@/components/portal/Empty';
import { XRAY_PLACEHOLDER } from '@/lib/xray/examples';
import type { PortfolioXray } from '@/lib/xray/portfolio';
import { XrayReport, type Filing } from './XrayReport';

export type XrayResponse = PortfolioXray & { filings: Filing[] | null; filingDays: number };

export function XrayClient({ sample, signedIn }: { sample: string; signedIn: boolean }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<XrayResponse | null>(null);
  const answer = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // A list pasted before the page finished loading is in the box but not in
  // state, which left the button grey with holdings on screen. Adopt it.
  useEffect(() => {
    if (box.current?.value) setText(box.current.value);
  }, []);

  // The answer replaces the form as the thing to read: bring it into view.
  useEffect(() => {
    if (!result || !answer.current) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    answer.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    answer.current.focus({ preventScroll: true });
  }, [result]);

  function trySample() {
    setText(sample);
    void run(sample);
  }

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
          ref={box}
          className="xray-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) void run(text);
          }}
          placeholder={XRAY_PLACEHOLDER}
          rows={6}
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
            onClick={trySample}
            disabled={busy}
          >
            Try a sample portfolio
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
      <div ref={answer} tabIndex={-1} className="xray-answer">
        {result && result.holdings.length === 0 ? (
          <Empty
            what="None of these lines could be read as a holding."
            next={result.unresolved
              .slice(0, 3)
              .map((u) => `${u.input}: ${u.reason}`)
              .join(' · ')}
            action={
              <>
                <button type="button" className="research-button-ghost" onClick={trySample}>
                  Try a sample portfolio
                </button>
                <a href="#xray-input">Edit the list</a>
                <Link href="/exposure">Look tickers up on Exposure</Link>
              </>
            }
          />
        ) : (
          result && <XrayReport data={result} signedIn={signedIn} />
        )}
      </div>
    </>
  );
}
