import React from 'react';
import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { formatPoint, isPlanned, periodLabel, KIND_LABEL, type Series } from '@/lib/series';
import { seriesHref } from '@/lib/links';
import { ChangeBadge, OriginNote, PointsTable } from './SeriesParts';
import { SeriesChart, Sparkline } from './SeriesChart';
import { Claims } from './Claims';
import type { Claim } from '@/lib/claims';

/**
 * The dated numbers on one bottleneck, first thing on its page.
 *
 * Each row is the latest value of one series — what it measures, in what unit,
 * for which period, from which page — with its move against the point before
 * and a sparkline. Opening a row shows the full chart and every point with the
 * sentence it was read from.
 */
/** Rows shown before "more series": enough to answer the page, few enough to scan. */
const SHOWN = 6;

function KeyRow({ series: s, open }: { series: Series; open: boolean }) {
  const last = s.points[s.points.length - 1];
  return (
    <li>
      <details className="series-key" open={open}>
        <summary>
          <span className="series-key-metric">
            <span className="series-key-kind">
              {KIND_LABEL[s.kind]} · {s.geography}
            </span>
            {s.metric}
          </span>
          <span className="series-key-value">
            <Figure source={last.source} sourceLabel={last.publisher} asOf={periodLabel(last.date)}>
              {formatPoint(last)}
            </Figure>{' '}
            <span className="series-unit">{s.unit}</span>
            <span className="series-key-date">
              {periodLabel(last.date)}
              {last.preliminary ? ', preliminary' : ''}
              {isPlanned(last) ? ' · target or forecast' : ''}
            </span>
          </span>
          <span className="series-key-trend">
            <Sparkline series={s} />
            <ChangeBadge series={s} />
          </span>
        </summary>
        <div className="series-key-body">
          {s.describes && <p className="series-describes">{s.describes}</p>}
          {s.points.length > 1 && <SeriesChart series={s} />}
          <PointsTable series={s} limit={6} />
          <OriginNote series={s} />
          <p className="series-links">
            <Link href={seriesHref(s.id)}>Series page</Link>
            <a href={`${seriesHref(s.id)}/csv`} download>
              Download CSV
            </a>
          </p>
        </div>
      </details>
    </li>
  );
}

export function KeyNumbers({
  series,
  officialOk,
  claims = [],
  all = series,
}: {
  series: Series[];
  officialOk: boolean;
  claims?: Claim[];
  /** Every series, so a claim can cite one filed under another bottleneck. */
  all?: Series[];
}) {
  return (
    <>
      <Claims claims={claims} series={all} />
      <ul className="series-keys">
        {series.slice(0, SHOWN).map((s, index) => (
          <KeyRow key={s.id} series={s} open={index === 0} />
        ))}
      </ul>
      {series.length > SHOWN && (
        <details className="series-rest">
          <summary>
            <Figure method="series-points" inLink>
              {series.length - SHOWN}
            </Figure>{' '}
            more series on this bottleneck
          </summary>
          <ul className="series-keys">
            {series.slice(SHOWN).map((s) => (
              <KeyRow key={s.id} series={s} open={false} />
            ))}
          </ul>
        </details>
      )}
      {!officialOk && (
        <p className="series-origin">
          Official statistics could not be read just now; only the series read from sources are
          shown.
        </p>
      )}
      <p className="series-origin">
        <Link href="/data/series">Every series on every bottleneck</Link> — filter, compare and
        download.
      </p>
    </>
  );
}
