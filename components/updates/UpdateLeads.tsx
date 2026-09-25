import Link from 'next/link';

import type { UpdateLead } from '@/lib/update-shared';
import { whenLabel } from '@/lib/when';

/** What a lead's draft says, in one line — or nothing when it has none. */
function DraftLine({ draft }: { draft: NonNullable<UpdateLead['draft']> }) {
  if (draft.status === 'drafted' && draft.suggestion === 'event' && draft.headline)
    return (
      <p className="update-draft">
        <span className="update-tag">AI draft · for review</span> {draft.headline}
        {draft.date && <span className="update-meta"> · {draft.date}</span>}
      </p>
    );
  if (draft.status === 'drafted')
    return (
      <p className="update-draft">
        <span className="update-tag">AI read it</span> Probably not an event: {draft.reason}
      </p>
    );
  if (draft.status === 'duplicate')
    return (
      <p className="update-draft">
        <span className="update-tag">Already on file</span> {draft.reason}
      </p>
    );
  return (
    <p className="update-draft">
      <span className="update-tag">No draft</span>{' '}
      {draft.status === 'could_not_read'
        ? 'The page could not be read.'
        : 'The model’s quote was not on the page, so the draft was refused.'}
    </p>
  );
}

/**
 * The leads an update found. Labelled as leads — pages nobody here has read
 * — and never counted or coloured as findings; a draft is marked as a draft.
 */
export function UpdateLeads({ leads, now }: { leads: UpdateLead[]; now: Date }) {
  return (
    <ul className="update-leads">
      {leads.map((lead) => (
        <li key={lead.id}>
          <p className="update-meta">
            <span className="update-tag">Web lead · not yet reviewed</span>{' '}
            {whenLabel(lead.foundAt, now)} (found)
            {lead.bottleneckSlug && (
              <>
                {' · '}
                <Link href={`/bottlenecks/${lead.bottleneckSlug}`}>{lead.bottleneck}</Link>
              </>
            )}
          </p>
          <p className="update-title">
            <a href={lead.url} rel="noreferrer">
              {lead.title}
            </a>{' '}
            <span className="update-meta">{lead.host} ↗</span>
          </p>
          {lead.draft && <DraftLine draft={lead.draft} />}
        </li>
      ))}
    </ul>
  );
}
