import Link from 'next/link';

import { ShareBars } from '@bitbaum/chartkit/react';
import { Ticker } from '@/components/exposure/Ticker';
import { correctionUrl } from '@/lib/site';
import { hostOf } from '../../desk';
import type { Entity } from '../../entities/types';
import { listingFor } from '../../listings';
import { formatShare, holderDetail, ownershipView, type OwnershipView } from '../../ownership';
import { marketHref, slugify } from '../../links';
import { participantBySlug } from '../../participants';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';
import { CAPS, LINK, NAME } from './company';

interface OwnershipData {
  slug: string;
  name: string;
  view: OwnershipView;
}

/**
 * Who owns it: named holders as bars on one scale, each with the document
 * its figure was read from; a private firm says who owns it; a subsidiary
 * says whose shares the bars are of. Nothing is drawn for a share nobody
 * read off a document — such a row shows its name and "no figure on record",
 * which is the same honesty an unsourced producer row has.
 */
const ownership: ProfileModule<OwnershipData> = {
  id: 'ownership',
  title: t('profile.ownership.title'),
  appliesTo: ['company'],
  importance: 20,
  load(entity: Entity) {
    if (entity.kind !== 'company') return null;
    const p = participantBySlug(entity.key);
    if (!p) return null;
    const view = ownershipView(entity.key);
    // A listed company with no rows yet has nothing to say; a private one or a
    // subsidiary says so even without rows, because that IS the answer.
    if (!view.recorded && view.status === 'listed') return null;
    return { slug: entity.key, name: p.name, view };
  },
  evidence: ({ view }) =>
    view.holders.length === 0
      ? 'from the listing record'
      : `${view.sourced.length} of ${view.holders.length} holders sourced`,
  Render({ data: { slug, name, view } }) {
    const listing = listingFor(slug);
    const parentSlug =
      view.parent && participantBySlug(slugify(view.parent)) ? slugify(view.parent) : null;
    // The bar draws only shares read off a document; a lead is named under it.
    const bars = view.sourced.map((h) => ({
      label: h.name,
      share: (h.share ?? 0) / 100,
      href: h.source,
    }));
    return (
      <>
        <p className="mb-4 max-w-prose text-sm leading-relaxed text-fg-secondary">
          <span className="font-medium text-fg-primary">{view.line}.</span>{' '}
          {view.status === 'subsidiary' && view.parent && (
            <>
              The shares below are of{' '}
              {parentSlug ? (
                <Link href={marketHref(parentSlug)} className={LINK}>
                  {view.parent}
                </Link>
              ) : (
                view.parent
              )}
              , not of {name}.{' '}
            </>
          )}
          {listing && (listing.status === 'listed' || listing.status === 'parent') && (
            <>
              Trades as <Ticker listing={listing} />.{' '}
            </>
          )}
          {view.holders.length === 0 && (
            <>No holder of {view.parent ?? name} has been read off a document yet.</>
          )}
        </p>
        {bars.length > 0 && (
          <ShareBars
            rows={bars}
            other={view.rest !== null ? view.rest / 100 : undefined}
            caption={`Named holders of ${view.parent ?? name} as a share of its stock, each read from the document on its row below; "Other" is the rest, public float included.`}
          />
        )}
        {view.holders.length > 0 && (
          <ol className="mt-4 divide-y divide-subtle border-y border-subtle">
            {view.holders.map((h) => (
              <li
                key={h.name}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0 py-2"
              >
                <a href={h.source} rel="noreferrer" className={NAME}>
                  {h.name}
                </a>
                <span className="text-right font-mono text-sm tabular-nums">
                  {h.share === null ? (
                    <span className="text-fg-muted">no figure on record</span>
                  ) : (
                    <span className="text-fg-primary">{formatShare(h.share)}</span>
                  )}
                </span>
                <span className="col-span-2 max-w-prose pb-1 text-xs leading-relaxed text-fg-tertiary">
                  {holderDetail(h)} · {hostOf(h.source)} ↗{h.note ? ` · ${h.note}` : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
        {view.holders.length > 0 && (
          <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
            Each figure is as of the date on its row, read from the document it links to: an annual
            report, a proxy statement, a regulatory notice or the company&rsquo;s own investor page.
            A holder with no figure is named by a lead that nobody here has read against such a
            document. Shares shift daily; this is a record, not a feed.{' '}
            <a href={correctionUrl(`${name} ownership`)} className={LINK}>
              Correct a row
            </a>
          </p>
        )}
        {view.holders.length === 0 && (
          <p className={CAPS}>
            <a href={correctionUrl(`${name} ownership`)} className="hover:text-fg-primary">
              Know a document that names them? Send it →
            </a>
          </p>
        )}
      </>
    );
  },
};

export { ownership };
