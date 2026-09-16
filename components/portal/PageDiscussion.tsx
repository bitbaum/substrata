'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Item = { id: string; authorId: string; body: string; createdAt: string };

export function PageDiscussion({ path }: { path: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [check, setCheck] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch(`/api/comments?path=${encodeURIComponent(path)}`);
    const result = await response.json();
    setItems(result.data ?? []);
  }

  useEffect(() => {
    let live = true;
    void fetch(`/api/comments?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((result) => {
        if (live) setItems(result.data ?? []);
      });
    return () => {
      live = false;
    };
  }, [path]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not comment.');
      setBody('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not comment.');
    } finally {
      setBusy(false);
    }
  }

  async function factcheck() {
    setBusy(true);
    setError('');
    setCheck('');
    try {
      const response = await fetch('/api/factcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Fact-check failed.');
      setCheck(result.data.answer);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fact-check failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-discussion">
      <header className="page-discussion-head">
        <h2>Discussion</h2>
        <button
          type="button"
          className="research-button-ghost"
          onClick={() => void factcheck()}
          disabled={busy}
        >
          Fact-check with Substrata
        </button>
      </header>
      <p className="text-sm text-fg-tertiary">
        Comments use <code>threadkit</code> (permission is participation). Sign in with OrangeCat to
        write. Fact-check is the same assistant as Ask, grounded in the corpus.
      </p>
      {check && (
        <article className="factcheck-panel">
          <h3>Fact-check</h3>
          <pre>{check}</pre>
        </article>
      )}
      <ul className="page-comments">
        {items.length === 0 && <li className="text-sm text-fg-tertiary">No comments yet.</li>}
        {items.map((item) => (
          <li key={item.id}>
            <p className="comment-meta">
              {item.authorId === 'substrata-factcheck' ? 'Substrata' : 'Reader'} ·{' '}
              {new Date(item.createdAt).toISOString().slice(0, 10)}
            </p>
            <p>{item.body}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="comment-form">
        <label htmlFor="comment-body">Add a comment</label>
        <textarea
          id="comment-body"
          required
          minLength={3}
          maxLength={4000}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="submit" className="research-button" disabled={busy}>
          Comment
        </button>
        <p className="text-xs text-fg-tertiary">
          Need an account? <Link href="/account">Sign in</Link>.
        </p>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
