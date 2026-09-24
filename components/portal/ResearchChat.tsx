'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CHAT_STARTERS } from '@/config/substrata-chat';
import {
  BYOK_PROVIDERS,
  BYOK_PROVIDER_LABEL,
  byokModelLabel,
  type ByokConfig,
  type ByokProvider,
} from '@/lib/byok-shared';
import { clearByok, loadByok, saveByok } from '@/lib/byok-store';
import { Dictation } from './Dictation';

type Source = {
  number: number;
  id: string;
  title: string;
  href: string;
  evidence: string;
  primary: string[];
  kind: string;
};

type WebFinding = { title: string; url: string; excerpt: string };

/** A page the sweep found that nobody has reviewed. Never a finding. */
type Lead = {
  title: string;
  url: string;
  bottleneck: string;
  foundAt: string;
  verdict: string | null;
};

type Answer = {
  answer: string;
  sources: Source[];
  /** Open-web passages. Never corpus rows; rendered apart. */
  web?: WebFinding[];
  /** Unreviewed sweep leads the answer read. Rendered apart, labelled. */
  leads?: Lead[];
  /** Questions this assistant can answer, built from what it looked up. */
  followUps?: string[];
  /** What it looked up, in order. */
  trail?: string[];
  /** Whether the answer went past the corpus. Said on screen, not implied. */
  outside?: boolean;
  /** No model answered; this is the honest fallback. */
  degraded?: boolean;
};

type Turn = {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  web?: WebFinding[];
  leads?: Lead[];
  followUps?: string[];
  trail?: string[];
  outside?: boolean;
  degraded?: boolean;
};

type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'tool'; label: string }
  | { type: 'delta'; text: string }
  | { type: 'reset' }
  | { type: 'done'; data: Answer }
  | { type: 'error'; error: string };

/** Site links stay in the app; outside links open apart and carry no referrer. */
const MARKDOWN_COMPONENTS = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) =>
    href?.startsWith('/') || href?.startsWith('#') ? (
      <Link href={href}>{children}</Link>
    ) : href && /^https?:\/\//.test(href) ? (
      <a href={href} target="_blank" rel="noreferrer nofollow">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
};

function Markdown({ text }: { text: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        disallowedElements={['img', 'iframe', 'script', 'style']}
        components={MARKDOWN_COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function ResearchChat({
  topic,
  onPath,
  compact = false,
}: {
  topic: string;
  /** The page the reader is on, so the assistant can resolve "it" and "they". */
  onPath?: string;
  compact?: boolean;
}) {
  const [ai, setAi] = useState<'unknown' | 'up' | 'down'>('unknown');
  const [models, setModels] = useState<{ id: string; label: string }[]>([
    { id: 'auto', label: 'Auto' },
  ]);
  const [model, setModel] = useState('auto');
  // The reader's own key, if they have set one. Read once on mount — never
  // sent anywhere except as part of this component's own POST body, and never
  // written back except through `saveByok`/`clearByok` below.
  const [byok, setByok] = useState<ByokConfig | null>(() =>
    typeof window === 'undefined' ? null : loadByok(),
  );
  const [byokOpen, setByokOpen] = useState(false);
  const [byokDraft, setByokDraft] = useState<{
    provider: ByokProvider;
    apiKey: string;
    model: string;
  }>({ provider: 'openrouter', apiKey: '', model: '' });
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  // The answer while it is being written: what it has looked up so far, and
  // the text as it arrives.
  const [live, setLive] = useState<{ steps: string[]; text: string; status: string } | null>(null);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [contribute, setContribute] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy, live]);
  useEffect(() => {
    void fetch('/api/health')
      .then((r) => r.json())
      .then((j) => setAi(String(j.ai ?? '').startsWith('configured') ? 'up' : 'down'))
      .catch(() => setAi('down'));
    void fetch('/api/chat')
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.models) && j.models.length) setModels(j.models);
      })
      .catch(() => undefined);
  }, []);

  function saveByokDraft() {
    const config: ByokConfig = {
      provider: byokDraft.provider,
      apiKey: byokDraft.apiKey.trim(),
      model: byokDraft.model.trim(),
    };
    if (config.apiKey.length < 8 || config.model.length < 1) {
      setError('Enter a key and a model id.');
      return;
    }
    saveByok(config);
    setByok(config);
    setByokDraft({ provider: config.provider, apiKey: '', model: '' });
    setByokOpen(false);
    setError('');
  }

  function removeByok() {
    clearByok();
    setByok(null);
  }

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
    setLive({ steps: [], text: '', status: 'Reading the question…' });
    const history = [...turns, { role: 'user' as const, content: text }].slice(-8);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          // Sending 'auto' while byok is set would be ignored server-side
          // anyway (a BYOK request supplies its own model), but the free
          // model picker is hidden while byok is active, so this is always
          // what the reader actually chose.
          model,
          history: history.slice(0, -1).map((t) => ({ role: t.role, content: t.content })),
          onPath,
          topic: topic || undefined,
          ...(byok ? { byok } : {}),
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
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === 'error') throw new Error(event.error || 'Unavailable.');
          if (event.type === 'status') setLive((l) => l && { ...l, status: event.text });
          if (event.type === 'tool')
            setLive((l) => l && { ...l, steps: [...l.steps, event.label], status: event.label });
          if (event.type === 'delta') setLive((l) => l && { ...l, text: l.text + event.text });
          // The model decided to look something up after all: what it had
          // started writing is withdrawn rather than left as an answer.
          if (event.type === 'reset') setLive((l) => l && { ...l, text: '' });
          if (event.type === 'done') {
            // Every field, not two of them — `web` was once dropped here, and
            // an answer citing a passage the reader could not see went out.
            const data = event.data;
            setTurns((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: data.answer,
                sources: data.sources,
                web: data.web,
                leads: data.leads,
                followUps: data.followUps,
                trail: data.trail,
                outside: data.outside,
                degraded: data.degraded,
              },
            ]);
            setLive(null);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Connection lost. Please retry.');
    } finally {
      setBusy(false);
      setLive(null);
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
              {byok
                ? `answering as ${byokModelLabel(byok)}`
                : ai === 'up'
                  ? 'assistant connected'
                  : ai === 'down'
                    ? 'assistant unavailable'
                    : 'checking assistant'}
            </p>
            <h2>Ask the corpus.</h2>
            <p>
              {byok ? (
                <>
                  Running on your own key, not the shared free tier. Same corpus, same citation
                  rules — a numbered row is still the only thing that counts as a finding.
                </>
              ) : (
                <>
                  It knows the page you are on and, signed in, the rails you follow. It looks up
                  bottlenecks, companies, events and the sweep&apos;s newest leads as it answers,
                  and says which claims are sourced, which are unverified, and which are judgement.
                  Have a frontier model key? Add it below to skip the free tier.
                </>
              )}
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
            <p className="companion-who">
              {turn.role === 'user' ? 'You' : 'Substrata'}
              {turn.outside && (
                // The register, said out loud. An answer that went past the
                // corpus must not look like one that did not — and the wording
                // is what actually happened, since the ladder fires on any
                // answer the records could not carry, whether or not looking
                // found anything.
                <span className="companion-register">looked outside the corpus</span>
              )}
              {turn.degraded && <span className="companion-register">no AI answer</span>}
            </p>
            {turn.role === 'assistant' && turn.trail && turn.trail.length > 0 && (
              <ul className="companion-trail" aria-label="What it looked up">
                {turn.trail.map((step, k) => (
                  <li key={k}>{step}</li>
                ))}
              </ul>
            )}
            {turn.role === 'assistant' ? (
              <Markdown text={turn.content} />
            ) : (
              <p className="companion-user-text">{turn.content}</p>
            )}
            {turn.web && turn.web.length > 0 && (
              // Deliberately not in the citation list: [F#] means a corpus row
              // that a person accepted. These are leads from the open web.
              //
              // This block existed before and never rendered, because the
              // stream handler dropped `web`. Its classes were never checked
              // either: `border-strong` resolves to nothing (the token is
              // `--color-border-strong`), so the only thing that line did was
              // draw a border in the current text colour. Visual decisions
              // belong in globals.css in this repo, so it is a class now.
              <div className="companion-web">
                <p className="companion-web-label">From the open web · not checked by Substrata</p>
                <ul>
                  {turn.web.map((finding, index) => (
                    <li key={finding.url}>
                      {/* New tab: following a lead in place would drop the
                          conversation that produced it. */}
                      <a href={finding.url} target="_blank" rel="noreferrer nofollow">
                        [W{index + 1}] {finding.title} ↗
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="companion-web-note">
                  Nobody has verified these. Send one as a contribution if it should become a row.
                </p>
              </div>
            )}
            {turn.leads && turn.leads.length > 0 && (
              // The sweep's finds are news, not research: nobody has read them.
              <div className="companion-web">
                <p className="companion-web-label">
                  New leads from the sweep · not reviewed by anyone yet
                </p>
                <ul>
                  {turn.leads.map((lead) => (
                    <li key={lead.url}>
                      <a href={lead.url} target="_blank" rel="noreferrer nofollow">
                        {lead.title} ↗
                      </a>{' '}
                      <span>
                        {lead.bottleneck} · found {lead.foundAt.slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {turn.sources && turn.sources.length > 0 && (
              // Headed, because a bare "unverified" under an answer reads as a
              // verdict on the answer. It is the state of the row.
              <div className="companion-sources">
                <p className="companion-next-label">Records read for this answer</p>
                <ul>
                  {turn.sources.map((s) => (
                    <li key={s.id}>
                      <Link href={s.href}>{s.title}</Link>
                      <span>{s.evidence}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {turn.role === 'assistant' &&
              i === turns.length - 1 &&
              turn.followUps &&
              turn.followUps.length > 0 && (
                // No dead ends: an answer the corpus could not carry still ends
                // somewhere, and the somewhere is one tap away.
                <div className="companion-next">
                  <p className="companion-next-label">Ask next</p>
                  <div className="companion-next-row">
                    {turn.followUps.map((question) => (
                      <button
                        key={question}
                        type="button"
                        disabled={busy}
                        onClick={() => void ask(question)}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </article>
        ))}
        {live && (
          <article className="companion-turn is-assistant" aria-live="polite">
            <p className="companion-who">Substrata</p>
            {live.steps.length > 0 && (
              <ul className="companion-trail" aria-label="What it is looking up">
                {live.steps.map((step, k) => (
                  <li key={k}>{step}</li>
                ))}
              </ul>
            )}
            {live.text ? (
              <Markdown text={live.text} />
            ) : (
              <p className="companion-status">{live.status}</p>
            )}
          </article>
        )}
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
      {/*
        One field, not five controls in a row.

        This was a textarea above a `flex-wrap` bag holding a full-width native
        select, two square bordered boxes, a rounded filled button and a
        borderless one — four visual weights, wrapping into two ragged lines on
        a phone, with the model picker the loudest thing in the composer and the
        contribution form (a different action entirely) sitting inline with Ask.
        Now: the textarea and the tool bar share one border and read as a single
        surface; every quiet control is the same height, the same size and the
        same weight; Ask is the only filled thing and is always last; and
        sending evidence sits below on its own, because it does not ask
        anything.
      */}
      <form
        className="companion-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (contribute) return;
          void ask(draft);
        }}
      >
        <div className="companion-field">
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
          <div className="companion-bar">
            <div className="companion-tools">
              <Dictation
                disabled={busy}
                onTranscript={(text) => setDraft((d) => (d ? `${d} ${text}` : text))}
              />
              <label className="companion-tool">
                Attach
                <input
                  type="file"
                  accept=".txt,.md,.csv,.json"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    void file.text().then((text) => {
                      setDraft((d) =>
                        `${d}\n\nAttached ${file.name}:\n${text.slice(0, 2500)}`.trim(),
                      );
                    });
                  }}
                />
              </label>
              {byok ? (
                // A frontier model connected via the reader's own key replaces
                // the free-tier picker rather than sitting beside it — the
                // question the select answers ("which free model?") no longer
                // applies once a specific paid one is chosen.
                <button
                  type="button"
                  className="companion-byok-active"
                  onClick={() => setByokOpen((v) => !v)}
                  aria-expanded={byokOpen}
                  title="Answering with your own key — click to change or remove it"
                >
                  <strong>{BYOK_PROVIDER_LABEL[byok.provider]}</strong>
                  {` · ${byok.model}`}
                </button>
              ) : (
                <>
                  <label className="companion-model">
                    <span className="sr-only">Model</span>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={busy}
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="companion-tool"
                    onClick={() => setByokOpen((v) => !v)}
                    aria-expanded={byokOpen}
                  >
                    Frontier key
                  </button>
                </>
              )}
            </div>
            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="companion-send is-stop"
              >
                Stop
              </button>
            ) : (
              <button type="submit" className="companion-send" disabled={draft.trim().length < 3}>
                Ask
              </button>
            )}
          </div>
        </div>
        {byokOpen && (
          // Not a nested <form> — this composer is already one, and a <form>
          // inside a <form> is invalid HTML that browsers resolve
          // inconsistently. Every button below is explicitly type="button".
          <div className="companion-byok" role="group" aria-label="Frontier model key">
            {byok ? (
              <>
                <p>
                  Answering with your own key: <strong>{byokModelLabel(byok)}</strong>.
                </p>
                <div className="companion-byok-actions">
                  <button
                    type="button"
                    className="companion-byok-clear"
                    onClick={() => {
                      removeByok();
                      setByokOpen(false);
                    }}
                  >
                    Remove key and use the free tier
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="companion-byok-row">
                  <select
                    value={byokDraft.provider}
                    onChange={(e) =>
                      setByokDraft((d) => ({ ...d, provider: e.target.value as ByokProvider }))
                    }
                    aria-label="Provider"
                  >
                    {BYOK_PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {BYOK_PROVIDER_LABEL[p]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder="API key"
                    aria-label="API key"
                    value={byokDraft.apiKey}
                    onChange={(e) => setByokDraft((d) => ({ ...d, apiKey: e.target.value }))}
                  />
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Model id, e.g. gpt-5.1 or claude-opus-5"
                    aria-label="Model id"
                    value={byokDraft.model}
                    onChange={(e) => setByokDraft((d) => ({ ...d, model: e.target.value }))}
                  />
                </div>
                <div className="companion-byok-actions">
                  <button type="button" onClick={saveByokDraft}>
                    Use this key
                  </button>
                  <button
                    type="button"
                    className="companion-byok-clear"
                    onClick={() => setByokOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
                <p className="companion-byok-note">
                  Stored only in this browser — never on Substrata&apos;s servers — and sent
                  straight to {BYOK_PROVIDER_LABEL[byokDraft.provider]} with each question. A
                  frontier model answers with more room and less hedging than the free tier; the
                  citation rules (a finding is a numbered row, everything else is labelled) are the
                  same either way.
                </p>
              </>
            )}
          </div>
        )}
        <p className="companion-aside">
          Have a source we should hold?{' '}
          <button
            type="button"
            className="companion-contribute"
            onClick={() => setContribute((v) => !v)}
          >
            {contribute ? 'Cancel contribution' : 'Send evidence'}
          </button>
        </p>
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
