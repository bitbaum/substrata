/**
 * Steps one and two of a scenario: the direct hits, and what lies downstream
 * of them through recorded dependencies — each with the rows that justify it.
 */
import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { bottleneckHref, marketHref } from '@/lib/links';
import { hasMarketPage } from '@/lib/participants';
import type { DirectHit, DownstreamHit, HitStatus } from '@/lib/scenario/propagate';

const STATUS_LABEL: Record<HitStatus, string> = {
  target: 'Taken out directly',
  'no-maker-left': 'No recorded maker left',
  'makers-left': 'Other recorded makers remain',
  'part-lost': 'Loses a critical part; makers remain but cannot ship without it',
};

function Names({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="scenario-none">none</span>;
  return (
    <>
      {names.map((n, i) => (
        <span key={n}>
          {i > 0 ? ', ' : ''}
          {hasMarketPage(n) ? <Link href={marketHref(n)}>{n}</Link> : n}
        </span>
      ))}
    </>
  );
}

export function DirectHits({ hits }: { hits: DirectHit[] }) {
  return (
    <div className="xray-wrap">
      <table className="xray-table">
        <thead>
          <tr>
            <th scope="col">Bottleneck</th>
            <th scope="col">Result</th>
            <th scope="col">Makers lost</th>
            <th scope="col">Partly in it</th>
            <th scope="col">Makers remaining</th>
            <th scope="col">Parts lost</th>
          </tr>
        </thead>
        <tbody>
          {hits.map((h) => (
            <tr key={h.slug}>
              <td>
                <Link href={bottleneckHref(h.slug)} className="xray-strong">
                  {h.bottleneck}
                </Link>
              </td>
              <td>
                <span className={`scenario-status is-${h.status}`}>
                  {h.locationOnly
                    ? h.status === 'no-maker-left'
                      ? 'Its only recorded location'
                      : 'One of its recorded locations; no maker rows'
                    : STATUS_LABEL[h.status]}
                </span>
              </td>
              <td>
                <Names names={h.lost} />
              </td>
              <td>
                <Names names={h.partial} />
              </td>
              <td>
                {h.remaining.length > 0 && (
                  <Figure method="scenario-propagation">{String(h.remaining.length)}</Figure>
                )}{' '}
                <Names names={h.remaining} />
              </td>
              <td>
                <Names names={h.partsLost} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Downstream({ rows }: { rows: DownstreamHit[] }) {
  if (rows.length === 0)
    return (
      <p className="xray-note">
        No recorded dependency leads downstream from these. That can mean nothing depends on them,
        or that the dependency has not been sourced yet.
      </p>
    );
  return (
    <ul className="scenario-down">
      {rows.map((d) => (
        <li key={d.slug}>
          <p className="xray-route-head">{[d.from, ...d.path.map((e) => e.from)].join(' → ')}</p>
          <p className="xray-sub">
            An input to <Link href={bottleneckHref(d.slug)}>{d.bottleneck}</Link> is disrupted.
            Whether it stops depends on inventory and substitution the corpus does not record.
          </p>
          <details className="xray-details">
            <summary>Evidence for each step</summary>
            <ul>
              {d.path.map((e) => (
                <li key={`${e.from}-${e.on}`} className="xray-edge">
                  <span className="xray-edge-head">
                    {e.from} needs {e.on}
                  </span>
                  <q>{e.quote}</q>
                  <span className="xray-sub">
                    <a href={e.source} rel="noopener noreferrer" target="_blank">
                      {e.primary ? 'Primary source' : 'Secondary source'}
                    </a>
                    {e.scope ? ` · ${e.scope}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}
