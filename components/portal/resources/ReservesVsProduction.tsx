/**
 * Where today's supply comes from beside where tomorrow's sits: the same
 * five-tone share bar twice, production on the left and reserves on the
 * right, so a country large in one and small in the other stands out.
 * Only a resource with a reserves table gets this section.
 */
import { ShareBars } from '@bitbaum/chartkit/react';
import { hasReservesShares, type ChartRow, type ResourceProfile } from '@/lib/resources/profile';
import { USGS } from '@/lib/resources/usgs';
import { countryHref } from '@/lib/world/pages';

const NAMED = 5;

function split(rows: ChartRow[]) {
  const named = rows.filter((r) => r.share !== null).slice(0, NAMED);
  const shown = named.reduce((s, r) => s + (r.share ?? 0), 0);
  return {
    rows: named.map((r) => ({
      label: r.label,
      share: r.share as number,
      href: countryHref(r.iso2),
    })),
    other: Math.max(0, 1 - shown),
  };
}

export function ReservesVsProduction({ profile }: { profile: ResourceProfile }) {
  const r = profile.ranking.reserves;
  if (!r || !hasReservesShares(profile)) return null;
  const p = profile.ranking.production;
  const prod = split(profile.production);
  const res = split(profile.reserves);
  if (prod.rows.length === 0 || res.rows.length === 0) return null;
  return (
    <div className="ck-share-pair">
      <div>
        <h3>
          Today: {p.label.toLowerCase()}, {p.year}
        </h3>
        <ShareBars
          rows={prod.rows}
          other={prod.other}
          caption={`Share of world ${p.label.toLowerCase()} (${p.world.text} ${p.unitLabel}); the five largest named, the rest as other.`}
        />
      </div>
      <div>
        <h3>Tomorrow: {r.label.toLowerCase()}</h3>
        <ShareBars
          rows={res.rows}
          other={res.other}
          caption={`Share of world ${r.label.toLowerCase()} (${r.world.text} ${r.unitLabel}); the five largest named, the rest as other. ${USGS.definitions.reserves ?? ''}`}
        />
      </div>
    </div>
  );
}
