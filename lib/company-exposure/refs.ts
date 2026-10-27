import { SCORE_WORDS } from '@/config/substrata-assessment';
import type { Dependency } from '@/config/substrata-dependencies';
import type { Bottleneck } from '@/lib/bottlenecks';
import type { ChokepointRef, ExposureSource } from './types';

export function refOf(b: Bottleneck): ChokepointRef {
  return { name: b.name, slug: b.slug, binding: b.binding, horizon: b.horizon };
}

export function sourceOf(d: Dependency): ExposureSource {
  return {
    url: d.source,
    quote: d.quote,
    readOn: d.readOn,
    ...(d.scope ? { scope: d.scope } : {}),
  };
}

const HORIZON_RANK = { now: 0, 'two-years': 1, beyond: 2 } as const;

/** Hardest-binding first, then nearest in time, then by name: one order everywhere. */
export function byBinding(a: ChokepointRef, b: ChokepointRef): number {
  return (
    b.binding - a.binding ||
    HORIZON_RANK[a.horizon] - HORIZON_RANK[b.horizon] ||
    a.name.localeCompare(b.name)
  );
}

/** A 0–3 test in the assessment's own words. */
export function word(score: number): string {
  return SCORE_WORDS[Math.max(0, Math.min(3, score))] ?? 'none';
}

/** One entry per key; the first wins. */
export function uniqueBy<T>(rows: readonly T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const k = key(row);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
