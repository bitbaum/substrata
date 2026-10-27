import { connection } from 'next/server';

import { noListingReason } from '@/lib/market-data/company';
import { tickerLabel } from '@/lib/market-data/identity';
import { isUnavailable } from '@/lib/market-data/prices/series';
import { movingAverages, rangeViews, returnsTable, yearRange } from '@/lib/company-page/price-view';
import { listingOf, pricesOf } from '@/lib/company-page/load';
import { Delta, EmptyState, SourceNote } from './parts';
import { PriceRange } from './PriceRange';

const LISTING_SOURCES = [
  'an exchange listing page',
  'SEC EDGAR company tickers',
  'a GLEIF or Wikidata record with an ISIN',
] as const;

/** The share price: the chart with its range row, the 52-week range, returns by range. */
export async function PriceSection({ slug, name }: { slug: string; name: string }) {
  await connection();
  const c = listingOf(slug);
  if (!c)
    return (
      <EmptyState
        name={name}
        missing={noListingReason(slug)}
        sources={LISTING_SOURCES}
        topic="listing"
      />
    );
  const h = await pricesOf(c.ticker.exchange, c.ticker.symbol);
  if (isUnavailable(h))
    return (
      <div className="mk-empty">
        <p>
          Prices unavailable for {tickerLabel(c.ticker)}: {h.reason}
        </p>
        <p className="mk-empty-sources">
          Closes are read once a day; the page tries again on the next visit.
        </p>
      </div>
    );
  const views = rangeViews(h.points, h.currency);
  const year = yearRange(h.points, h.currency);
  const returns = returnsTable(h.points, h.currency);
  const ma = movingAverages(h.points, h.currency);
  return (
    <>
      <PriceRange
        views={views}
        currency={h.currency}
        caption={`${c.name} (${tickerLabel(c.ticker)}), daily close in ${h.currency}, split-adjusted. Source: ${h.source.name}.`}
      />
      {year && (
        <div className="mk-year">
          <p className="mk-label">{year.label}</p>
          <div className="mk-year-bar" aria-hidden="true">
            <span className="mk-year-mark" style={{ left: `${year.position}%` }} />
          </div>
          <p className="mk-year-ends">
            <span>Low {year.low}</span>
            <span>High {year.high}</span>
          </p>
        </div>
      )}
      <table className="mk-table mk-returns">
        <caption className="mk-label">Price return by range</caption>
        <thead>
          <tr>
            <th scope="col">Range</th>
            <th scope="col">Return</th>
            <th scope="col">From → to</th>
          </tr>
        </thead>
        <tbody>
          {returns.map((r) => (
            <tr key={r.range}>
              <th scope="row">{r.range}</th>
              <td>
                <Delta display={r.display} direction={r.direction} />
              </td>
              <td>{r.detail}</td>
            </tr>
          ))}
          {ma.map((m) => (
            <tr key={m.label}>
              <th scope="row">{m.label}</th>
              <td>{m.value}</td>
              <td>{m.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SourceNote>
        {h.basis} {h.delay} Served by{' '}
        <a href={h.source.url} rel="noreferrer">
          {h.source.name} ↗
        </a>{' '}
        ({h.via === 'stored' ? 'stored closes' : 'read live; not stored yet'}), last close {h.asOf}.
        {c.note ? ` ${c.note}` : ''}
      </SourceNote>
    </>
  );
}
