/**
 * How the sweep behaves, as data an operator can change without a deploy.
 * Stored in `research_sweep_settings` and always read through
 * `parseSweepSettings`, so a bad value lands on a default.
 */

const EVENT_WORDS = [
  'shortage',
  'expansion',
  'new plant',
  'lead time',
  'export',
  'licence',
  'license',
  'closure',
  'outage',
  'contract',
];

/**
 * What an operator may change without a deploy. Stored in
 * `research_sweep_settings`, edited from the desk's settings page, and always
 * parsed through `parseSweepSettings` so a bad value lands on a default.
 */
export interface SweepSettings {
  /** The timer fires hourly; a run is skipped until this many hours have passed. */
  everyHours: number;
  /** Nodes per scheduled run. Bounded by the 300s the cron wrapper allows. */
  nodesPerRun: number;
  /** Pages read per node, of the results that survive the blocklist. */
  pagesPerNode: number;
  /** Hosts blocked on top of the built-in list. */
  blockedHosts: string[];
  /** Words that mark a page as reporting a change. Replaces the default list when set. */
  eventWords: string[];
}

export const DEFAULT_SWEEP_SETTINGS: SweepSettings = {
  everyHours: 6,
  nodesPerRun: 4,
  pagesPerNode: 4,
  blockedHosts: [],
  eventWords: EVENT_WORDS,
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

export function parseSweepSettings(raw: unknown): SweepSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const list = (value: unknown, keep: (s: string) => boolean) =>
    Array.isArray(value)
      ? [...new Set(value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()))]
          .filter(keep)
          .slice(0, 100)
      : [];
  const words = list(o.eventWords, (w) => w.length >= 3 && w.length <= 40 && !/["()]/.test(w));
  return {
    everyHours: clamp(o.everyHours, 1, 48, DEFAULT_SWEEP_SETTINGS.everyHours),
    nodesPerRun: clamp(o.nodesPerRun, 1, 8, DEFAULT_SWEEP_SETTINGS.nodesPerRun),
    pagesPerNode: clamp(o.pagesPerNode, 1, 8, DEFAULT_SWEEP_SETTINGS.pagesPerNode),
    blockedHosts: list(o.blockedHosts, (h) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)),
    eventWords: words.length > 0 ? words : EVENT_WORDS,
  };
}

/** The search query for a node: its term, with the words of a change around it. */
export function queryFor(term: string, words: readonly string[], year: number): string {
  const any = words.map((w) => (w.includes(' ') ? `"${w}"` : w)).join(' OR ');
  return `"${term}" (${any}) ${year}`;
}
