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

/** Which step of the chain a figure describes. */
export type Stage = 'mine' | 'refine' | 'convert';

export const STAGE_LABEL: Record<Stage, string> = {
  mine: 'mined',
  refine: 'refined',
  convert: 'converted',
};

export interface Endowment {
  /** Bottleneck slug. */
  material: string;
  /**
   * The step this figure is for.
   *
   * This matters more than it looks. USGS publishes MINE production, and most
   * of the bottlenecks here are downstream of a mine: the corpus's own thesis
   * on tin is that "tin metal is not scarce; tin at seven nines, qualified for
   * an EUV source, is — the chokepoint is the upgrading step, not the mine".
   * Putting mine tonnage on that page without saying so would argue the
   * opposite of the research.
   */
  stage: Stage;
  /**
   * What the figure literally counts, where that is narrower or broader than
   * the bottleneck. "All rare earths as REO equivalent" is not "dysprosium
   * metal", and a reader must not have to infer the difference.
   */
  describes?: string;
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
  stage: 'mine' as const,
  describes: 'helium extracted from natural gas',
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
  stage: 'refine' as const,
  describes: 'primary low-purity gallium, recovered as a byproduct',
  production: { value: production, unit: 'kg', year: 2024, basis },
  // Deliberately no reserves: USGS does not quantify gallium reserves, because
  // it is recovered as a byproduct of bauxite and zinc processing rather than
  // mined for itself. Leaving the field absent is the honest answer; a zero
  // would say something false.
  note: 'USGS does not quantify gallium reserves: it is a byproduct of bauxite and zinc processing.',
  source: USGS_GALLIUM,
  readOn: READ,
});

const USGS_TIN = 'https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-tin.pdf';
const USGS_LITHIUM = 'https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-lithium.pdf';
const USGS_RARE_EARTHS = 'https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-rare-earths.pdf';

/**
 * Mined ore, for a bottleneck that sits downstream of the mine.
 *
 * The corpus says the tin chokepoint is refining to seven nines, not digging;
 * that separated dysprosium is not mined dysprosium; that battery-grade lithium
 * chemicals are not spodumene. These rows are context for the chain, and they
 * say so on every line rather than in a footnote.
 */
const mined = (
  material: string,
  place: string,
  value: number,
  reserves: number | null,
  source: string,
  describes: string,
  basis: Quantity['basis'] = 'estimated',
): Endowment => ({
  material,
  place,
  stage: 'mine',
  describes,
  production: { value, unit: 't', year: 2024, basis },
  ...(reserves === null
    ? {}
    : {
        reserves: { value: reserves, unit: 't' as const, year: 2024, basis: 'reported' as const },
      }),
  source,
  readOn: READ,
});

const TIN = 'tin content, mined — not the EUV-grade refining the bottleneck is about';
const tin = (
  place: string,
  value: number,
  reserves: number | null,
  basis: Quantity['basis'] = 'estimated',
) => mined('high-purity-tin-euv-droplet-grade', place, value, reserves, USGS_TIN, TIN, basis);

const LI = 'lithium content, mined — not the battery-grade chemicals the bottleneck is about';
const lithium = (
  place: string,
  value: number,
  reserves: number | null,
  basis: Quantity['basis'] = 'estimated',
) => mined('battery-grade-lithium-chemicals', place, value, reserves, USGS_LITHIUM, LI, basis);

const REO =
  'ALL rare earths, mined, as rare-earth-oxide equivalent — not this element, and not separated metal';
const reo = (
  material: string,
  place: string,
  value: number,
  reserves: number | null,
  basis: Quantity['basis'] = 'estimated',
) => mined(material, place, value, reserves, USGS_RARE_EARTHS, REO, basis);

const DIDYMIUM = 'didymium-nd-pr-metal-magnet-feed';
const DYSPROSIUM = 'dysprosium-metal';

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

  // Tin, tonnes of tin content mined, 2024. World total 300,000.
  tin('cn', 69_000, 1_000_000),
  tin('id', 50_000, null),
  tin('mm', 34_000, 700_000),
  tin('pe', 31_000, 130_000, 'reported'),
  tin('br', 29_000, 420_000, 'reported'),
  tin('bo', 21_000, 400_000, 'reported'),
  tin('cd', 25_000, 120_000),
  tin('au', 9_900, 620_000, 'reported'),

  // Lithium, tonnes of lithium content mined, 2024. World total 240,000.
  lithium('au', 88_000, 7_000_000, 'reported'),
  lithium('cl', 49_000, 9_300_000, 'reported'),
  lithium('cn', 41_000, 3_000_000),
  lithium('zw', 22_000, 480_000),
  lithium('ar', 18_000, 4_000_000, 'reported'),
  lithium('br', 10_000, 390_000),
  lithium('ca', 4_300, 1_200_000),

  // Rare earths, tonnes of REO equivalent mined, 2024. World total 390,000.
  // Attached to both magnet-feed bottlenecks, with the caveat on every row that
  // this counts all rare earths and not the element in question.
  reo(DIDYMIUM, 'cn', 270_000, 44_000_000, 'reported'),
  reo(DIDYMIUM, 'us', 45_000, 1_900_000, 'reported'),
  reo(DIDYMIUM, 'mm', 31_000, null),
  reo(DIDYMIUM, 'au', 13_000, 5_700_000),
  reo(DYSPROSIUM, 'cn', 270_000, 44_000_000, 'reported'),
  reo(DYSPROSIUM, 'us', 45_000, 1_900_000, 'reported'),
  reo(DYSPROSIUM, 'mm', 31_000, null),
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

  {
    material: 'high-purity-tin-euv-droplet-grade',
    total: { value: 300_000, unit: 't', year: 2024, basis: 'estimated' },
    source: USGS_TIN,
    readOn: READ,
    caveat:
      'Mined tin content. The bottleneck is refining to seven nines and qualifying it for an EUV source, which this figure does not measure.',
  },
  {
    material: 'battery-grade-lithium-chemicals',
    total: { value: 240_000, unit: 't', year: 2024, basis: 'estimated' },
    source: USGS_LITHIUM,
    readOn: READ,
    caveat:
      'Mined lithium content. Conversion to battery-grade chemicals is a separate step and is where the constraint sits.',
  },
  {
    material: 'didymium-nd-pr-metal-magnet-feed',
    total: { value: 390_000, unit: 't', year: 2024, basis: 'estimated' },
    source: USGS_RARE_EARTHS,
    readOn: READ,
    caveat:
      'All rare earths, mined, as REO equivalent. Separation into individual elements and metal-making are downstream, far more concentrated, and not counted here.',
  },
  {
    material: 'dysprosium-metal',
    total: { value: 390_000, unit: 't', year: 2024, basis: 'estimated' },
    source: USGS_RARE_EARTHS,
    readOn: READ,
    caveat:
      'All rare earths, mined, as REO equivalent. Dysprosium is a small fraction of it, and separation is downstream and far more concentrated.',
  },
];
