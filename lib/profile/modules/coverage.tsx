import { coverageOf, RATIO_CAVEAT, RATIO_LABEL, type Coverage } from '../../coverage/ratio';
import type { RowWorking } from '../../coverage/rows';
import { codeHref } from '../../methods';
import { formatValue } from '../../resources/format';
import { UNIT_LABEL } from '../../resources/usgs';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';

// The mass balance (lib/coverage): for each resource, how much of the national
// figure the facilities with a named operator account for, with the working
// one tap away — or exactly why it cannot be computed. Stated rows only.

// A paragraph of the working: plain flowing text (measure-lines is a grid, which
// split a sentence and its link onto separate lines).
const PARA = 'coverage-working';
const pct = (ratio: number) => `${Math.round(ratio * 100)}%`;
const unitOf = (unit: string) => UNIT_LABEL[unit] ?? unit;
const amount = (value: number, unit: string) => `${formatValue(value)} ${unitOf(unit)}`;

function RowLine({ row }: { row: RowWorking }) {
  const printed = row.printed.trim() ? `${row.printed.trim()} ${row.unit}` : 'no capacity printed';
  const who = row.operators.length
    ? `operated by ${row.operators.map((o) => o.name).join(', ')}`
    : 'no stated operator';
  const counted =
    row.compared !== true
      ? `not compared: ${row.compared}`
      : row.figure && 'reason' in row.figure
        ? `not added: ${row.figure.reason}`
        : row.operators.length
          ? 'counted as named'
          : 'listed, not named';
  return (
    <li>
      <span className="text-fg-primary">{row.location || 'no place printed'}</span> —{' '}
      {row.commodity}; {printed}; {who}. <span className="text-fg-tertiary">{counted}.</span>
    </li>
  );
}

function Working({ c }: { c: Coverage }) {
  const a = c.attribution;
  return (
    <div className="measure-groups">
      {c.status === 'computed' ? (
        <>
          <p className={PARA}>
            {amount(c.named.capacity, c.unit)} named ÷ {amount(c.national.value, c.unit)} national ={' '}
            {pct(c.ratio)}. All rows of this basis, named or not:{' '}
            {amount(c.listed.capacity, c.unit)} ({c.listed.rows} row{c.listed.rows === 1 ? '' : 's'}
            ).
            {c.yearGap > 0 &&
              ` The facility table is for ${c.table?.year} and the national figure for ${c.national.year}: ${c.yearGap} year${c.yearGap === 1 ? '' : 's'} apart.`}
          </p>
        </>
      ) : null}
      {c.national && (
        <p className={PARA}>
          National figure:{' '}
          <a href={c.national.url} rel="noopener noreferrer" target="_blank">
            {c.national.source}, {c.national.table} ↗
          </a>{' '}
          — {c.national.series}, {c.national.year}: “{c.national.printed}” ({c.national.unitQuote}
          {c.national.estimated ? ', estimated' : ''}).
        </p>
      )}
      {c.table && (
        <p className={PARA}>
          Facilities:{' '}
          <a href={c.table.url} rel="noopener noreferrer" target="_blank">
            USGS Minerals Yearbook {c.table.year}, {c.table.table} ↗
          </a>
          . {a.rowsWithOperator.count} of {a.rowsWithOperator.of} rows name an operator;{' '}
          {a.operatorsWithOwner.count} of {a.operatorsWithOwner.of} named operators have a stated
          owner. Flows: {a.flows.status === 'cannot' ? a.flows.reason : 'computed'}.
        </p>
      )}
      {c.rows.length > 0 && (
        <ul className="coverage-rows">
          {c.rows.map((row, i) => (
            <RowLine key={`${row.location}-${i}`} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

const coverage: ProfileModule<Coverage[]> = {
  id: 'coverage',
  title: t('profile.coverage.title'),
  appliesTo: ['country'],
  importance: 87,
  load(entity) {
    const rows = coverageOf(entity.id.slice(entity.id.indexOf(':') + 1));
    return rows.length ? rows : null;
  },
  evidence: (rows) => {
    const done = rows.filter((c) => c.status === 'computed').length;
    return `${done} of ${rows.length} computed · ${RATIO_LABEL}, stated rows only`;
  },
  Render({ data }) {
    return (
      <>
        <p className="resource-line">
          For each resource: the capacity of facilities with a named operator, over the national
          production figure. Open a row for the working. {RATIO_CAVEAT}
        </p>
        <ul className="measure-countries">
          {data.map((c) => (
            <li key={c.resource}>
              <details className="measure-country">
                <summary>
                  <span className="measure-country-name">
                    {c.label}
                    <span className="coverage-line">
                      {c.status === 'computed'
                        ? `${RATIO_LABEL} · ${c.basis}`
                        : `Cannot be computed: ${c.reason}`}
                    </span>
                  </span>
                  <span className="measure-country-meta">
                    {c.status === 'computed' ? pct(c.ratio) : 'n/a'}
                  </span>
                </summary>
                <Working c={c} />
              </details>
            </li>
          ))}
        </ul>
        <p className="resource-source">
          Derived and lead relations are never counted here.{' '}
          <a href={codeHref('lib/coverage/README.md')} rel="noopener noreferrer">
            How the ratio is computed
          </a>
        </p>
      </>
    );
  },
};

export { coverage };
