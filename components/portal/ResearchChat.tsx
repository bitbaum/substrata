'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CHAT_STARTERS } from '@/config/substrata-chat';

type Source = {
  number: number;
  id: string;
  title: string;
  href: string;
  evidence: string;
  primary: string[];
  kind: string;
};

type Turn = {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
};

export function ResearchChat({ topic, compact = false }: { topic: string; compact?: boolean }) {
  const [ai, setAi] = useState<'unknown' | 'up' | 'down'>('unknown');
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [contribute, setContribute] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);
  useEffect(() => {
    void fetch('/api/health')
      .then((r) => r.json())
      .then((j) => setAi(String(j.ai ?? '').startsWith('configured') ? 'up' : 'down'))
      .catch(() => setAi('down'));
  }, []);

  async function ask(question: string) {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setError('');
    setReceipt('');
    setTurns((prev) => [...prev, { role: 'user', content: text }]);
    setDraft('');
    const history = [...turns, { role: 'user' as const, content: text }].slice(-8);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          history: history.slice(0, -1).map((t) => ({ role: t.role, content: t.content })),
        }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Request failed. Please retry.');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body.');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            data?: { answer: string; sources: Source[] };
            error?: string;
          };
          if (event.type === 'error') throw new Error(event.error || 'Unavailable.');
          if (event.type === 'done' && event.data) {
            setTurns((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: event.data!.answer,
                sources: event.data!.sources,
              },
            ]);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Connection lost. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  async function sendContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get('message') ?? '');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          topic,
          replyTo: form.get('replyTo'),
          creditName: form.get('creditName'),
          consent: form.get('consent') === 'on',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send.');
      setReceipt(result.data.receipt);
      setContribute(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? 'companion is-compact' : 'companion'}>
      <div className="companion-thread" ref={scroller}>
        {turns.length === 0 && (
          <div className="companion-empty">
            <p className="companion-kicker">
              Substrata ·{' '}
              {ai === 'up'
                ? 'assistant connected'
                : ai === 'down'
                  ? 'assistant unavailable'
                  : 'checking assistant'}
            </p>
            <h2>Ask the corpus.</h2>
            <p>
              Same engine as Cat and Loki: <code>@bitbaum/ai-kit</code>. Answers come from sourced
              rows, unverified leads, and judgements — labelled as such.
            </p>
            {!compact && (
              <div className="companion-starters">
                {CHAT_STARTERS.map((s) => (
                  <button key={s.question} type="button" onClick={() => ask(s.question)}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {turns.map((turn, i) => (
          <article key={i} className={`companion-turn is-${turn.role}`}>
            <p className="companion-who">{turn.role === 'user' ? 'You' : 'Substrata'}</p>
            {turn.role === 'assistant' ? (
              <div className="chat-markdown">
                <ReactMarkdown
                  skipHtml
                  remarkPlugins={[remarkGfm]}
                  disallowedElements={['img', 'iframe', 'script', 'style']}
                  components={{
                    a: ({ href, children }) =>
                      href?.startsWith('/') || href?.startsWith('#') ? (
                        <Link href={href}>{children}</Link>
                      ) : (
                        <span>{children}</span>
                      ),
                  }}
                >
                  {turn.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="companion-user-text">{turn.content}</p>
            )}
            {turn.sources && turn.sources.length > 0 && (
              <ul className="companion-sources">
                {turn.sources.map((s) => (
                  <li key={s.id}>
                    <Link href={s.href}>
                      {s.id} {s.title}
                    </Link>
                    <span>{s.evidence}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
        {busy && <p className="companion-status">Reading the corpus…</p>}
        {error && (
          <p role="alert" className="companion-error">
            {error}
          </p>
        )}
        {receipt && (
          <p className="receipt" role="status">
            Received. Reference {receipt}. Nothing is published until a reviewer reads it.
          </p>
        )}
      </div>
      <form
        className="companion-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (contribute) return;
          void ask(draft);
        }}
      >
        <label className="sr-only" htmlFor={compact ? 'dock-ask' : 'page-ask'}>
          Ask Substrata
        </label>
        <textarea
          id={compact ? 'dock-ask' : 'page-ask'}
          rows={compact ? 2 : 3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void ask(draft);
            }
          }}
          placeholder="Ask about a bottleneck, a company, a country, a rule…"
          maxLength={4000}
        />
        <div className="companion-actions">
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="research-button-ghost"
            >
              Stop
            </button>
          ) : (
            <button type="submit" className="research-button" disabled={draft.trim().length < 3}>
              Ask
            </button>
          )}
          <button
            type="button"
            className="companion-contribute"
            onClick={() => setContribute((v) => !v)}
          >
            {contribute ? 'Cancel contribution' : 'Send evidence'}
          </button>
        </div>
      </form>
      {contribute && (
        <form onSubmit={sendContribution} className="inquire-form companion-inbox">
          <label htmlFor="contrib-message">What should the research team know?</label>
          <textarea id="contrib-message" name="message" required minLength={10} rows={4} />
          <label htmlFor="contrib-email">Reply email (optional)</label>
          <input id="contrib-email" name="replyTo" type="email" />
          <label htmlFor="contrib-credit">Credit name (optional)</label>
          <input id="contrib-credit" name="creditName" maxLength={120} />
          <label className="consent-line">
            <input type="checkbox" name="consent" required />
            Send this to the private inbox. It does not publish.
          </label>
          <button type="submit" className="research-button" disabled={busy}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}
