import Link from 'next/link';

import { ShareBars, type ShareRow } from '@/components/charts';
import { Ticker } from '@/components/exposure/Ticker';
import { correctionUrl } from '@/lib/site';
import { hostOf } from '../../desk';
import type { Entity } from '../../entities/types';
import { listingFor } from '../../listings';
import { holderDetail, ownershipView, type OwnershipView } from '../../ownership';
import { marketHref, slugify } from '../../links';
import { participantBySlug } from '../../participants';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';
import { CAPS, LINK } from './company';

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
    const rows: ShareRow[] = view.holders.map((h) => ({
      label: h.name,
      share: h.share,
      href: h.source,
      detail: (
        <>
          {holderDetail(h)} · {hostOf(h.source)} ↗{h.note ? ` · ${h.note}` : ''}
        </>
      ),
      missing: 'no figure on record',
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
        {view.holders.length > 0 && (
          <ShareBars
            rows={rows}
            other={
              view.rest !== null
                ? { label: 'Other holders and public float', share: view.rest }
                : undefined
            }
            caption={
              <>
                Each figure is as of the date on its row, read from the document it links to: an
                annual report, a proxy statement, a regulatory notice or the company&rsquo;s own
                investor page. A holder with no figure is named by a lead that nobody here has read
                against such a document. Shares shift daily; this is a record, not a feed.{' '}
                <a href={correctionUrl(`${name} ownership`)} className={LINK}>
                  Correct a row
                </a>
              </>
            }
          />
        )}
        {view.holders.length === 0 && (
          <p className={`${CAPS}`}>
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
