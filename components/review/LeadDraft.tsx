import { EVENT_EFFECT_LABEL, EVENT_KIND_LABEL } from '@/config/substrata-events';
import { acceptLead, rejectLead } from '@/app/review/actions';
import type { LeadWithDraft } from '@/lib/event-draft-store';
import { BOTTLENECK_NAMES } from '@/lib/event-rules';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown source';
  }
}

const STATUS_LINE: Record<string, string> = {
  unusable: 'The model’s quote was not on the page word for word, so its draft was refused.',
  could_not_read: 'The page could not be fetched, so there is no draft.',
  duplicate: 'This page is already the source of an accepted event.',
};

/**
 * One lead: the AI draft as an editable form on the left, the source page
 * around the quote on the right. Accept validates the edited row against the
 * same rules as the corpus tests; nothing is published by it.
 */
export function LeadDraft({ lead, problem }: { lead: LeadWithDraft; problem?: string }) {
  const draft = lead.draft;
  const event = draft?.event ?? null;
  const suggestsEvent = draft?.status === 'drafted' && draft.suggestion === 'event';

  return (
    <li id={`lead-${lead.id}`} className="review-lead">
      <p className="research-kicker">
        {lead.bottleneck} · {hostOf(lead.url)} · found {lead.foundAt.slice(0, 10)}
        {draft?.model && ` · drafted by ${draft.model}, unreviewed`}
      </p>
      <h2>
        <a href={lead.url} target="_blank" rel="noreferrer noopener">
          {lead.title || lead.url}
        </a>
      </h2>

      {draft === null ? (
        <p className="review-note">Not drafted yet — the drafter takes the newest leads first.</p>
      ) : draft.status !== 'drafted' ? (
        <p className="review-note">{STATUS_LINE[draft.status]}</p>
      ) : (
        <p className={suggestsEvent ? 'review-verdict review-verdict-event' : 'review-verdict'}>
          AI suggests: {suggestsEvent ? 'an event' : 'not an event'} — {draft.reason}
        </p>
      )}
      {problem && (
        <p role="alert" className="review-problem">
          Not accepted: {problem}
        </p>
      )}

      <div className="review-pair">
        {event ? (
          <form action={acceptLead} className="review-form">
            <input type="hidden" name="id" value={lead.id} />
            <input type="hidden" name="source" value={event.source} />
            <label>
              Date it happened
              <input type="date" name="date" defaultValue={event.date} required />
            </label>
            <label>
              Headline
              <input name="headline" defaultValue={event.headline} maxLength={120} required />
            </label>
            <div className="review-row">
              <label>
                Kind
                <select name="kind" defaultValue={event.kind}>
                  {Object.entries(EVENT_KIND_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Effect
                <select name="effect" defaultValue={event.effect}>
                  {Object.entries(EVENT_EFFECT_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Countries
                <input name="jurisdictions" defaultValue={event.jurisdictions.join(', ')} />
              </label>
            </div>
            <label>
              Bottlenecks, one per line
              <textarea name="bottlenecks" rows={2} defaultValue={event.bottlenecks.join('\n')} />
            </label>
            <label>
              Participants, one per line (directory names only)
              <textarea name="participants" rows={2} defaultValue={event.participants.join('\n')} />
            </label>
            <label>
              Quote, word for word from the page
              <textarea name="quote" rows={3} defaultValue={event.quote} required />
            </label>
            <label className="review-check">
              <input type="checkbox" name="primary" defaultChecked={event.primary} />
              The source is the organisation’s own page or an official record
            </label>
            {draft && draft.notes.length > 0 && (
              <ul className="review-notes">
                {draft.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
            <details className="review-names">
              <summary>Bottleneck names this site accepts</summary>
              <p>{BOTTLENECK_NAMES.join(' · ')}</p>
            </details>
            <div className="review-actions">
              <button className="research-button">Accept event</button>
              <button className="research-button-ghost" formAction={rejectLead}>
                Not an event
              </button>
            </div>
          </form>
        ) : (
          <form action={rejectLead} className="review-actions">
            <input type="hidden" name="id" value={lead.id} />
            <button className="research-button-ghost">Not an event</button>
          </form>
        )}

        <blockquote className="review-source">
          <p className="research-kicker">
            {draft?.context ? 'The page around the quote' : 'What the sweep matched'}
          </p>
          {draft?.context ? (
            <p>
              {draft.context.before}
              <mark className="review-quote">{draft.context.quote}</mark>
              {draft.context.after}
            </p>
          ) : (
            <p>{lead.excerpt}</p>
          )}
        </blockquote>
      </div>
    </li>
  );
}
