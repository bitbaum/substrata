import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { Ticker } from '@/components/exposure/Ticker';
import { BINDING_MAX } from '@/components/desk/BindingScore';
import type { ExposureRow } from '@/lib/exposure';
import { bottleneckHref, marketHref } from '@/lib/links';

/**
 * Exposure rows as a list that fits a phone: holder and ticker on one line,
 * the bottleneck, its binding score and the net pressure under it. The full
 * table, with every column and the CSV, stays on /exposure.
 */
export function HoldersList({ rows }: { rows: readonly ExposureRow[] }) {
  if (rows.length === 0) return <p className="role-empty">No listed holder matches.</p>;
  return (
    <ul className="role-rows">
      {rows.map((r) => (
        <li key={`${r.bottleneckSlug}:${r.company}`}>
          <span className="role-holder">
            {r.companySlug ? (
              <Link href={marketHref(r.companySlug)} className="role-row-title">
                {r.company}
              </Link>
            ) : (
              <span className="role-row-title">{r.company}</span>
            )}
            <Ticker listing={r.listing} compact />
          </span>
          <span className="role-row-meta">
            {r.role} · <Link href={bottleneckHref(r.bottleneckSlug)}>{r.bottleneck}</Link> · binding{' '}
            <Figure method="severity">{`${r.binding}/${BINDING_MAX}`}</Figure> · net pressure{' '}
            <Figure method="net-pressure">
              {r.netPressure > 0 ? `+${r.netPressure}` : String(r.netPressure)}
            </Figure>
          </span>
        </li>
      ))}
    </ul>
  );
}
