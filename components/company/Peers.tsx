import Link from 'next/link';
import { connection } from 'next/server';
import { Sparkline } from '@bitbaum/chartkit/react';

import { isUnavailable } from '@/lib/market-data/prices/series';
import { peerRow, peerSet } from '@/lib/company-page/peers';
import { pricesOf } from '@/lib/company-page/load';
import { marketHref } from '@/lib/links';
import { Delta, EmptyState, SourceNote } from './parts';

/** Comparable listed companies: last close, one-year return and its shape, one row each. */
export async function Peers({ slug, name }: { slug: string; name: string }) {
  await connection();
  const set = peerSet(slug);
  if (!set.peers.length)
    return (
      <EmptyState
        name={name}
        missing={`${set.basis}: no listed company with a readable share price was found to compare with.`}
        sources={['a chain role for it (tier A) or a theme with listed members']}
        topic="peers"
      />
    );
  const rows = await Promise.all(
    set.peers.map(async (p) => {
      const h = await pricesOf(p.company.ticker.exchange, p.company.ticker.symbol);
      return isUnavailable(h)
        ? peerRow(p, null, '', 'prices unavailable')
        : peerRow(p, h.points, h.currency);
    }),
  );
  return (
    <>
      <p className="mk-basis">{set.basis}.</p>
      <ol className="mk-rows mk-peers">
        {rows.map((r) => (
          <li key={r.slug} className="mk-row mk-peer">
            <span className="mk-row-name">
              <Link href={marketHref(r.slug)}>{r.name}</Link>
              <span className="mk-figure-detail"> {r.ticker}</span>
            </span>
            <span className="mk-row-figure">
              <Delta display={r.oneYear} direction={r.direction} />
            </span>
            <span className="mk-row-detail">
              {r.close} · {r.closeDate} · one-year return
            </span>
            <span className="mk-peer-spark">
              {r.spark.length > 1 && (
                <Sparkline
                  points={r.spark}
                  label={`${r.name}, closes over one year`}
                  width={96}
                  height={28}
                />
              )}
            </span>
          </li>
        ))}
      </ol>
      <SourceNote>
        Delayed end-of-day closes, split-adjusted; price returns without dividends.
      </SourceNote>
    </>
  );
}
