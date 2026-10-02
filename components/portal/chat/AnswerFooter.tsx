'use client';

import Link from 'next/link';
import type { Turn } from './types';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * What sits under an answer, in chatkit's `renderFooter` slot: Substrata's
 * evidence, which no generic chat has. Three registers that are never merged —
 * corpus records, unreviewed sweep leads, unchecked web pages — then where to
 * go next. The look is chatkit's; only the content is Substrata's.
 */
export function AnswerFooter({
  turn,
  isLast,
  busy,
  onAsk,
}: {
  turn: Turn;
  isLast: boolean;
  busy: boolean;
  onAsk: (question: string) => void;
}) {
  const sources = turn.sources ?? [];
  const leads = turn.leads ?? [];
  const web = turn.web ?? [];
  const next = isLast ? (turn.followUps ?? []) : [];
  if (
    !sources.length &&
    !leads.length &&
    !web.length &&
    !next.length &&
    !turn.verdict &&
    !turn.outside &&
    !turn.degraded
  )
    return null;

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

      {sources.length > 0 && (
        <details className="answer-block">
          <summary>
            {sources.length} record{sources.length === 1 ? '' : 's'} read
          </summary>
          <ul>
            {sources.map((s) => (
              <li key={s.id}>
                <Link href={s.href}>{s.title}</Link>{' '}
                <span className="answer-evidence">{s.evidence}</span>
                {s.primary
                  .filter((url) => /^https?:\/\//.test(url))
                  .slice(0, 2)
                  .map((url) => (
                    <span key={url}>
                      {' '}
                      <a href={url} target="_blank" rel="noreferrer nofollow">
                        {hostOf(url)} ↗
                      </a>
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        </details>
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

      {next.length > 0 && (
        <div className="answer-next" aria-label="Ask next">
          {next.map((question) => (
            <button key={question} type="button" disabled={busy} onClick={() => onAsk(question)}>
              {question}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
