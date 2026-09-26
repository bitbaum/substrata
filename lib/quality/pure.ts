/**
 * Every check that needs nothing but the committed files: what `verify` runs,
 * what the page computes on each view, and what each scheduled run records.
 */
import { corpusChecks } from './checks-corpus';
import { crossChecks } from './checks-cross';
import { listingChecks } from './checks-listings';
import { miscChecks } from './checks-misc';
import { resourceChecks } from './checks-resources';
import { seriesChecks } from './checks-series';
import type { CheckResult } from './types';

let cached: { day: string; results: CheckResult[] } | null = null;

/** Memoised per UTC day: the files cannot change under a running build, only the date can. */
export function pureResults(now = new Date()): CheckResult[] {
  const day = now.toISOString().slice(0, 10);
  if (cached?.day === day) return cached.results;
  const results = [
    ...corpusChecks(),
    ...seriesChecks(now),
    ...listingChecks(now),
    ...resourceChecks(),
    ...crossChecks(),
    ...miscChecks(now),
  ];
  cached = { day, results };
  return results;
}
