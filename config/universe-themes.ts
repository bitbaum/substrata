/**
 * The company universe: which companies Substrata covers, and the written
 * rule that decides it. This file is the rule; `lib/universe/admit.ts` applies
 * it and `/data/companies` prints it, both from these constants, so the page
 * that explains the rule cannot drift from the code that runs it.
 *
 * Before this, a company was on the site because someone hand-listed it as a
 * producer of a tracked chokepoint (config/substrata-participants.ts) or
 * because a USGS yearbook table printed its name. Nothing said why the others
 * were absent, so "why NVIDIA but no SpaceX?" had no answer. Now a company is
 * in when it passes three tests, each carried as cited evidence, and a name
 * that is out says which test it failed.
 *
 * Decided: docs/architecture/2026-10-25-company-universe.md.
 */

// =====================================================================
// THEMES — the frontier-technology tree, small on purpose
// =====================================================================

export interface Theme {
  id: ThemeId;
  label: string;
  /** What a company does to be in this theme, in one line. */
  covers: string;
  /** Why the theme is on the tree: what it binds, or what binds it. */
  why: string;
  /** Taxonomy words (config/substrata-taxonomy.ts) the theme's companies are found under. */
  topics: string[];
}

export const THEME_IDS = [
  'compute',
  'ai',
  'robotics',
  'space',
  'nuclear',
  'grid',
  'mobility',
  'materials',
  'quantum',
  'photonics',
  'biotools',
  'defence',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEMES: readonly Theme[] = [
  {
    id: 'compute',
    label: 'Compute & semiconductors',
    covers: 'Designs, makes, packages or equips the making of chips and memory.',
    why: 'Every other branch of the tree runs on it, and its chokepoints are the ones the site began with.',
    topics: ['ai', 'semiconductors'],
  },
  {
    id: 'ai',
    label: 'AI labs, cloud & data centres',
    covers: 'Trains or serves AI models, or builds and runs the data centres they run in.',
    why: 'The largest buyer of compute and of grid power; concentrated demand is a scarcity fact.',
    topics: ['ai', 'data-centres'],
  },
  {
    id: 'robotics',
    label: 'Robotics & autonomy',
    covers:
      'Industrial, humanoid and service robots, autonomous vehicles and their drives and sensors.',
    why: 'The actuation layer: motors, reducers and magnets are where the material bottlenecks surface.',
    topics: ['robotics', 'machinery'],
  },
  {
    id: 'space',
    label: 'Space & launch',
    covers: 'Launches, builds or operates spacecraft and satellites.',
    why: 'Launch capacity and satellite supply are themselves concentrated, and they consume the same parts.',
    topics: ['space'],
  },
  {
    id: 'nuclear',
    label: 'Nuclear, SMRs & the fuel cycle',
    covers:
      'Mines, converts or enriches uranium, makes fuel, or designs, builds or runs reactors, small modular ones included.',
    why: 'Firm power for compute, and a fuel cycle with few converters and enrichers.',
    topics: ['energy', 'power-grid'],
  },
  {
    id: 'grid',
    label: 'Energy storage, batteries & grid',
    covers:
      'Cells, batteries and storage systems, and the transformers, cable and switchgear of the grid.',
    why: 'The layer that decides whether announced compute is ever energised.',
    topics: ['energy', 'power-grid'],
  },
  {
    id: 'mobility',
    label: 'Electric mobility',
    covers: 'Electric vehicles and their drivetrains, chargers and power electronics.',
    why: 'The largest consumer of battery materials and of rare-earth magnets.',
    topics: ['energy', 'robotics'],
  },
  {
    id: 'materials',
    label: 'Advanced materials & critical minerals',
    covers:
      'Mines, refines or converts the minerals and specialty materials the tree is built from.',
    why: 'Where most of the tracked chokepoints actually sit.',
    topics: ['mining-materials', 'gases-chemicals'],
  },
  {
    id: 'quantum',
    label: 'Quantum',
    covers: 'Builds quantum computers, sensors or the parts and control systems they need.',
    why: 'An emerging buyer of helium-3, dilution refrigerators and isotopically pure materials.',
    topics: ['ai', 'semiconductors'],
  },
  {
    id: 'photonics',
    label: 'Photonics',
    covers: 'Lasers, optics, optical components and the transceivers that link compute.',
    why: 'Optical interconnect and lithography optics are single-source steps in the compute chain.',
    topics: ['semiconductors', 'manufacturing'],
  },
  {
    id: 'biotools',
    label: 'Biotech tools',
    covers: 'Sequencers, lab instruments and the platforms that make biology programmable.',
    why: 'The frontier branch most dependent on compute and on a few instrument makers.',
    topics: ['manufacturing'],
  },
  {
    id: 'defence',
    label: 'Defence & aerospace',
    covers:
      'Builds military aircraft, missiles, munitions, drones, naval and land systems, or the electronics and sensors inside them.',
    why: 'State buyers compete for the same rare-earth magnets, gallium, germanium, tungsten and chips as the civilian branches, and a few prime contractors hold the demand.',
    topics: ['space', 'manufacturing'],
  },
];

export function themeById(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

// =====================================================================
// THE THREE TESTS
// =====================================================================

export type TestId = 'theme' | 'materiality' | 'identity';

export const TESTS: readonly { id: TestId; label: string; rule: string }[] = [
  {
    id: 'theme',
    label: 'Theme',
    rule: 'A cited source places it in at least one theme: a thematic fund holds it, its filed industry code is a theme code, a curated industry class lists it, or a government programme or filing names it.',
  },
  {
    id: 'materiality',
    label: 'Materiality',
    rule: 'A cited figure clears one floor below, or its role in a tracked chokepoint is hand-verified (tier A).',
  },
  {
    id: 'identity',
    label: 'Identity',
    rule: 'It resolves to at least one registry identifier a reader can look up: an exchange ticker, SEC CIK, LEI, Wikidata QID or a company-registry number.',
  },
];

// =====================================================================
// MATERIALITY FLOORS — each a figure a source prints, never one we compute
// =====================================================================

export type SizeBasis =
  | 'fund-position'
  | 'public-float'
  | 'market-cap'
  | 'revenue'
  | 'private-valuation'
  | 'private-round';

export const SIZE_FLOORS: readonly {
  basis: SizeBasis;
  floorUsd: number;
  label: string;
  /** What the figure is, after the amount: "US$154 million held by one thematic fund". */
  measures: string;
  why: string;
}[] = [
  {
    basis: 'fund-position',
    measures: 'held by one thematic fund',
    floorUsd: 5_000_000,
    label: 'A thematic fund holds at least US$5 million of its shares',
    why: 'An issuer does not put that much into a security it cannot trade; it rules out shells and micro-caps without a market-cap feed we would have to pay for.',
  },
  {
    basis: 'public-float',
    measures: 'public float on its SEC 10-K cover',
    floorUsd: 250_000_000,
    label: 'Public float of at least US$250 million on its SEC cover page',
    why: 'The float a US filer states under oath on its 10-K cover; the floor sits near the small-cap index cut-off.',
  },
  {
    basis: 'market-cap',
    measures: 'market capitalisation',
    floorUsd: 500_000_000,
    label: 'Market capitalisation of at least US$500 million, as a source prints it',
    why: 'For listings outside the SEC and the funds read here.',
  },
  {
    basis: 'revenue',
    measures: 'annual revenue',
    floorUsd: 250_000_000,
    label: 'Annual revenue of at least US$250 million, as reported',
    why: 'A going business, listed or not.',
  },
  {
    basis: 'private-valuation',
    measures: 'private valuation',
    floorUsd: 1_000_000_000,
    label: 'A private valuation of at least US$1 billion, stated by the company or an investor',
    why: 'A private company has no float; a priced round is the nearest public figure.',
  },
  {
    basis: 'private-round',
    measures: 'funding round',
    floorUsd: 100_000_000,
    label: 'A funding round of at least US$100 million, stated by the company or an investor',
    why: 'Where a round is announced without a valuation.',
  },
];

// =====================================================================
// IDENTITY — what counts as "resolvable"
// =====================================================================

export const IDENTITY_KINDS = ['ticker', 'cik', 'lei', 'qid', 'registry'] as const;
export type IdentityKind = (typeof IDENTITY_KINDS)[number];

export const IDENTITY_LABEL: Record<IdentityKind, string> = {
  ticker: 'Exchange ticker',
  cik: 'SEC CIK',
  lei: 'LEI (GLEIF)',
  qid: 'Wikidata QID',
  registry: 'Company-registry number',
};

// =====================================================================
// TIERS
// =====================================================================

export type Tier = 'A' | 'B' | 'C';

export const TIERS: readonly { tier: Tier; label: string; means: string; becomes: string }[] = [
  {
    tier: 'A',
    label: 'Profiled',
    means: 'Its role in a tracked chokepoint is hand-verified against a cited source, and graded.',
    becomes: 'Stays A while that role is sourced; drops to B if the source is withdrawn.',
  },
  {
    tier: 'B',
    label: 'Identified',
    means:
      'Identity, theme and materiality are each cited. Its page shows them and makes no claim about its role in any chain.',
    becomes:
      'Rises to A when a person verifies a chain role (a producers or participants row with a source).',
  },
  {
    tier: 'C',
    label: 'Named',
    means: 'Named by a published relation (an operator or owner in a table) and nothing more.',
    becomes: 'Rises to B when its identity, theme and materiality are each cited.',
  },
];

/**
 * How old a source may be and still count. A holdings file is a daily
 * snapshot; a fund that last published nine months ago no longer says what
 * it holds. Filings and registry records age more slowly.
 */
export const MAX_AGE_DAYS: Record<'fund' | 'filing' | 'registry' | 'statement', number> = {
  fund: 120,
  filing: 550,
  registry: 730,
  statement: 730,
};

/** How often the universe is re-read, and what makes a company leave. */
export const REFRESH = {
  cadence: 'monthly, and before any release that changes the rule',
  leaves:
    'A company leaves tier B when no evidence row for one of the three tests is fresh enough: the fund sold it, the float fell under the floor, or the source went stale. It is then listed as considered, with the test it now fails.',
};
