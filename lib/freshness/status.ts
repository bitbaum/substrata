/**
 * Fresh, late, stale, failing — one rule for every feed, dataset and queue,
 * pure so the page, the health endpoint and the build all agree.
 */
import type { Dataset } from '@/config/substrata-freshness';

export type FreshState = 'fresh' | 'late' | 'stale' | 'failing' | 'demand' | 'off' | 'unknown';

export const STATE_LABEL: Record<FreshState, string> = {
  fresh: 'Fresh',
  late: 'Late',
  stale: 'Stale',
  failing: 'Failing',
  demand: 'On demand',
  off: 'Not scheduled',
  unknown: 'Cannot tell',
};

/** States that make `/api/health/freshness` report not-ok. "Off" is reported, never hidden, but is not an outage. */
export const BAD_STATES: ReadonlySet<FreshState> = new Set(['stale', 'failing']);

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A run may arrive this much after its slot and still be on time: half an interval, at least 20 minutes. */
export function graceHours(everyHours: number): number {
  return Math.max(everyHours * 0.5, 1 / 3);
}

export interface FeedReading {
  lastOk: string | null;
  lastFailure: string | null;
}

/**
 * A scheduled feed's state.
 *
 * Failing when the newest attempt failed (a failure newer than the last good
 * run); otherwise fresh within one interval plus grace, late up to three
 * intervals, stale beyond — or stale outright if it has never completed.
 */
export function feedState(
  reading: FeedReading,
  everyHours: number | null,
  now: Date = new Date(),
): FreshState {
  if (everyHours === null) return 'off';
  const ok = reading.lastOk ? Date.parse(reading.lastOk) : null;
  const failed = reading.lastFailure ? Date.parse(reading.lastFailure) : null;
  if (failed !== null && (ok === null || failed > ok)) return 'failing';
  if (ok === null) return 'stale';
  const ageHours = (now.getTime() - ok) / HOUR;
  if (ageHours <= everyHours + graceHours(everyHours)) return 'fresh';
  if (ageHours <= everyHours * 3) return 'late';
  return 'stale';
}

/** Whole days since a YYYY-MM-DD date, counted in UTC. */
export function ageDays(isoDay: string, now: Date = new Date()): number {
  const then = Date.parse(`${isoDay.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round((today - then) / DAY));
}

/**
 * A committed dataset's state: fresh for the first three quarters of its
 * allowed age, late ("due") after that, stale once past it — which is also
 * the point where the build fails.
 */
export function datasetState(
  dataset: Pick<Dataset, 'checkedOn' | 'maxAgeDays'>,
  now = new Date(),
): FreshState {
  const age = ageDays(dataset.checkedOn, now);
  if (!Number.isFinite(age)) return 'unknown';
  if (age > dataset.maxAgeDays) return 'stale';
  if (age > dataset.maxAgeDays * 0.75) return 'late';
  return 'fresh';
}

/**
 * The review queue, judged on the oldest OPEN lead (expired leads never reach
 * here): late past `lateDays`, stale past `staleDays` — which only a broken
 * expiry or queue can produce, see config/substrata-freshness.ts.
 */
export function queueState(
  oldestOpenFoundAt: string | null,
  { lateDays, staleDays }: { lateDays: number; staleDays: number },
  now = new Date(),
): FreshState {
  if (oldestOpenFoundAt === null) return 'fresh';
  const days = (now.getTime() - Date.parse(oldestOpenFoundAt)) / DAY;
  if (days > staleDays) return 'stale';
  if (days > lateDays) return 'late';
  return 'fresh';
}

/** The worst of several states, for a one-word summary. */
export function worstOf(states: readonly FreshState[]): FreshState {
  const order: FreshState[] = ['failing', 'stale', 'late', 'unknown', 'fresh', 'demand', 'off'];
  return order.find((s) => states.includes(s)) ?? 'fresh';
}
