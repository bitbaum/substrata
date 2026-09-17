/**
 * How much is made, and how much is left.
 *
 * The corpus could say a material was concentrated and could not say how
 * concentrated. Severity was a 0–12 judgement and everything around it was
 * prose, so a reader could not ask the first question anyone asks: how much,
 * where, and how much is left.
 *
 * Every figure here carries the year it is FOR, the basis it was arrived at,
 * and the source it came from. A number without a year is a lie with a decimal
 * point, and an estimate presented as a measurement is the same failure this
 * project exists to avoid — so `basis` is on every row and is shown.
 *
 * Shares, concentration and reserves-to-production are NOT stored. They are
 * functions of these rows (see `lib/quantities.ts`), so they cannot drift away
 * from the figures they claim to summarise.
 *
 * Source: USGS Mineral Commodity Summaries 2025, a US Government work in the
 * public domain. Read 2026-09-17.
 */

/** Units are explicit because these materials are not measured on one scale. */
export type Unit = 'kg' | 't' | 'Mcm' | 'bcm';

export const UNIT_LABEL: Record<Unit, string> = {
  kg: 'kilograms',
  t: 'tonnes',
  Mcm: 'million m³',
  bcm: 'billion m³',
};

export interface Quantity {
  value: number;
  unit: Unit;
  /** The year the figure describes, not the year it was published. */
  year: number;
  /**
   * `reported` is measured and published; `estimated` is the source's own
   * estimate (USGS marks these with an e); `withheld` means the source has the
   * figure and does not publish it.
   */
  basis: 'reported' | 'estimated' | 'withheld';
}

export interface Endowment {
  /** Bottleneck slug. */
  material: string;
  /** ISO-3166 alpha-2, lowercase, matching the country entities. */
  place: string;
  /** Annual output. */
  production?: Quantity;
  /**
   * What is left and economically extractable. Reserves are NOT resources:
   * USGS separates them and so must we, or the figure means nothing.
   */
  reserves?: Quantity;
  /** A named qualification where the source gives one instead of a number. */
  note?: string;
  source: string;
  readOn: string;
}

const USGS_HELIUM = 'https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-helium.pdf';
const USGS_GALLIUM = 'https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-gallium.pdf';
const READ = '2026-09-17';

const helium = (
  place: string,
  production: number | null,
  reserves: number | null,
  basis: Quantity['basis'] = 'estimated',
  note?: string,
): Endowment => ({
  material: 'liquid-helium-he-4',
  place,
  ...(production === null
    ? {}
    : { production: { value: production, unit: 'Mcm' as const, year: 2024, basis } }),
  ...(reserves === null
    ? {}
    : {
        reserves: { value: reserves, unit: 'Mcm' as const, year: 2024, basis: 'reported' as const },
      }),
  ...(note ? { note } : {}),
  source: USGS_HELIUM,
  readOn: READ,
});

const gallium = (
  place: string,
  production: number,
  basis: Quantity['basis'] = 'estimated',
): Endowment => ({
  material: 'gallium-refined',
  place,
  production: { value: production, unit: 'kg', year: 2024, basis },
  // Deliberately no reserves: USGS does not quantify gallium reserves, because
  // it is recovered as a byproduct of bauxite and zinc processing rather than
  // mined for itself. Leaving the field absent is the honest answer; a zero
  // would say something false.
  note: 'USGS does not quantify gallium reserves: it is a byproduct of bauxite and zinc processing.',
  source: USGS_GALLIUM,
  readOn: READ,
});

export const ENDOWMENTS: readonly Endowment[] = [
  // Helium, million cubic metres, 2024 estimates. World total 180.
  helium('us', 68, 8500, 'estimated'),
  helium(
    'qa',
    64,
    null,
    'estimated',
    'USGS records Qatar reserves as “Large” rather than a figure.',
  ),
  helium('ru', 17, 1700),
  helium('dz', 11, 1800),
  helium('ca', 6, null),
  helium('cn', 3, null),
  helium('pl', 3, 24),

  // Gallium, kilograms of primary low-purity, 2024 estimates. World total 760,000.
  gallium('cn', 750_000),
  gallium('ru', 6_000),
  gallium('jp', 3_000),
  gallium('kr', 3_000),
];

/**
 * World totals as the source states them, which is not always the sum of the
 * rows: USGS rounds, and withholds some country figures. Keeping the published
 * total lets the site show a share without silently implying the country list
 * is complete.
 */
export interface WorldTotal {
  material: string;
  total: Quantity;
  source: string;
  readOn: string;
  /** Said plainly wherever a share is shown. */
  caveat: string;
}

export const WORLD_TOTALS: readonly WorldTotal[] = [
  {
    material: 'liquid-helium-he-4',
    total: { value: 180, unit: 'Mcm', year: 2024, basis: 'estimated' },
    source: USGS_HELIUM,
    readOn: READ,
    caveat: 'USGS rounds the world total and lists some countries without a figure.',
  },
  {
    material: 'gallium-refined',
    total: { value: 760_000, unit: 'kg', year: 2024, basis: 'estimated' },
    source: USGS_GALLIUM,
    readOn: READ,
    caveat:
      'Primary low-purity gallium. Refining capacity sits elsewhere and is counted separately.',
  },
];
