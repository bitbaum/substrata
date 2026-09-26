/**
 * Reading every feed's run table and the review queue into one report.
 *
 * Each table is read on its own, so one missing migration or one bad query
 * turns ONE row into "not installed" or "cannot tell" instead of blanking the
 * page. The report is memoised for a minute per process: the footer badge on
 * every page asks for it, and a minute is well inside the shortest cadence.
 */
import { DATASETS, FEEDS, type Dataset, type Feed } from '@/config/substrata-freshness';
import { database } from '@/lib/db';
import {
  LEAD_EXPIRY_DAYS,
  REVIEW_QUEUE_LATE_DAYS,
  REVIEW_QUEUE_STALE_DAYS,
} from '@/lib/lead-expiry';
import { reviewQueue } from '@/lib/event-draft-store';
import { sweepSettings } from '@/lib/sweep-store';
import {
  BAD_STATES,
  ageDays,
  datasetState,
  feedState,
  queueState,
  worstOf,
  type FreshState,
} from './status';

/** A run that has not finished this long after it started crashed: the box wrapper stops a call at 300s. */
const CRASHED_AFTER_MINUTES = 30;

export interface FeedRow {
  feed: Feed;
  everyHours: number | null;
  lastOk: string | null;
  lastFailure: string | null;
  runsThisWeek: number | null;
  state: FreshState;
  /** Why the state is off or unknown, in words. */
  note?: string;
}

export interface DatasetRow {
  dataset: Dataset;
  ageDays: number;
  state: FreshState;
}

export interface QueueRow {
  /** Open leads: unreviewed and not expired. */
  waiting: number;
  /** The oldest OPEN lead; expired ones never count. */
  oldestFoundAt: string | null;
  /** Unreviewed leads past `expiryDays`: kept and listed, not in the queue. */
  expired: number;
  expiryDays: number;
  lateDays: number;
  staleDays: number;
  state: FreshState;
}

export interface FreshnessReport {
  checkedAt: string;
  feeds: FeedRow[];
  datasets: DatasetRow[];
  queue: QueueRow | null;
  state: FreshState;
  ok: boolean;
  /** Rows that are late, stale or failing, by label. */
  attention: string[];
}

async function readFeed(feed: Feed, sweepEvery: number): Promise<FeedRow> {
  const everyHours = feed.everyHours === 'settings' ? sweepEvery : feed.everyHours;
  // Table names and conditions are constants from the config, never input.
  const sql = `SELECT
      (SELECT max(finished_at) FROM ${feed.table}
        WHERE finished_at IS NOT NULL AND NOT (${feed.failedWhen})) AS last_ok,
      (SELECT max(started_at) FROM ${feed.table}
        WHERE (finished_at IS NULL AND started_at < now() - interval '${CRASHED_AFTER_MINUTES} minutes')
           OR (finished_at IS NOT NULL AND (${feed.failedWhen}))) AS last_failure,
      (SELECT count(*) FROM ${feed.table} WHERE started_at > now() - interval '7 days') AS runs`;
  try {
    const result = await database().query<{
      last_ok: Date | null;
      last_failure: Date | null;
      runs: string;
    }>(sql);
    const row = result.rows[0];
    const reading = {
      lastOk: row?.last_ok?.toISOString() ?? null,
      lastFailure: row?.last_failure?.toISOString() ?? null,
    };
    return {
      feed,
      everyHours,
      ...reading,
      runsThisWeek: Number(row?.runs ?? 0),
      state: feed.onDemand ? 'demand' : feedState(reading, everyHours),
      note:
        feed.onDemand ??
        (everyHours === null ? 'No timer on the server runs this yet.' : undefined),
    };
  } catch (error) {
    const missing = (error as { code?: string }).code === '42P01';
    return {
      feed,
      everyHours,
      lastOk: null,
      lastFailure: null,
      runsThisWeek: null,
      state: missing ? 'off' : 'unknown',
      note: missing
        ? 'Its table is not installed on the server, so it has never run there.'
        : 'Its run record could not be read just now.',
    };
  }
}

async function readQueue(): Promise<QueueRow | null> {
  try {
    const q = await reviewQueue();
    const limits = { lateDays: REVIEW_QUEUE_LATE_DAYS, staleDays: REVIEW_QUEUE_STALE_DAYS };
    return {
      waiting: q.waiting,
      oldestFoundAt: q.oldestFoundAt,
      expired: q.expired,
      expiryDays: LEAD_EXPIRY_DAYS,
      ...limits,
      state: queueState(q.oldestFoundAt, limits),
    };
  } catch {
    return null;
  }
}

export function datasetRows(now = new Date()): DatasetRow[] {
  return DATASETS.map((dataset) => ({
    dataset,
    ageDays: ageDays(dataset.checkedOn, now),
    state: datasetState(dataset, now),
  }));
}

async function build(): Promise<FreshnessReport> {
  const settings = await sweepSettings();
  const [feeds, queue] = await Promise.all([
    Promise.all(FEEDS.map((f) => readFeed(f, settings.everyHours))),
    readQueue(),
  ]);
  const datasets = datasetRows();
  const labelled: [string, FreshState][] = [
    ...feeds.map((f): [string, FreshState] => [f.feed.label, f.state]),
    ...datasets.map((d): [string, FreshState] => [d.dataset.label, d.state]),
    ['Review queue', queue?.state ?? 'unknown'],
  ];
  const states = labelled.map(([, s]) => s);
  return {
    checkedAt: new Date().toISOString(),
    feeds,
    datasets,
    queue,
    state: worstOf(states),
    ok: !states.some((s) => BAD_STATES.has(s)),
    attention: labelled
      .filter(([, s]) => s === 'late' || BAD_STATES.has(s))
      .map(([label]) => label),
  };
}

const MEMO_MS = 60_000;
let memo: { at: number; report: Promise<FreshnessReport> } | null = null;

/** The whole report, at most a minute old. */
export function freshnessReport(): Promise<FreshnessReport> {
  if (!memo || Date.now() - memo.at > MEMO_MS) {
    const report = build();
    memo = { at: Date.now(), report };
    // A rejected build must not be served for a minute.
    report.catch(() => {
      memo = null;
    });
  }
  return memo.report;
}
