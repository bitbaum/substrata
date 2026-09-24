/**
 * Series fetched on a schedule from an official statistical API, shown as the
 * agency publishes them.
 *
 * Only the US Bureau of Labor Statistics is here: its public API needs no key
 * and returns producer price indexes by month, with preliminary values marked.
 * FRED's CSV endpoint was unreachable from here, UN Comtrade's keyless preview
 * returned nothing for the HS codes tried, and no BLS index covers
 * grain-oriented electrical steel or helium on their own — a broader index
 * (all steel mill products, all industrial gases) would argue something the
 * bottleneck page does not, so none is mapped.
 *
 * An index is a price RELATIVE to its base period, not a price: 475 means
 * prices are 4.75 times what they were at the base date, for what US producers
 * charge. The base is in the unit so it is never read without it.
 *
 * Series ids and titles were read from https://data.bls.gov/timeseries/<id>
 * on 2026-09-24.
 */
import type { Direction, SeriesKind } from '@/lib/series';

export interface OfficialSeries {
  id: string;
  /** The agency's own series id. */
  agencyId: string;
  agency: 'BLS';
  bottleneck: string;
  metric: string;
  unit: string;
  geography: string;
  kind: SeriesKind;
  direction: Direction;
  describes: string;
}

const ppi = (
  agencyId: string,
  bottleneck: string,
  metric: string,
  base: string,
  describes: string,
): OfficialSeries => ({
  id: `bls-${agencyId.toLowerCase()}`,
  agencyId,
  agency: 'BLS',
  bottleneck,
  metric,
  unit: `index, ${base} = 100`,
  geography: 'US producers',
  kind: 'price-index',
  direction: 'up-tightens',
  describes,
});

export const OFFICIAL_SERIES: readonly OfficialSeries[] = [
  ppi(
    'PCU3353113353111',
    'large-power-transformer-slots',
    'Producer price index: power and distribution transformers',
    'Dec 1999',
    'BLS PPI for power and distribution transformers made in the US, excluding parts. All sizes, not only large power transformers.',
  ),
  ppi(
    'PCU335311335311',
    'large-power-transformer-slots',
    'Producer price index: power and specialty transformer manufacturing',
    'Jun 1981',
    'BLS PPI for the whole US industry (NAICS 335311), which also makes specialty and small transformers.',
  ),
  ppi(
    'PCU333611333611',
    'heavy-duty-gas-turbine-order-books',
    'Producer price index: turbine and turbine generator set units',
    'Jun 1982',
    'BLS PPI for turbines and turbine generator sets made in the US — steam, gas and hydraulic, all sizes.',
  ),
  ppi(
    'PCU335313335313',
    'high-voltage-cable-and-switchgear',
    'Producer price index: switchgear and switchboard apparatus',
    'Jun 1985',
    'BLS PPI for switchgear and switchboard apparatus made in the US, all voltages.',
  ),
  ppi(
    'PCU3359293359291',
    'high-voltage-cable-and-switchgear',
    'Producer price index: power wire and cable (nonferrous)',
    'Dec 1982',
    'BLS PPI for power wire and cable made from purchased nonferrous wire in the US, all voltages.',
  ),
  ppi(
    'PCU334413334413',
    'leading-edge-foundry-capacity',
    'Producer price index: semiconductors and related devices',
    'Dec 1998',
    'BLS PPI for all semiconductor devices made in the US, not only leading-edge logic.',
  ),
];

/** The agency's human-readable page for a series: where a point links. */
export function agencyPage(series: OfficialSeries): string {
  return `https://data.bls.gov/timeseries/${series.agencyId}`;
}
