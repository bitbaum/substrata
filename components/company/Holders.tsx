import { connection } from 'next/server';
import { ShareBars } from '@bitbaum/chartkit/react';

import { ownerRows } from '@/lib/company-page/business';
import { holdersOf, listingOf } from '@/lib/company-page/load';
import { BusinessRows } from './Business';
import { formatShare } from '@/lib/ownership';
import { EmptyState, SourceNote } from './parts';

const SOURCES = [
  'Schedules 13G and 13D (holders above 5%)',
  'the proxy statement’s ownership table (DEF 14A)',
  'an annual report’s major-shareholder note',
] as const;

/**
 * Who owns it, from filings: the named holders as one bar with the rest
 * labelled for what it is, then a row per holder — name, percent, shares,
 * as-of date, filing — and the remainder's explanation in words.
 */
export async function Holders({ slug, name }: { slug: string; name: string }) {
  await connection();
  const c = listingOf(slug);
  if (!c) {
    const owners = ownerRows(`company:${slug}`);
    return owners.length ? (
      <>
        <BusinessRows rows={owners} />
        <SourceNote>
          No listing is known, so no shareholder filings are read; these owners are stated by the
          sources on each row.
        </SourceNote>
      </>
    ) : (
      <EmptyState
        name={name}
        missing={`No owner of ${name} is recorded with a source, and no listing is known whose filings would name its shareholders.`}
        sources={SOURCES}
        topic="shareholders"
      />
    );
  }
  const v = await holdersOf(slug);
  if (!v || 'unavailable' in v)
    return (
      <EmptyState
        name={name}
        missing={v?.reason ?? 'No filing could be read.'}
        sources={SOURCES}
        topic="shareholders"
      />
    );
  if (!v.holders.length)
    return (
      <EmptyState
        name={name}
        missing={v.remainderWhyNot ?? `No holder of ${name} is named in the filings read.`}
        sources={SOURCES}
        topic="shareholders"
      />
    );
  const drawn = v.holders.filter((h) => !h.inGroup).slice(0, 10);
  return (
    <>
      {v.remainder && (
        <ShareBars
          rows={drawn.map((h) => ({ label: h.name, share: h.percent / 100, href: h.source.url }))}
          other={v.remainder.percent / 100}
          otherLabel={v.remainder.short}
          caption={`Holders of ${name} named in filings, each as of its own date, as a share of the class.`}
        />
      )}
      <ol className="mk-rows mk-holders">
        {v.holders.map((h) => (
          <li key={`${h.name}:${h.asOf}`} className="mk-row">
            <span className="mk-row-name">{h.name}</span>
            <span className="mk-row-figure">{formatShare(h.percent)}</span>
            <span className="mk-row-detail">
              {h.shares === null
                ? 'shares not stated'
                : `${h.shares.toLocaleString('en-US')} shares`}{' '}
              · as of {h.asOf} ·{' '}
              <a href={h.source.url} rel="noreferrer">
                {h.source.label} ↗
              </a>
              {h.inGroup ? ' · counted inside the directors-and-officers group' : ''}
              {h.note ? ` · ${h.note}` : ''}
            </span>
          </li>
        ))}
        {v.remainder && (
          <li className="mk-row">
            <span className="mk-row-name">{v.remainder.label}</span>
            <span className="mk-row-figure">
              {formatShare(Math.round(v.remainder.percent * 100) / 100)}
            </span>
            <span className="mk-row-detail">{v.remainder.explanation}</span>
          </li>
        )}
      </ol>
      <SourceNote>
        {v.institutionsNote} {v.notes.join(' ')}
      </SourceNote>
    </>
  );
}
