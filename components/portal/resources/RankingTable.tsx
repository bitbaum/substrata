/**
 * The world ranking for one resource: production (latest and prior year),
 * share and rank, reserves with share and rank, and the OECD restriction count.
 */
import Link from 'next/link';
import { Figure } from '../Figure';
import type { ResourceRanking } from '@/lib/resources/ranking';
import { USGS } from '@/lib/resources/usgs';
import { formatShare, formatValue, ordinal } from '@/lib/resources/format';

export function RankingTable({ ranking }: { ranking: ResourceRanking }) {
  const p = ranking.production;
  const r = ranking.reserves;
  const src = { source: p.source.url, sourceLabel: p.source.label };
  return (
    <section className="mt-6">
      <div className="series-table-wrap">
        <table className="series-table resource-ranking">
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col">
                {p.label}, {p.year} ({p.unitLabel})
              </th>
              {ranking.priorYear && <th scope="col">{ranking.priorYear}</th>}
              <th scope="col">Share · rank</th>
              {r && (
                <th scope="col">
                  {r.label} ({r.unitLabel})
                </th>
              )}
              {r && <th scope="col">Share · rank</th>}
              <th scope="col">Export restrictions</th>
            </tr>
          </thead>
          <tbody>
            {ranking.rows.map((row) => (
              <tr key={row.iso2}>
                <th scope="row">
                  <Link href={`/atlas?view=world&country=${row.iso2}&resource=${ranking.resource}`}>
                    {row.name}
                  </Link>
                </th>
                <td>
                  {row.production.value !== null && row.production.value > 0 ? (
                    <Figure {...src} asOf={String(p.year)}>
                      {formatValue(row.production.value) + (row.production.estimated ? 'e' : '')}
                    </Figure>
                  ) : (
                    row.production.text
                  )}
                </td>
                {ranking.priorYear && <td>{row.prior?.text ?? '—'}</td>}
                <td>
                  {row.production.rank !== null ? (
                    <>
                      {row.production.share !== null && (
                        <Figure method="share">{formatShare(row.production.share)}</Figure>
                      )}{' '}
                      <Figure method="world-rank">{ordinal(row.production.rank)}</Figure>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                {r && <td>{row.reserves?.text ?? 'not in the table'}</td>}
                {r && (
                  <td>
                    {row.reserves?.rank ? (
                      <>
                        {row.reserves.share !== null && (
                          <Figure method="share">{formatShare(row.reserves.share)}</Figure>
                        )}{' '}
                        <Figure method="world-rank">{ordinal(row.reserves.rank)}</Figure>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
                <td>
                  {row.restrictions > 0 ? (
                    <a href={`#restrictions-${row.iso2}`}>{row.restrictions}</a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="resource-source">
        World total {p.year}: {p.world.text} {p.unitLabel}
        {r ? `; reserves: ${r.world.text} ${r.unitLabel}` : ''}. Countries USGS or EIA fold into
        “other countries” are not listed or ranked. {r && USGS.definitions.reserves}{' '}
        {p.source.label}, table “{p.source.table}”, read {p.source.retrieved}.
      </p>
    </section>
  );
}
