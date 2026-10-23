'use client';

import type { Turn } from './types';

/**
 * What sits under an answer, in chatkit's `renderFooter` slot: Substrata's
 * evidence, which no generic chat has. Two registers that are never merged —
 * unreviewed sweep leads and unchecked web pages. The corpus records the
 * answer read are the thought row ABOVE it ("Thought for 12s › Read 3
 * records", `thinking.ts`), the way every chat app shows what it did; a
 * record count under the answer was a stray line nobody could place.
 * The look is chatkit's; only the content is Substrata's.
 *
 * Where to go next is NOT here: the follow-up questions join the suggested
 * replies in chatkit's one row under the latest answer (`lib/ask-row.ts`), so
 * an answer never carries two rows of buttons.
 */
export function AnswerFooter({ turn }: { turn: Turn }) {
  const leads = turn.leads ?? [];
  const web = turn.web ?? [];
  if (!leads.length && !web.length && !turn.verdict && !turn.outside && !turn.degraded) return null;

  return (
    <div className="answer-footer">
      {(turn.verdict || turn.outside || turn.degraded) && (
        <p className="answer-tags">
          {turn.verdict && (
            <span className={`answer-verdict is-${turn.verdict.toLowerCase()}`}>
              {turn.verdict}
            </span>
          )}{' '}
          {/* Said on screen, not implied: an answer past the corpus must not
              look like one that stayed inside it. */}
          {turn.outside && <span className="answer-tag">Looked outside the corpus</span>}{' '}
          {turn.degraded && <span className="answer-tag">No AI answer</span>}
        </p>
      )}

      {leads.length > 0 && (
        // News the sweep found that nobody has read: never a finding.
        <details className="answer-block">
          <summary>
            {leads.length} new lead{leads.length === 1 ? '' : 's'} · not reviewed yet
          </summary>
          <ul>
            {leads.map((lead) => (
              <li key={lead.url}>
                <a href={lead.url} target="_blank" rel="noreferrer nofollow">
                  {lead.title} ↗
                </a>{' '}
                <span className="answer-evidence">
                  {lead.bottleneck} · found {lead.foundAt.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {web.length > 0 && (
        <details className="answer-block">
          <summary>
            {web.length} web page{web.length === 1 ? '' : 's'} · not checked by Substrata
          </summary>
          <ul>
            {web.map((finding, index) => (
              <li key={finding.url}>
                <a href={finding.url} target="_blank" rel="noreferrer nofollow">
                  [W{index + 1}] {finding.cited ? 'Cited source: ' : ''}
                  {finding.title} ↗
                </a>
                {finding.excerpt && <blockquote>{finding.excerpt}</blockquote>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
