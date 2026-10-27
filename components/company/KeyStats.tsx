import { connection } from 'next/server';

import { NO_LISTING_SHORT } from '@/lib/market-data/company';
import { keyStatCells } from '@/lib/company-page/key-stats';
import { fundamentalsOf, listingOf, pricesOf, expectNameOf } from '@/lib/company-page/load';
import { EmptyState, SourceNote } from './parts';

const FILING_SOURCES = [
  'SEC EDGAR XBRL company facts (10-K, 20-F, 40-F)',
  'an annual report with a page locator, through scripts/research/add.ts',
] as const;

/** One grid of equal cells: market value, then the latest annual figures. */
export async function KeyStats({ slug, name }: { slug: string; name: string }) {
  await connection();
  const c = listingOf(slug);
  if (!c)
    return (
      <EmptyState
        name={name}
        missing={NO_LISTING_SHORT}
        sources={FILING_SOURCES}
        topic="financial figures"
      />
    );
  const [fund, prices] = await Promise.all([
    fundamentalsOf(slug),
    pricesOf(c.ticker.exchange, c.ticker.symbol, expectNameOf(c)),
  ]);
  const { cells, unavailable } = keyStatCells(c, fund!, prices);
  if (unavailable)
    return (
      <EmptyState
        name={name}
        missing={unavailable}
        sources={FILING_SOURCES}
        topic="financial figures"
      />
    );
  return (
    <>
      <ul className="mk-stats">
        {cells.map((cell) => (
          <li key={cell.id} className={`mk-stat${cell.missing ? ' is-missing' : ''}`}>
            <span className="mk-label">{cell.label}</span>
            <span className="mk-stat-value">{cell.value}</span>
            <span className="mk-stat-detail">
              {cell.detail}
              {cell.href && (
                <>
                  {' · '}
                  <a href={cell.href} rel="noreferrer">
                    filing ↗
                  </a>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      <SourceNote>
        Annual figures as last reported in the filer’s XBRL, in its reporting currency; nothing is
        converted. Growth compares the fiscal year with the one before, computed here.
      </SourceNote>
    </>
  );
}
