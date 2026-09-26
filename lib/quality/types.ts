/**
 * The shape every data-quality check returns, and the one scoring rule.
 *
 * A check answers one written criterion (config/substrata-quality.ts) for one
 * dataset: how many rows it looked at, how many held, and each row that did
 * not — with the link a reader needs to see for themselves. Pure checks run in
 * `verify` and on every page view; network checks run on a timer and are read
 * back from the database. Both return this, so the page and the ratchet never
 * need to know which kind they are holding.
 */

export const CRITERIA = [
  'completeness',
  'correctness',
  'provenance',
  'freshness',
  'links',
  'consistency',
] as const;

export type CriterionId = (typeof CRITERIA)[number];

export interface Failure {
  /** Which row, as a reader would name it ("tin: Minsur", "lithium 2025 Chile"). */
  row: string;
  /** What is wrong, in one line. */
  problem: string;
  /** The source to open, when the row has one. */
  link?: string;
  /** The page on this site that shows the row. */
  page?: string;
}

export interface CheckResult {
  dataset: string;
  criterion: CriterionId;
  /** Stable id of the check, `dataset/what`. */
  check: string;
  /** One line: what was compared with what. */
  label: string;
  checked: number;
  passed: number;
  failures: Failure[];
  /** 'pure' re-derives from committed files; 'network' and 'database' are read back from the last run. */
  kind: 'pure' | 'network' | 'database';
  /** For network checks: rows not looked at yet in the current rotation. */
  unchecked?: number;
  /** For network checks: looks that could not tell (robots refused, unreadable here); not scored. */
  cannotTell?: number;
  /** When the evidence was gathered, for network and database checks. */
  asOf?: string;
}

export interface CriterionScore {
  criterion: CriterionId;
  checked: number;
  passed: number;
  /** passed / checked, 0–100, or null when nothing could be checked. */
  score: number | null;
}

/** The rule: rows that held over rows looked at, pooled across a criterion's checks. */
export function scoreOf(results: readonly CheckResult[]): number | null {
  const checked = results.reduce((n, r) => n + r.checked, 0);
  if (checked === 0) return null;
  const passed = results.reduce((n, r) => n + r.passed, 0);
  return Math.floor((passed / checked) * 1000) / 10;
}

export function criterionScores(results: readonly CheckResult[]): CriterionScore[] {
  return CRITERIA.map((criterion) => {
    const mine = results.filter((r) => r.criterion === criterion);
    return {
      criterion,
      checked: mine.reduce((n, r) => n + r.checked, 0),
      passed: mine.reduce((n, r) => n + r.passed, 0),
      score: scoreOf(mine),
    };
  });
}

/** A dataset's one number: the mean of the criteria that could be scored. */
export function overallScore(scores: readonly CriterionScore[]): number | null {
  const known = scores.map((s) => s.score).filter((s): s is number => s !== null);
  if (known.length === 0) return null;
  return Math.floor((known.reduce((a, b) => a + b, 0) / known.length) * 10) / 10;
}

/** Build a result from rows and a predicate that returns the problem, or null when the row holds. */
export function judge<T>(
  meta: Omit<CheckResult, 'checked' | 'passed' | 'failures' | 'kind'>,
  rows: readonly T[],
  problem: (row: T) => (Failure & { problem: string }) | null,
): CheckResult {
  const failures = rows.map(problem).filter((f): f is Failure => f !== null);
  return {
    ...meta,
    kind: 'pure',
    checked: rows.length,
    passed: rows.length - failures.length,
    failures,
  };
}
