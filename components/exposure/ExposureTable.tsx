import Link from 'next/link';

import { HORIZON_LABEL } from '@/config/substrata-assessment';
import { STAGE_LABEL } from '@/config/substrata-stages';
import { VERIFICATION_LABEL } from '@/config/substrata-evidence';
import { PRESSURE_WINDOW_DAYS, type ExposureRow } from '@/lib/exposure';
import { bottleneckHref, marketHref } from '@/lib/links';
import { methodHref } from '@/lib/methods';
import { Ticker } from './Ticker';

function Pressure({ value }: { value: number }) {
  const label = value > 0 ? `+${value} tightening` : value < 0 ? `${value} loosening` : '0 net';
  return (
    <a
      href={methodHref('net-pressure')}
      className={`exposure-pressure ${value > 0 ? 'is-tight' : value < 0 ? 'is-loose' : ''}`}
      title={`Reviewed events in the last ${PRESSURE_WINDOW_DAYS} days: tightening minus loosening. Click for the rule.`}
    >
      {label}
    </a>
  );
}

/** One row per holder, grouped visually by bottleneck. */
export function ExposureTable({ rows }: { rows: ExposureRow[] }) {
  return (
    <div className="exposure-wrap">
      <table className="exposure-table">
        <thead>
          <tr>
            <th scope="col">Bottleneck</th>
            <th scope="col" title="Four judged tests, 0–3 each">
              Binding
            </th>
            <th scope="col">Pressure · {PRESSURE_WINDOW_DAYS}d</th>
            <th scope="col">Holder</th>
            <th scope="col">Role</th>
            <th scope="col">Listing</th>
            <th scope="col">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const first = i === 0 || rows[i - 1].bottleneck !== r.bottleneck;
            return (
              <tr key={`${r.bottleneckSlug}-${r.company}`} className={first ? 'is-first' : ''}>
                <td>
                  {first && (
                    <>
                      <Link href={bottleneckHref(r.bottleneckSlug)} className="exposure-bottleneck">
                        {r.bottleneck}
                      </Link>
                      <span className="exposure-sub">
                        {STAGE_LABEL[r.stage]} · {HORIZON_LABEL[r.horizon]}
                      </span>
                    </>
                  )}
                </td>
                <td>
                  {first && (
                    <Link
                      href={`${bottleneckHref(r.bottleneckSlug)}#assessment`}
                      className="exposure-num"
                    >
                      {r.binding}
                      <span>/12</span>
                    </Link>
                  )}
                </td>
                <td>{first && <Pressure value={r.netPressure} />}</td>
                <td>
                  {r.companySlug ? (
                    <Link href={marketHref(r.companySlug)} className="exposure-company">
                      {r.company}
                    </Link>
                  ) : (
                    <span className="exposure-company">{r.company}</span>
                  )}
                </td>
                <td>
                  <span className={r.supplier ? 'exposure-role is-supplier' : 'exposure-role'}>
                    {r.role}
                  </span>
                  {!r.supplier && r.otherMakers === 0 && (
                    <span
                      className="exposure-sole"
                      title="No other maker of this bottleneck is recorded in this corpus — which is not the same as none in the world."
                    >
                      only recorded maker
                    </span>
                  )}
                </td>
                <td>
                  <Ticker listing={r.listing} />
                </td>
                <td>
                  {r.evidence ? (
                    <a href={r.evidence} target="_blank" rel="noopener noreferrer">
                      {VERIFICATION_LABEL[r.verification]}
                    </a>
                  ) : (
                    <span className="ticker-none">{VERIFICATION_LABEL[r.verification]}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
