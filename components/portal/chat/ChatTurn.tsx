'use client';

import Link from 'next/link';
import { Markdown } from './Markdown';
import type { LiveAnswer, Turn } from './types';

/** One finished turn: who said it, what it looked up, the text, and what it read. */
export function ChatTurn({
  turn,
  isLast,
  busy,
  onAsk,
}: {
  turn: Turn;
  isLast: boolean;
  busy: boolean;
  onAsk: (question: string) => Promise<void>;
}) {
  return (
    <article className={`companion-turn is-${turn.role}`}>
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
      {turn.role === 'assistant' && isLast && turn.followUps && turn.followUps.length > 0 && (
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
                onClick={() => void onAsk(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

/** The answer while it is being written. */
export function LiveTurn({ live }: { live: LiveAnswer }) {
  return (
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
  );
}
