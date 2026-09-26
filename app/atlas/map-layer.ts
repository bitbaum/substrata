/**
 * What the world map paints, decided on the server and handed to the client
 * as plain data: a bin per country, a line per country for the hover card,
 * and a legend that says what the colour means — measure, unit, year, source.
 *
 * Bins: 1–5 climb the one sequential ramp; NOT_A_NUMBER is hatched (USGS
 * printed "withheld", "none", "not available" or a word, which is not a
 * point on the scale); absent is plain land (not listed — never zero).
 *
 * Colour is spent on one thing only — how much of a resource a country
 * holds. Three layers, in order of what the data supports:
 *   quantity  — a resource USGS tabulates by country (lib/resources/choropleth):
 *               share of the world total, or of the largest producer when the
 *               world total is only a lower bound. The one shaded layer.
 *   presence  — a resource USGS does not tabulate (oil, gas, uranium, …):
 *               no quantity, so no shading; the hover line still says which
 *               countries the geology directory lists.
 *   none      — nothing picked: plain land, and the legend says how to shade.
 */
import { RESOURCE_KINDS, resourcesFor, type ResourceId } from '@/config/substrata-resources';
import {
  choropleth,
  choroplethOptions,
  type Choropleth,
  type ChoroplethMeasure,
} from '@/lib/resources/choropleth';

export const NOT_A_NUMBER = 6;

export interface MapLegend {
  title: string;
  /** The sequential steps, lowest first; absent for a categorical layer. */
  scale?: { bin: number; label: string }[];
  /** Categorical swatches: presence, hatched, not listed. */
  keys: { bin: number; label: string }[];
  note?: string;
  /** `short` is the publisher, for a phone's one-line credit. */
  source?: { label: string; short: string; href: string };
  /** The note changes how to read the colours, so a phone shows it too. */
  caveat?: boolean;
  /** Production / reserves, when the resource has both. */
  measures?: { id: ChoroplethMeasure; label: string; current: boolean }[];
}

export interface MapLayerData {
  bins: Record<string, number>;
  labels: Record<string, string>;
  /** The hover line for a country with no row in this layer. */
  otherwise?: string;
  legend: MapLegend;
}

const MEASURE_LABEL: Record<ChoroplethMeasure, string> = {
  production: 'Production',
  reserves: 'Reserves',
};

/** Which resources USGS tabulates, and for which measures. */
export function quantified(): Map<string, ChoroplethMeasure[]> {
  return new Map(choroplethOptions().map((o) => [o.resource, o.measures]));
}

/** Upper bounds of bins 1–4 as a fraction; bin 5 is everything above. */
const STEPS = [0.01, 0.05, 0.1, 0.25] as const;
const pct = (f: number) => `${+(f * 100).toFixed(f < 0.01 ? 2 : f < 0.1 ? 1 : 0)}%`;
const num = (n: number) =>
  n.toLocaleString('en-US', { notation: 'compact', maximumSignificantDigits: 2 });

export function shareBin(fraction: number): number {
  const index = STEPS.findIndex((top) => fraction < top);
  return index === -1 ? 5 : index + 1;
}

function quantityLayer(label: string, c: Choropleth, measures: ChoroplethMeasure[]): MapLayerData {
  // A share of a lower bound ("more than 140,000,000") would overstate every
  // country, so then the scale is the largest listed producer instead.
  const byShare = c.world.value !== null && c.world.value > 0 && !c.world.moreThan;
  const bins: Record<string, number> = {};
  const labels: Record<string, string> = {};
  let hatched = false;
  for (const [iso, v] of Object.entries(c.values)) {
    const estimate = v.estimated ? ' (USGS estimate)' : '';
    if (v.status !== 'value' || v.value === null || v.value <= 0) {
      bins[iso] = NOT_A_NUMBER;
      labels[iso] = `${v.text} — not a number on this scale`;
      hatched = true;
      continue;
    }
    const fraction = byShare && v.share !== null ? v.share : v.value / c.max;
    bins[iso] = shareBin(fraction);
    labels[iso] =
      `${v.text} ${c.unit}${estimate}` +
      (byShare && v.share !== null ? ` · ${pct(v.share)} of world` : '');
  }
  const bounds = ['0', ...STEPS.map((s) => (byShare ? pct(s) : num(s * c.max)))];
  return {
    bins,
    labels,
    otherwise: 'Not listed by USGS',
    legend: {
      title: `${label} · ${c.label}, ${c.year}${byShare ? '' : ` (${c.unit})`}`,
      scale: [1, 2, 3, 4, 5].map((bin) => ({
        bin,
        label: bin === 5 ? `≥ ${bounds[4]}` : `${bounds[bin - 1]}–${bounds[bin]}`,
      })),
      keys: [
        ...(hatched ? [{ bin: NOT_A_NUMBER, label: 'Withheld, none or n/a' }] : []),
        { bin: 0, label: 'Not listed' },
      ],
      note: byShare
        ? `Share of the world total, ${c.world.text} ${c.unit} (${c.unitLabel}).`
        : `In ${c.unitLabel}. USGS prints the world total as "${c.world.text}", so countries are shaded against the largest producer, not as a share.`,
      source: {
        label: `${c.source.edition}, ${c.source.table}`,
        short: c.source.label.split(',')[0],
        href: c.source.url,
      },
      caveat: !byShare,
      measures:
        measures.length > 1
          ? measures.map((id) => ({ id, label: MEASURE_LABEL[id], current: id === c.measure }))
          : undefined,
    },
  };
}

function presenceLayer(id: ResourceId, label: string, isos: string[]): MapLayerData {
  // A categorical fill here once made "listed" look like "a lot of it".
  const labels: Record<string, string> = {};
  for (const iso of isos)
    if (resourcesFor(iso)?.resources.includes(id)) labels[iso] = 'Listed in the geology directory';
  return {
    bins: {},
    labels,
    otherwise: 'Not listed in the geology directory',
    legend: {
      title: label,
      keys: [],
      note: 'No quantity to shade: USGS publishes no country table for this resource. Hover or open a country to see whether the geology directory lists it.',
      caveat: true,
    },
  };
}

function plainLayer(): MapLayerData {
  return {
    bins: {},
    labels: {},
    legend: {
      title: 'Pick a resource to shade the globe',
      keys: [],
      note: 'Shading is a share of world production or reserves, from USGS. Nothing is shaded until a resource is picked.',
    },
  };
}

/** The layer for a request; `isos` is every country the map can draw. */
export function mapLayer(
  resource: string | undefined,
  measure: ChoroplethMeasure,
  isos: string[],
): MapLayerData {
  const kind = RESOURCE_KINDS.find((r) => r.id === resource);
  if (!kind) return plainLayer();
  const measures = quantified().get(kind.id) ?? [];
  // Gallium has production and no reserves table: fall back rather than go blank.
  const chosen = measures.includes(measure) ? measure : measures[0];
  const data = chosen ? choropleth(kind.id, { measure: chosen }) : null;
  return data
    ? quantityLayer(kind.label, data, measures)
    : presenceLayer(kind.id, kind.label, isos);
}
