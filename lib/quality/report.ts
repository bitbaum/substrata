/**
 * The scorecard: every check result, pure, network and database, grouped by
 * the datasets config/substrata-quality.ts declares, scored by one rule.
 */
import { QUALITY_DATASETS, type QualityDataset } from '@/config/substrata-quality';
import { databaseResults } from './checks-db';
import { networkResults } from './network-results';
import { pureResults } from './pure';
import { dbStore, runHistory, type RunRecord, type ScoreLine, type StoredCheck } from './store';
import { criterionScores, overallScore, type CheckResult, type CriterionScore } from './types';

export interface DatasetCard {
  dataset: QualityDataset;
  results: CheckResult[];
  scores: CriterionScore[];
  overall: number | null;
  counts: {
    /** Rows judged by the first provenance check: the dataset's size as a reader would count it. */
    rows: number;
    sourcedPct: number | null;
    /** Re-derived from the source by a network look, over rows that could be looked at. */
    verifiedPct: number | null;
    verifiedOf: number;
    stalePct: number | null;
    brokenLinks: number;
    blockedLinks: number;
    uncheckedLinks: number;
  };
}

export interface QualityReport {
  checkedAt: string;
  cards: DatasetCard[];
  /** Null when the database could not be read: network and trend then say so. */
  history: RunRecord[] | null;
  unreadable: string[];
}

const pct = (passed: number, checked: number) =>
  checked === 0 ? null : Math.floor((passed / checked) * 1000) / 10;

export function buildCards(results: readonly CheckResult[]): DatasetCard[] {
  return QUALITY_DATASETS.map((dataset) => {
    const mine = results.filter((r) => r.dataset === dataset.id);
    const scores = criterionScores(mine);
    const provenance = mine.find((r) => r.criterion === 'provenance');
    const network = mine.filter((r) => r.kind === 'network' && r.criterion === 'correctness');
    const freshness = mine.filter((r) => r.criterion === 'freshness');
    const links = mine.filter((r) => r.criterion === 'links');
    const sum = (rs: CheckResult[], f: (r: CheckResult) => number) =>
      rs.reduce((n, r) => n + f(r), 0);
    return {
      dataset,
      results: mine,
      scores,
      overall: overallScore(scores),
      counts: {
        rows: provenance?.checked ?? 0,
        sourcedPct: provenance ? pct(provenance.passed, provenance.checked) : null,
        verifiedPct: pct(
          sum(network, (r) => r.passed),
          sum(network, (r) => r.checked + (r.unchecked ?? 0)),
        ),
        verifiedOf: sum(network, (r) => r.checked + (r.unchecked ?? 0)),
        stalePct: pct(
          sum(freshness, (r) => r.checked - r.passed),
          sum(freshness, (r) => r.checked),
        ),
        brokenLinks: sum(links, (r) => r.failures.length),
        blockedLinks: sum(links, (r) => r.cannotTell ?? 0),
        uncheckedLinks: sum(links, (r) => r.unchecked ?? 0),
      },
    };
  });
}

/** The scorecard as stored with a run: one line per dataset and criterion. */
export function scoreLines(cards: readonly DatasetCard[]): ScoreLine[] {
  return cards.flatMap((c) =>
    c.scores
      .filter((s) => s.checked > 0)
      .map((s) => ({
        dataset: c.dataset.id,
        criterion: s.criterion,
        checked: s.checked,
        passed: s.passed,
      })),
  );
}

/** Everything, from committed files plus whatever the database can give. */
export async function assembleResults(stored: readonly StoredCheck[] | null) {
  const db = await databaseResults().catch(() => ({
    results: [] as CheckResult[],
    unreadable: ['database'],
  }));
  return {
    results: [...pureResults(), ...(stored ? networkResults(stored) : []), ...db.results],
    unreadable: [...(stored ? [] : ['network checks']), ...db.unreadable],
  };
}

let memo: { at: number; report: QualityReport } | null = null;

/** The page's report, memoised for five minutes per process. */
export async function qualityReport(): Promise<QualityReport> {
  if (memo && Date.now() - memo.at < 300_000) return memo.report;
  const [stored, history] = await Promise.all([
    dbStore.load().catch(() => null),
    runHistory().catch(() => null),
  ]);
  const { results, unreadable } = await assembleResults(stored);
  const report = {
    checkedAt: new Date().toISOString(),
    cards: buildCards(results),
    history,
    unreadable,
  };
  memo = { at: Date.now(), report };
  return report;
}
