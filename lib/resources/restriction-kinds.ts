/**
 * OECD export measures, read by what they DO rather than by their code.
 *
 * The inventory records twelve measure types (M1 … M14). A reader asking
 * "who stops this leaving the country" does not want twelve rows; they want
 * to know whether it is banned, capped, licensed or taxed. So the types fold
 * into five kinds, in the order that matters most to a buyer: a prohibition
 * stops the flow, a quota caps it, a licence gates it, a tax prices it, and
 * the rest is paperwork at the border.
 *
 * The fold is exhaustive by construction: any type not named here lands in
 * "other", so a new code in next year's inventory is shown, never dropped.
 * test/places.test.ts checks that every measure lands in exactly one kind.
 */
import { WORLD_PATHS } from '@/config/world-paths';
import { type Restriction, restrictionSummary } from './restrictions';

export type MeasureKindId = 'prohibition' | 'quota' | 'licensing' | 'tax' | 'other';

export interface MeasureKind {
  id: MeasureKindId;
  label: string;
  /** What a measure of this kind does to a shipment, in one line. */
  does: string;
  /** OECD measure-type codes that fold into it; empty for the fallback. */
  types: readonly string[];
}

export const MEASURE_KINDS: readonly MeasureKind[] = [
  { id: 'prohibition', label: 'Prohibition', does: 'Stops it leaving.', types: ['M4'] },
  {
    id: 'quota',
    label: 'Quota',
    does: 'Caps how much leaves, or keeps a share at home.',
    types: ['M3', 'M12', 'M13'],
  },
  {
    id: 'licensing',
    label: 'Licensing',
    does: 'Leaves only with a permit, or from a listed exporter.',
    types: ['M6', 'M11'],
  },
  {
    id: 'tax',
    label: 'Export tax',
    does: 'Leaves at a price: a duty, a surtax or a withdrawn rebate.',
    types: ['M1', 'M2', 'M5', 'M9'],
  },
  { id: 'other', label: 'Other', does: 'Border procedure and anything else recorded.', types: [] },
];

const KIND_OF = new Map<string, MeasureKindId>(
  MEASURE_KINDS.flatMap((k) => k.types.map((t) => [t, k.id] as const)),
);

export function measureKind(m: Restriction): MeasureKindId {
  return KIND_OF.get(m.type) ?? 'other';
}

export interface KindCount {
  kind: MeasureKind;
  count: number;
  countries: number;
}

/** Every kind with its count, in kind order; kinds with no measure are kept at zero. */
export function countByKind(measures: readonly Restriction[]): KindCount[] {
  return MEASURE_KINDS.map((kind) => {
    const of = measures.filter((m) => measureKind(m) === kind.id);
    return { kind, count: of.length, countries: new Set(of.map((m) => m.iso2)).size };
  });
}

export interface CountryMeasures {
  iso2: string;
  name: string;
  count: number;
  /** ISO date of the most recently introduced measure, when any carries one. */
  newest: string | null;
  /** Measures grouped by kind, in kind order, empty kinds omitted. */
  byKind: { kind: MeasureKind; lines: { summary: string; measure: Restriction }[] }[];
}

export function countryName(iso2: string): string {
  return WORLD_PATHS.find((p) => p.iso2 === iso2)?.name ?? iso2.toUpperCase();
}

/** Measures folded per country, most measures first, then by name. */
export function groupByCountry(measures: readonly Restriction[]): CountryMeasures[] {
  const by = new Map<string, Restriction[]>();
  for (const m of measures) by.set(m.iso2, [...(by.get(m.iso2) ?? []), m]);
  return [...by.entries()]
    .map(([iso2, rows]) => ({
      iso2,
      name: countryName(iso2),
      count: rows.length,
      newest:
        rows
          .map((m) => m.introduced)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
      byKind: MEASURE_KINDS.map((kind) => ({
        kind,
        lines: rows
          .filter((m) => measureKind(m) === kind.id)
          .map((measure) => ({ summary: restrictionSummary(measure), measure })),
      })).filter((g) => g.lines.length > 0),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The same fold, keyed by resource rather than by country, for a country page. */
export function groupByResource(
  measures: readonly Restriction[],
  label: (resource: string) => string,
): { resource: string; label: string; count: number; byKind: CountryMeasures['byKind'] }[] {
  const by = new Map<string, Restriction[]>();
  for (const m of measures) by.set(m.resource, [...(by.get(m.resource) ?? []), m]);
  return [...by.entries()]
    .map(([resource, rows]) => ({
      resource,
      label: label(resource),
      count: rows.length,
      byKind: MEASURE_KINDS.map((kind) => ({
        kind,
        lines: rows
          .filter((m) => measureKind(m) === kind.id)
          .map((measure) => ({ summary: restrictionSummary(measure), measure })),
      })).filter((g) => g.lines.length > 0),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
