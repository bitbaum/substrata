/**
 * Every way the globe can be shaded for one resource, and the two layers
 * beyond production and reserves (map-layer.ts). Each reads only data already
 * on file:
 *
 *   trend — each country's production in the latest USGS year against the
 *           year before, from the same table. The edition prints two years,
 *           so this is a one-year change, and the legend says so.
 *   risk  — how many export restrictions the OECD inventory records on the
 *           resource, per country (lib/resources/restrictions). A count, not
 *           a judgement of how hard each one bites; absence is "not
 *           recorded", never "unrestricted".
 *
 * Trade flows and environmental impact zones were asked for, but no sourced
 * country figures for either are on file. They are listed in the picker as
 * not yet available rather than painted from nothing.
 */
import { RESOURCE_KINDS } from '@/config/substrata-resources';
import { choropleth, type Choropleth } from '@/lib/resources/choropleth';
import { RESTRICTIONS_SOURCE, restrictionsOn } from '@/lib/resources/restrictions';
import { NOT_A_NUMBER, mapLayer, pct, quantified, type MapLayerData } from './map-layer';

/** The picker's options, in its order; the first is the default. */
export const SHADINGS = [
  { id: 'production', label: 'Production volumes' },
  { id: 'reserves', label: 'Reserves' },
  { id: 'trend', label: 'Historical trend' },
  { id: 'risk', label: 'Risk heat-map (export restrictions)' },
] as const;

export type Shading = (typeof SHADINGS)[number]['id'];

/** Asked for, with no sourced country data on file yet: listed, never drawn. */
export const UNSOURCED_SHADINGS = ['Trade flows', 'Environmental impact zones'] as const;

/** A URL's ?measure= as a shading, the default when it is not one. */
export function shadingOf(param: string | undefined): Shading {
  return SHADINGS.find((s) => s.id === param)?.id ?? SHADINGS[0].id;
}

/** Upper bounds of trend bins 1–4, as a change; bin 5 is everything above. */
const TREND_STEPS = [-0.1, 0, 0.05, 0.2] as const;
/** Upper bounds of risk bins 1–4, as a count of measures; bin 5 is the rest. */
const RISK_STEPS = [2, 3, 5, 10] as const;

const bin = (steps: readonly number[], x: number) => {
  const index = steps.findIndex((top) => x < top);
  return index === -1 ? 5 : index + 1;
};
const signed = (f: number) => `${f > 0 ? '+' : f < 0 ? '−' : ''}${pct(Math.abs(f))}`;

/** The same production table, one year back; null when the edition has only one. */
function previousYear(c: Choropleth): Choropleth | null {
  const prev = choropleth(c.resource, {
    measure: 'production',
    series: c.series,
    year: c.year - 1,
  });
  return prev && prev.year === c.year - 1 ? prev : null;
}

function trendLayer(label: string, cur: Choropleth, prev: Choropleth): MapLayerData {
  const bins: Record<string, number> = {};
  const labels: Record<string, string> = {};
  const ranked: { iso: string; size: number; text: string }[] = [];
  let hatched = false;
  for (const [iso, v] of Object.entries(cur.values)) {
    const before = prev.values[iso]?.value;
    if (v.value === null || v.value <= 0 || !before || before <= 0) {
      bins[iso] = NOT_A_NUMBER;
      labels[iso] = `No figure for both ${prev.year} and ${cur.year}`;
      hatched = true;
      continue;
    }
    const change = v.value / before - 1;
    bins[iso] = bin(TREND_STEPS, change);
    labels[iso] =
      `${signed(change)} · ${prev.values[iso].text} → ${v.text} ${cur.unit}` +
      (v.estimated ? ' (USGS estimate)' : '');
    ranked.push({ iso, size: v.value, text: signed(change) });
  }
  const b = TREND_STEPS.map(signed);
  return {
    bins,
    labels,
    // Where the volume is, and which way it moved: the largest producers.
    callouts: ranked
      .sort((x, y) => y.size - x.size)
      .slice(0, 8)
      .map(({ iso, text }) => ({ iso, text })),
    otherwise: 'Not listed by USGS',
    legend: {
      title: `${label} · ${cur.label}, change ${prev.year}–${cur.year}`,
      scale: [
        { bin: 1, label: `below ${b[0]}` },
        { bin: 2, label: `${b[0]} to ${b[1]}` },
        { bin: 3, label: `${b[1]} to ${b[2]}` },
        { bin: 4, label: `${b[2]} to ${b[3]}` },
        { bin: 5, label: `${b[3]} or more` },
      ],
      keys: [
        ...(hatched ? [{ bin: NOT_A_NUMBER, label: 'No figure for both years' }] : []),
        { bin: 0, label: 'Not listed' },
      ],
      note: `Change in each country's production from ${prev.year} to ${cur.year}. This USGS edition prints two years, so the trend is one year long, and the later year is mostly USGS estimates.`,
      source: {
        label: `${cur.source.edition}, ${cur.source.table}`,
        short: cur.source.label.split(',')[0],
        href: cur.source.url,
      },
      caveat: true,
    },
  };
}

function riskLayer(id: string, label: string): MapLayerData {
  const counts = new Map<string, number>();
  for (const r of restrictionsOn(id)) counts.set(r.iso2, (counts.get(r.iso2) ?? 0) + 1);
  const bins: Record<string, number> = {};
  const labels: Record<string, string> = {};
  for (const [iso, n] of counts) {
    bins[iso] = bin(RISK_STEPS, n);
    labels[iso] = `${n} export restriction${n === 1 ? '' : 's'} recorded`;
  }
  return {
    bins,
    labels,
    callouts: [...counts]
      .filter(([iso]) => bins[iso] >= 4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([iso, n]) => ({ iso, text: String(n) })),
    otherwise: 'None recorded in the OECD inventory',
    legend: {
      title: `${label} · Export restrictions recorded, ${RESTRICTIONS_SOURCE.dataYear}`,
      scale: [
        { bin: 1, label: '1' },
        { bin: 2, label: '2' },
        { bin: 3, label: '3–4' },
        { bin: 4, label: '5–9' },
        { bin: 5, label: '10 or more' },
      ],
      keys: [{ bin: 0, label: 'None recorded' }],
      note: 'How many export measures — taxes, licences, quotas and bans alike — the OECD inventory records on this resource, per country. A count, not how hard each one bites. None recorded is not the same as unrestricted.',
      source: {
        label: RESTRICTIONS_SOURCE.label,
        short: 'OECD',
        href: RESTRICTIONS_SOURCE.url,
      },
      caveat: true,
    },
  };
}

/** The layer for a request, with the shadings this resource offers on its legend. */
export function shadedLayer(
  resource: string | undefined,
  shading: Shading,
  isos: string[],
): MapLayerData {
  const kind = RESOURCE_KINDS.find((r) => r.id === resource);
  if (!kind) return mapLayer(undefined, 'production', isos);
  const measures = quantified().get(kind.id) ?? [];
  const latest = measures.includes('production')
    ? choropleth(kind.id, { measure: 'production' })
    : null;
  const prev = latest ? previousYear(latest) : null;
  // A resource with no country table still offers production: it is the
  // presence layer, which says there is no quantity to shade.
  const offered = new Set<Shading>(measures.length > 0 ? measures : ['production']);
  if (prev) offered.add('trend');
  if (restrictionsOn(kind.id).length > 0) offered.add('risk');
  const chosen = offered.has(shading) ? shading : [...offered][0];
  const layer =
    chosen === 'trend' && latest && prev
      ? trendLayer(kind.label, latest, prev)
      : chosen === 'risk'
        ? riskLayer(kind.id, kind.label)
        : mapLayer(kind.id, chosen === 'reserves' ? 'reserves' : 'production', isos);
  layer.legend.measures = SHADINGS.filter((s) => offered.has(s.id)).map((s) => ({
    id: s.id,
    label: s.label,
    current: s.id === chosen,
  }));
  return layer;
}
