/**
 * Regions a job seeker searches by. "Process engineer in Europe" is how the
 * question is asked; picking thirty countries one at a time is not an answer
 * to it. A region is only a named list of ISO-2 codes, applied to the
 * countries each posting already carries (lib/careers-geo.ts) — no posting is
 * re-read or re-filed.
 */
export const REGIONS = [
  {
    id: 'europe',
    label: 'Europe',
    countries:
      'AT BE BG CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MT NL NO PL PT RO RS SE SI SK UA'.split(
        ' ',
      ),
  },
  { id: 'north-america', label: 'North America', countries: ['US', 'CA', 'MX'] },
  {
    id: 'latin-america',
    label: 'Latin America',
    countries: 'AR BO BR CL CO CR EC PE UY'.split(' '),
  },
  {
    id: 'asia-pacific',
    label: 'Asia-Pacific',
    countries: 'AU CN HK ID IN JP KR MY NZ PH SG TH TW VN'.split(' '),
  },
  {
    id: 'middle-east-africa',
    label: 'Middle East and Africa',
    countries: 'AE EG IL MA NG QA SA TR ZA'.split(' '),
  },
] as const;

export type RegionId = (typeof REGIONS)[number]['id'];

export function regionById(id: string | undefined) {
  return REGIONS.find((r) => r.id === id);
}

/** Open roles per region, summed from the per-country counts (a role in two countries of one region counts twice). */
export function regionCounts(byCountry: Map<string, number>): Map<RegionId, number> {
  const out = new Map<RegionId, number>();
  for (const r of REGIONS) {
    const n = r.countries.reduce((sum, c) => sum + (byCountry.get(c) ?? 0), 0);
    if (n > 0) out.set(r.id, n);
  }
  return out;
}
