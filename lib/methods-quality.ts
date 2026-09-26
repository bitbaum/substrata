/**
 * The data-quality page's computed numbers, spread into METHODS in
 * lib/methods.ts.
 */
import type { Method } from './methods';

export const QUALITY_METHODS = {
  'quality-score': {
    title: 'Quality score per criterion',
    formula:
      'Rows that held over rows looked at, pooled across every check of that criterion for that dataset, rounded down to a tenth of a percent.',
    explanation:
      'Each dataset has six written criteria in config/substrata-quality.ts: completeness, correctness, provenance, freshness, link health and consistency. A criterion marked not measured has a stated reason and no score — it is not counted as 100. Network checks score only the rows looked at so far; rows not yet looked at and looks that could not tell (a publisher refusing robots, a PDF that could not be read) are shown beside the score and never counted as passes.',
    code: ['lib/quality/types.ts', 'lib/quality/report.ts', 'config/substrata-quality.ts'],
  },
  'quality-overall': {
    title: 'Dataset quality score',
    formula: 'The mean of the criterion scores that could be measured for the dataset.',
    explanation:
      'An unweighted mean, so a dataset with one weak criterion shows it; the criteria themselves are listed beside it. Measured each scheduled run (every six hours) and stored, which is the trend.',
    code: ['lib/quality/types.ts', 'lib/quality/run.ts'],
  },
  'quality-counts': {
    title: 'Rows, sourced, verified, stale, broken links',
    formula:
      'Rows: judged by the dataset’s first provenance check. Sourced: share of those that pass it. Verified: rows re-derived from their source by a network look, over every row such a look covers. Stale: rows past their declared age. Broken: source links that failed three tries.',
    explanation:
      'Verified counts only what the scheduled run has confirmed against the live source — a quote found on its page, a ticker found in the SEC file or at OpenFIGI, a USGS value on its PDF row. It starts low and rises as the rotation covers the dataset; it is not a judgement of the rows not yet looked at.',
    code: ['lib/quality/report.ts', 'lib/quality/network-results.ts', 'lib/quality/targets.ts'],
  },
} as const satisfies Record<string, Method>;
