/**
 * Pure checks on tickers (research/listings.json). Whether a ticker is still
 * right is a network question — the SEC file and OpenFIGI — answered by
 * lib/quality/network-listings.ts on a timer.
 */
import listingsFile from '@/research/listings.json';
import { LISTING_OVERRIDES } from '@/config/substrata-listing-overrides';
import { DATASETS } from '@/config/substrata-freshness';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { ageDays } from '@/lib/freshness/status';
import { marketHref } from '@/lib/links';
import type { Listing, SecurityRef } from '@/lib/listings';
import { judge, type CheckResult } from './types';

const LISTINGS = (listingsFile as { listings: Record<string, Listing> }).listings;
const traded = (l: Listing): l is Extract<Listing, { primary: unknown }> =>
  l.status === 'listed' || l.status === 'parent';

export function listingRows() {
  return Object.entries(LISTINGS).map(([slug, listing]) => ({ slug, listing }));
}

function refOk(ref: SecurityRef | null, kind: 'primary' | 'us'): boolean {
  if (ref === null) return true;
  if (!ref.ticker || !ref.name || !/^https:\/\//.test(ref.source)) return false;
  // A US primary line is the SEC's (a CIK); any other is OpenFIGI's (a FIGI).
  const figi = /^BBG[A-Z0-9]{9}$/.test(ref.figi ?? '');
  return kind === 'primary' ? figi || Number.isInteger(ref.cik) : Number.isInteger(ref.cik);
}

export function listingChecks(now = new Date()): CheckResult[] {
  const rows = listingRows();
  const tradedRows = rows.filter((r) => traded(r.listing));
  const maxAge = DATASETS.find((d) => d.id === 'listings')?.maxAgeDays ?? 30;
  const figiOwners = new Map<string, string[]>();
  for (const { slug, listing } of tradedRows) {
    const figi = traded(listing) ? listing.primary?.figi : undefined;
    if (figi && listing.status === 'listed')
      figiOwners.set(figi, [...(figiOwners.get(figi) ?? []), slug]);
  }
  const pinned = Object.entries(LISTING_OVERRIDES).flatMap(([slug, o]) =>
    'home' in o && o.home ? [{ slug, home: o.home }] : [],
  );
  return [
    judge(
      {
        dataset: 'listings',
        criterion: 'completeness',
        check: 'listings/every-company',
        label:
          'Every company with a Markets page has a listing row (listed, parent, private or none found)',
      },
      MARKET_PARTICIPANTS,
      (p) =>
        LISTINGS[p.slug]
          ? null
          : { row: p.name, problem: 'no listing row', page: marketHref(p.slug) },
    ),
    judge(
      {
        dataset: 'listings',
        criterion: 'completeness',
        check: 'listings/primary-line',
        label: 'Every listed company (or its parent) has a primary line',
      },
      tradedRows,
      ({ slug, listing }) =>
        traded(listing) && listing.primary
          ? null
          : { row: slug, problem: 'listed, but no primary line', page: marketHref(slug) },
    ),
    judge(
      {
        dataset: 'listings',
        criterion: 'provenance',
        check: 'listings/line-source',
        label: 'Every line carries its identifier (FIGI or SEC CIK) and a link to that record',
      },
      tradedRows,
      ({ slug, listing }) =>
        traded(listing) && refOk(listing.primary, 'primary') && refOk(listing.us, 'us')
          ? null
          : {
              row: slug,
              problem: 'a line lacks its FIGI/CIK or source link',
              link: traded(listing) ? listing.primary?.source : undefined,
              page: marketHref(slug),
            },
    ),
    judge(
      {
        dataset: 'listings',
        criterion: 'consistency',
        check: 'listings/pins-and-figis',
        label:
          'Pinned home lines agree with the file, and no two companies claim the same security',
      },
      [
        ...pinned.map((p) => ({ kind: 'pin' as const, ...p })),
        ...[...figiOwners].map(([figi, slugs]) => ({ kind: 'figi' as const, figi, slugs })),
      ],
      (row) => {
        if (row.kind === 'figi')
          return row.slugs.length === 1
            ? null
            : {
                row: row.slugs.join(', '),
                problem: `share one FIGI ${row.figi}`,
                link: `https://www.openfigi.com/id/${row.figi}`,
              };
        const l = LISTINGS[row.slug];
        const line = l && traded(l) ? l.primary : null;
        return line && line.ticker === row.home.ticker && line.exchange === row.home.exchange
          ? null
          : {
              row: row.slug,
              problem: `pin ${row.home.ticker} ${row.home.exchange} not in the file`,
              page: marketHref(row.slug),
            };
      },
    ),
    judge(
      {
        dataset: 'listings',
        criterion: 'freshness',
        check: 'listings/row-checked',
        label: `Every row was re-validated within ${maxAge} days`,
      },
      rows,
      ({ slug, listing }) =>
        ageDays(listing.checkedOn, now) <= maxAge
          ? null
          : { row: slug, problem: `last checked ${listing.checkedOn}`, page: marketHref(slug) },
    ),
  ];
}
