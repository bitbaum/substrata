'use client';

import { useEffect, useState } from 'react';
import { CommentThread, type CommentItem, type CommentTransport } from '@bitbaum/chatkit/react';

import { useReader } from '@/components/shell/useReader';
import { signInHref } from '@/lib/sign-in-href';

/** As /api/comments answers: a threadkit message, visible to the public. */
type Stored = { id: string; authorId: string; body: string; createdAt: string };

const FACTCHECK_AUTHOR = 'substrata-factcheck';

function toComment(item: Stored): CommentItem {
  return {
    id: item.id,
    author: item.authorId === FACTCHECK_AUTHOR ? 'Substrata' : 'Reader',
    body: item.body,
    createdAt: item.createdAt,
  };
}

async function loadComments(path: string): Promise<CommentItem[]> {
  const response = await fetch(`/api/comments?path=${encodeURIComponent(path)}`);
  const result = (await response.json()) as { data?: Stored[] };
  return (result.data ?? []).map(toComment);
}

/** The day, as the page has always shown it (YYYY-MM-DD, UTC). */
const day = (at: Date) => at.toISOString().slice(0, 10);

/**
 * The discussion under a note, a lesson, a resource or a profile. The thread
 * and its box are chatkit's `CommentThread` (the box is chatkit's Composer, so
 * it has the microphone); who may write is threadkit's, enforced by
 * /api/comments. Fact-check stays here: it is Substrata's, not the package's.
 */
export function PageDiscussion({ path }: { path: string }) {
  // `null` until loaded: CommentThread takes its list once, at mount.
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  // A new set (a fact-check landed) re-mounts the thread with it.
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState('');
  const [check, setCheck] = useState('');
  const [checking, setChecking] = useState(false);
  const reader = useReader(true);

  useEffect(() => {
    let live = true;
    void loadComments(path)
      .catch(() => [])
      .then((list) => {
        if (live) setComments(list);
      });
    return () => {
      live = false;
    };
  }, [path]);

  const transport: CommentTransport = {
    post: async (text) => {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, body: text }),
      });
      const result = (await response.json()) as { data?: Stored; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || 'Could not comment.');
      return toComment(result.data);
    },
  };

  async function factcheck() {
    setChecking(true);
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
      setComments(await loadComments(path));
      setGeneration((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fact-check failed.');
    } finally {
      setChecking(false);
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
          disabled={checking}
        >
          Fact-check with Substrata
        </button>
      </header>
      <p className="text-sm text-fg-tertiary">
        Comments use <code>threadkit</code> (permission is participation). Sign in with OrangeCat to
        write. Fact-check is the same assistant as Ask, grounded in the corpus.
      </p>
      {error && <p role="alert">{error}</p>}
      {check && (
        <article className="factcheck-panel">
          <h3>Fact-check</h3>
          <pre>{check}</pre>
        </article>
      )}
      {comments === null ? (
        <p className="text-sm text-fg-tertiary">Loading comments…</p>
      ) : (
        <CommentThread
          key={generation}
          comments={comments}
          transport={transport}
          viewer={reader?.signedIn ? { name: reader.name ?? 'you' } : null}
          signInHref={signInHref(path)}
          voice={{ transcribeUrl: '/api/transcribe' }}
          formatTime={day}
          headingLevel={3}
          labels={{ send: 'Comment', ariaLabel: 'Add a comment' }}
          className="page-discussion-thread"
        />
      )}
    </section>
  );
}
