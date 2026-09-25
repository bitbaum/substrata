/**
 * What the world map paints, decided on the server and handed to the client
 * as plain data: a bin per country (0 = nothing recorded, 1–5 up the one
 * sequential scale), a label per country for the hover card, and a legend
 * that says what the colour means, in what unit, for what year, from where.
 *
 * Three layers, in order of what the data can honestly support:
 *
 *   share     — a resource with sourced country quantities: world share of
 *               production (or reserves), binned. The quantities come from the
 *               country × resource data (lib/resources/choropleth.ts, built
 *               separately); `quantityLayer` is the one seam to it.
 *   presence  — a resource without quantities: which countries the geology
 *               directory lists for it. Presence, not size, and the legend
 *               says so.
 *   coverage  — no resource picked: which countries the research corpus has
 *               a record for, and which only have a directory row.
 */
import { RESOURCE_KINDS, resourcesFor, type ResourceId } from '@/config/substrata-resources';
import { countryFacts } from '@/lib/geo';

/** The shape the country × resource data exposes per resource. */
export interface ChoroplethLayer {
  measure: 'production' | 'reserves';
  unit: string;
  year: number;
  source: { label: string; href: string };
  /** Keyed by lower-case ISO 3166-1 alpha-2. `share` is 0–1 of the world total. */
  values: Record<string, { value: number; share: number }>;
}

export interface MapLegend {
  title: string;
  kind: 'sequential' | 'categorical';
  /** One swatch per bin shown, lowest first. */
  stops: { bin: number; label: string }[];
  note?: string;
  source?: { label: string; href: string };
}

export interface MapLayerData {
  bins: Record<string, number>;
  labels: Record<string, string>;
  legend: MapLegend;
}

/**
 * The seam to the sourced country × resource quantities. Until that data is
 * on main this returns nothing, and the map falls back to presence — it never
 * invents a size.
 */
export function quantityLayer(resource: ResourceId): ChoroplethLayer | undefined {
  void resource;
  return undefined;
}

/** Upper bounds of bins 1–4 as a share of the world; bin 5 is everything above. */
const SHARE_STEPS = [0.01, 0.05, 0.1, 0.25] as const;
const pct = (share: number) =>
  `${(share * 100).toFixed(share < 0.01 ? 2 : share < 0.1 ? 1 : 0).replace(/\.0+$/, '')}%`;

export function shareBin(share: number): number {
  const index = SHARE_STEPS.findIndex((top) => share < top);
  return index === -1 ? 5 : index + 1;
}

function shareLayer(label: string, layer: ChoroplethLayer): MapLayerData {
  const bins: Record<string, number> = {};
  const labels: Record<string, string> = {};
  for (const [iso, row] of Object.entries(layer.values)) {
    if (!(row.share > 0)) continue;
    bins[iso] = shareBin(row.share);
    labels[iso] = `${pct(row.share)} of world ${layer.measure}, ${layer.year}`;
  }
  const bounds = ['0', ...SHARE_STEPS.map(pct)];
  return {
    bins,
    labels,
    legend: {
      title: `${label} · share of world ${layer.measure}, ${layer.year}`,
      kind: 'sequential',
      stops: [1, 2, 3, 4, 5].map((bin) => ({
        bin,
        label: bin === 5 ? `≥ ${bounds[4]}` : `${bounds[bin - 1]}–${bounds[bin]}`,
      })),
      note: `Unit: ${layer.unit}.`,
      source: layer.source,
    },
  };
}

function presenceLayer(id: ResourceId, label: string, isos: string[]): MapLayerData {
  const bins: Record<string, number> = {};
  const labels: Record<string, string> = {};
  for (const iso of isos) {
    if (!resourcesFor(iso)?.resources.includes(id)) continue;
    bins[iso] = 4;
    labels[iso] = `${label}: listed in the geology directory`;
  }
  return {
    bins,
    labels,
    legend: {
      title: label,
      kind: 'categorical',
      stops: [{ bin: 4, label: 'Listed in the geology directory' }],
      note: 'Presence, not size: no sourced country quantities for this resource yet.',
    },
  };
}

function coverageLayer(isos: string[]): MapLayerData {
  const facts = countryFacts();
  const bins: Record<string, number> = {};
  const labels: Record<string, string> = {};
  for (const iso of isos) {
    if (facts.get(iso)?.hasRecord) {
      bins[iso] = 4;
      labels[iso] = 'In the research corpus';
    } else if (resourcesFor(iso)?.resources.length) {
      bins[iso] = 2;
      labels[iso] = 'Geology directory only';
    }
  }
  return {
    bins,
    labels,
    legend: {
      title: 'What is on record',
      kind: 'categorical',
      stops: [
        { bin: 2, label: 'Geology directory' },
        { bin: 4, label: 'Research corpus' },
      ],
      note: 'Coverage, not importance. Pick a resource to paint it.',
    },
  };
}

/** The layer for a request; `isos` is every country the map can draw. */
export function mapLayer(resource: string | undefined, isos: string[]): MapLayerData {
  const kind = RESOURCE_KINDS.find((r) => r.id === resource);
  if (!kind) return coverageLayer(isos);
  const quantities = quantityLayer(kind.id);
  return quantities ? shareLayer(kind.label, quantities) : presenceLayer(kind.id, kind.label, isos);
}
