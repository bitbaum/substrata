/**
 * The numbers for one resource in one country: production per series (latest
 * year, the year before, change, rank, share), reserves, and
 * reserves-to-production. Every value is a <Figure>: the table's own numbers
 * link the source, derived ones link their method.
 */
import { Figure } from '../Figure';
import type { ResourceFacts, SeriesFact } from '@/lib/resources/country';
import {
  formatChange,
  formatShare,
  formatValue,
  formatYears,
  ordinal,
} from '@/lib/resources/format';

function Value({ fact, facts }: { fact: SeriesFact; facts: ResourceFacts }) {
  const v = fact.current;
  if (v.value === null || v.status !== 'value')
    return <span className="text-fg-tertiary">{v.text}</span>;
  return (
    <Figure source={facts.source.url} sourceLabel={facts.source.label} asOf={String(fact.year)}>
      {v.estimated ? `${formatValue(v.value)}e` : formatValue(v.value)}
    </Figure>
  );
}

function Standing({ fact }: { fact: SeriesFact }) {
  const v = fact.current;
  if (v.rank === null) return <span className="text-fg-tertiary">not ranked</span>;
  return (
    <>
      <Figure method="world-rank" detail={`Among ${fact.listed} countries listed individually.`}>
        {ordinal(v.rank)}
      </Figure>
      {v.share !== null && (
        <>
          {' · '}
          <Figure method="share">{formatShare(v.share)}</Figure>
        </>
      )}
    </>
  );
}

export function ResourceFigures({ facts }: { facts: ResourceFacts }) {
  const rows = [...facts.production, ...(facts.reserves ? [facts.reserves] : [])];
  return (
    <div className="series-table-wrap">
      <table className="series-table resource-figures">
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">Value</th>
            <th scope="col">Year before</th>
            <th scope="col">World standing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((fact) => (
            <tr key={fact.series}>
              <th scope="row">
                {fact.label}
                <span className="resource-unit">
                  {fact.year} · {fact.unitLabel}
                </span>
              </th>
              <td>
                <Value fact={fact} facts={facts} />
              </td>
              <td>
                {fact.prior ? (
                  <>
                    <span className="resource-cell-label">{fact.prior.year}: </span>
                    {fact.prior.text}
                    {fact.change !== null && (
                      <>
                        {' '}
                        (<Figure method="production-change">{formatChange(fact.change)}</Figure>)
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-fg-tertiary">—</span>
                )}
              </td>
              <td>
                <span className="resource-cell-label">World: </span>
                <Standing fact={fact} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {facts.reservesToProduction && (
        <p className="resource-line">
          Reserves ÷ {facts.reservesToProduction.productionYear} production:{' '}
          <Figure method="reserves-to-production">
            {formatYears(facts.reservesToProduction.years)}
          </Figure>{' '}
          at that rate. Reserves are what is economic to extract now (roughly proved + probable),
          not all that exists; they move with price and technology.
        </p>
      )}
    </div>
  );
}
