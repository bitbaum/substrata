/**
 * The company universe's shapes. One evidence row shape serves the source
 * adapters (research/universe.json) and a data agent going through add.ts
 * (config/candidates/universe.json): a row is one quoted source and what it
 * establishes for one company — a theme, identifiers, a size figure, or any
 * of the three at once (a holdings row names the fund's theme, the ticker and
 * the position in one line).
 *
 * The rule itself is config/universe-themes.ts; ./admit.ts applies it.
 */
import type { CandidateCommon } from '@/lib/entry/candidate';
import type { IdentityKind, SizeBasis, TestId, ThemeId, Tier } from '@/config/universe-themes';

export type { IdentityKind, SizeBasis, TestId, ThemeId, Tier };

/** Which clock a source ages on (MAX_AGE_DAYS). */
export type SourceFamily = 'fund' | 'filing' | 'registry' | 'statement';

/** How a row places a company in a theme. */
export type ThemeBasis = 'fund' | 'sic' | 'industry-class' | 'programme' | 'filing' | 'chain-role';

export interface Identifiers extends Partial<Record<IdentityKind, string>> {
  /** The listing venue as the source printed it (`US`, `KS`, `CN`, `SW`). */
  exchange?: string;
  cusip?: string;
  sedol?: string;
  isin?: string;
}

export interface Establishes {
  theme?: ThemeId;
  themeBasis?: ThemeBasis;
  /** The words the source used for the theme: a fund's name, a SIC label. */
  themeLabel?: string;
  ids?: Identifiers;
  /** A figure the source prints, in US dollars, with what it measures. */
  size?: { basis: SizeBasis; usd: number };
}

export interface UniverseRow extends CandidateCommon {
  /** The company's slug: the join key for every row about it. */
  company: string;
  /** Its name as the row's source prints it. */
  name: string;
  /** ISO 3166 alpha-2, upper case: legal address when a registry says so, else listing venue. */
  country?: string;
  family: SourceFamily;
  establishes: Establishes;
}

/** One reason a company is in: a test, the source that passes it, and when it was read. */
export interface Admission {
  test: TestId;
  theme?: ThemeId;
  basis: string;
  /** What the row says, in one line a reader understands. */
  detail: string;
  source: string;
  quote?: string;
  readOn: string;
  asOf: string;
}

export interface TestResult {
  pass: boolean;
  /** Why it passed or, when it failed, exactly what was missing. */
  reason: string;
  evidence: Admission[];
}

/** The hand-verified chain role a tier A company carries (config/substrata-participants.ts). */
export interface ChainRole {
  role: string;
  source: string;
  themes: ThemeId[];
}

/** Everything known about one company before the rule is applied. */
export interface UniverseCandidate {
  slug: string;
  name: string;
  rows: readonly UniverseRow[];
  chainRole?: ChainRole;
  /** Identifiers the directory already holds (research/listings.json). */
  knownIds?: Identifiers;
  knownIdsSource?: string;
}

export interface Decision {
  slug: string;
  name: string;
  admitted: boolean;
  tier: Tier | null;
  themes: ThemeId[];
  /** The evidence that admits it, theme first. Empty when not admitted. */
  admittedBy: Admission[];
  tests: Record<TestId, TestResult>;
  failed: TestId[];
  /** Rows set aside before the tests ran, and why (stale, future-dated). */
  setAside: { source: string; why: string }[];
}

export interface UniverseEntry extends Decision {
  country?: string;
  ids: Identifiers;
  aliases: string[];
}

/** A name looked for and not admitted because no source could be cited, with where we looked. */
export interface Considered {
  name: string;
  looked: string[];
  why: string;
  on: string;
}
