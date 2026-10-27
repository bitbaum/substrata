import { connection } from 'next/server';

import { isUnavailable } from '@/lib/market-data/prices/series';
import { quoteOf } from '@/lib/company-page/price-view';
import { listingOf, pricesOf } from '@/lib/company-page/load';
import { Delta } from './parts';

/**
 * The header's quote line: which line, what it last closed at, the day's
 * change, the date and who served it. Streams in its own boundary, so the
 * company's name never waits for the price source.
 */
export async function Quote({ slug }: { slug: string }) {
  await connection();
  const c = listingOf(slug);
  if (!c)
    return (
      <p className="mk-quote">
        <span className="mk-quote-line">No listed share</span>
        <span className="mk-quote-meta">
          No exchange listing is known for it. <a href="#price">Why, and what would show one ↓</a>
        </span>
      </p>
    );
  const h = await pricesOf(c.ticker.exchange, c.ticker.symbol);
  const line = `${c.ticker.symbol} · ${c.ticker.exchange}`;
  if (isUnavailable(h))
    return (
      <p className="mk-quote">
        <span className="mk-quote-line">{line}</span>
        <span className="mk-quote-meta">Prices unavailable: {h.reason}</span>
      </p>
    );
  const q = quoteOf(h.points, h.currency)!;
  return (
    <p className="mk-quote">
      <span className="mk-quote-line">
        {line} · {h.currency}
      </span>
      <span className="mk-quote-price">
        <span className="mk-quote-close">{q.close}</span>
        {q.change && <Delta display={q.change.display} direction={q.change.direction} />}
      </span>
      <span className="mk-quote-meta">
        Close on {q.date}
        {q.change ? ` (change from ${q.change.from})` : ''} · delayed end-of-day ·{' '}
        <a href={h.source.url} rel="noreferrer">
          {h.source.name} ↗
        </a>
        {c.depositary ? ` · a depositary receipt: ${c.depositary}` : ''}
      </span>
    </p>
  );
}

export function QuoteLoading() {
  return (
    <p className="mk-quote" role="status">
      <span className="mk-quote-meta">Reading the last close…</span>
    </p>
  );
}
