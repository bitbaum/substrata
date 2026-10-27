import Link from 'next/link';

import { Heading } from '@/components/portal/Shell';
import { closeLabel, sparkPath, type MarketRow } from '@/lib/home-markets';

/**
 * A few listed names along the chain — chips, tools, memory, power, fuel —
 * with the last close, the change on the day and a month's line. Rows of one
 * anatomy: name and ticker on the left, the line, the change on the right.
 * Drawn only from closes the daily run stored (lib/home-markets.ts); with
 * none, the section is not drawn at all.
 */
export function HomeMarkets({ rows, source }: { rows: MarketRow[]; source: string | null }) {
  if (!rows.length) return null;
  const asOf = rows
    .map((r) => r.asOf)
    .sort()
    .at(-1);
  return (
    <section className="home-section" aria-labelledby="home-markets">
      <Heading
        id="home-markets"
        title="Listed names on the chain"
        aside={
          <Link href="/markets" className="home-more">
            All companies →
          </Link>
        }
      />
      <ul className="home-markets">
        {rows.map((r) => {
          const body = (
            <>
              <span className="home-market-name">
                {r.name}
                <span className="home-market-ticker">{r.ticker}</span>
              </span>
              <svg
                className="home-market-spark"
                viewBox="0 0 96 28"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  points={sparkPath(r.spark)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              <span className="home-market-move">
                <span className="home-market-change">{r.changeLabel}</span>
                <span className="home-market-close">{closeLabel(r)}</span>
              </span>
            </>
          );
          return (
            <li key={r.ticker}>
              {r.href ? (
                <Link href={r.href} className="home-market">
                  {body}
                </Link>
              ) : (
                <span className="home-market">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="board-note">
        Close of {asOf}, change on the previous close, line over a month · end of day, not live
        {source ? ` · ${source}` : ''}
      </p>
    </section>
  );
}
