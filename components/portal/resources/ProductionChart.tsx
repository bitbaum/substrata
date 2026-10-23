/**
 * Production by country as ranked bars, the largest in the accent. Ten rows
 * at most here; the full ranking, with reserves and the prior year, is the
 * table under it, and the caption says how many it left out. The drawing is
 * @bitbaum/chartkit's; this is only the join to the USGS/EIA rows.
 */
import { BarChart } from '@bitbaum/chartkit/react';

import type { ResourceProfile } from '@/lib/resources/profile';
import { countryHref } from '@/lib/world/pages';

const SHOWN = 10;

export function ProductionChart({ profile }: { profile: ResourceProfile }) {
  const p = profile.ranking.production;
  const rows = profile.production.slice(0, SHOWN);
  const rest = profile.production.length - rows.length;
  if (rows.length === 0) return null;
  return (
    <div className="place-chart">
      <BarChart
        rows={rows.map((r) => ({
          label: r.label,
          value: r.value,
          share: r.share ?? undefined,
          estimated: r.estimated,
          href: countryHref(r.iso2, profile.resource),
        }))}
        unit={p.unitLabel}
        highlight={rows[0].label}
        caption={`${p.label}, ${p.year}, in ${p.unitLabel}; the share is of the world total (${p.world.text}), computed here. “≈” marks a ${profile.chapter.source} estimate.${rest > 0 ? ` ${rest} more countr${rest === 1 ? 'y is' : 'ies are'} in the table below.` : ''}`}
      />
    </div>
  );
}
