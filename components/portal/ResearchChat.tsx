'use client';
import { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
type Answer = {
  answer: string;
  sources: { number: number; title: string; href: string; evidence: string; primary: string[] }[];
};
export function ResearchChat({ topic, compact = false }: { topic: string; compact?: boolean }) {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [mode, setMode] = useState<'ask' | 'contribute'>('ask');
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setReceipt('');
    try {
      const response = await fetch(mode === 'ask' ? '/api/chat' : '/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'ask'
            ? { question: message, history: history.slice(-4) }
            : {
                message,
                topic,
                replyTo: form.get('replyTo'),
                creditName: form.get('creditName'),
                consent: form.get('consent') === 'on',
              },
        ),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Request failed. Please retry.');
      if (mode === 'ask') {
        setAnswer(result.data);
        setHistory((previous) => [
          ...previous,
          { role: 'user', content: message },
          { role: 'assistant', content: result.data.answer.slice(0, 4000) },
        ]);
        setMessage('');
      } else setReceipt(result.data.receipt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection lost. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="chat-layout">
      <div className="chat-main">
        {!compact && (
          <div className="chat-mode" role="group" aria-label="Message purpose">
            <button
              aria-pressed={mode === 'ask'}
              onClick={() => {
                setMode('ask');
                setError('');
              }}
            >
              Ask the assistant
            </button>
            <button
              aria-pressed={mode === 'contribute'}
              onClick={() => {
                setMode('contribute');
                setError('');
              }}
            >
              Send to the research team
            </button>
          </div>
        )}
        {topic && <p className="my-4 text-sm text-fg-secondary">Topic: {topic}</p>}
        {answer && (
          <article className="chat-answer" aria-label="Substrata answer">
            <h2>Substrata</h2>
            <div className="chat-markdown">
              <ReactMarkdown
                skipHtml
                remarkPlugins={[remarkGfm]}
                disallowedElements={['img', 'iframe', 'script', 'style']}
                urlTransform={(url) => (url.startsWith('#source-') ? url : '')}
              >
                {answer.answer.replace(/【(\d+)】|\[(\d+)\](?!\()/g, (_match, a, b) => {
                  const n = Number(a ?? b);
                  return answer.sources.some((s) => s.number === n)
                    ? `[${n}](#source-${n})`
                    : `[${n}]`;
                })}
              </ReactMarkdown>
            </div>
            <h3>Research to check</h3>
            <ol>
              {answer.sources.map((s) => (
                <li key={s.number} id={`source-${s.number}`}>
                  <Link href={s.href}>
                    [{s.number}] {s.title}
                  </Link>
                  <small>{s.evidence}</small>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs">
              AI explanations can be wrong. Open the linked records to check their evidence.
            </p>
          </article>
        )}
        <form onSubmit={send} className="research-form">
          <label htmlFor="chat-message">
            {mode === 'ask'
              ? 'What would you like to understand?'
              : 'What should the research team know?'}
          </label>
          <textarea
            id="chat-message"
            required
            minLength={mode === 'ask' ? 3 : 10}
            maxLength={mode === 'ask' ? 4000 : 12000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={compact ? 3 : 5}
            placeholder={
              mode === 'ask'
                ? 'How do materials constrain AI chips?'
                : 'Describe the claim, your proposed correction, and a public source…'
            }
          />
          {mode === 'contribute' && (
            <>
              <label htmlFor="reply-email">Reply email (optional)</label>
              <input id="reply-email" name="replyTo" type="email" maxLength={254} />
              <label htmlFor="credit-name">Credit name (optional)</label>
              <input id="credit-name" name="creditName" maxLength={120} />
              <label className="consent-line">
                <input type="checkbox" name="consent" required />
                Send this message to Substrata’s private research inbox for review. Only credit me
                if I supplied a credit name.
              </label>
              <p className="text-xs text-fg-secondary">
                Your message and optional contact details are stored for review. Please do not
                include confidential information. Ask the team to remove a submission by quoting its
                receipt.
              </p>
            </>
          )}
          {mode === 'ask' && (
            <p className="text-xs text-fg-secondary">
              Your question and relevant public research are sent to an AI provider to answer. Chat
              questions are not saved in the contribution inbox. Use the team tab to submit
              expertise or corrections.
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'ask' ? 'Ask Substrata' : 'Send contribution'}
          </button>
          <div aria-live="polite">
            {busy && <p>This can take a few seconds.</p>}
            {receipt && (
              <p className="receipt">
                Received in Substrata’s research inbox. Receipt: <code>{receipt}</code>. It is
                awaiting review.
              </p>
            )}
          </div>
          {error && <p role="alert">{error}</p>}
        </form>
      </div>
      {!compact && (
        <aside className="chat-aside">
          <h2>Start with a question</h2>
          {[
            'What are the bottlenecks in compute?',
            'Explain semiconductor qualification',
            'Which companies make silicon wafers?',
            'What expertise does this research need?',
          ].map((q) => (
            <button
              key={q}
              onClick={() => {
                setMode('ask');
                setMessage(q);
              }}
            >
              {q}
            </button>
          ))}
          <h2>Keep exploring</h2>
          <Link href="/atlas">Chain atlas →</Link>
          <Link href="/learn">Learn the concepts →</Link>
          <Link href="/data">How evidence is checked →</Link>
        </aside>
      )}
    </div>
  );
}
