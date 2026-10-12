/**
 * A lens is one way of reading a chain: what it means for markets, for
 * research, for money, for people, for policy. Every lens has the same shape,
 * so the panel lays them out alike and a reader learns it once:
 *
 *   what it means  — two or three sentences, built from the records
 *   figures        — the few numbers that carry the argument
 *   items          — the records behind it, newest or most important first
 *   more           — the page that holds all of it, filtered to this chain
 *
 * Nothing in a lens is written by hand or guessed. A lens with nothing on
 * file says so, and says it is a gap in the records, not a finding.
 */
export type LensId = 'overview' | 'markets' | 'research' | 'money' | 'people' | 'policy';

export interface LensFigure {
  label: string;
  value: string;
  /** A note under the value: a date, a unit, a basis. */
  note?: string;
}

export interface LensItem {
  title: string;
  /** One line under it, in the mono face: the measured or recorded part. */
  meta?: string;
  /** A sentence of context, where the record has one. */
  text?: string;
  href?: string;
  /** Opens a source off the site. */
  external?: boolean;
}

export interface Lens {
  id: LensId;
  /** The tab: one or two words. */
  label: string;
  /** The question the lens answers, as its heading. */
  question: string;
  means: string[];
  figures: LensFigure[];
  /** Headed groups of records. */
  groups: { title: string; items: LensItem[] }[];
  /** Where all of it lives, filtered to this chain. */
  more: { label: string; href: string }[];
  /** How much is on file, for the tab's count; 0 dims the tab. */
  weight: number;
}

/** "1 rule", "3 rules". */
export function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Up to `max` of a list, newest or most important first. */
export function top<T>(items: readonly T[], max = 5): T[] {
  return items.slice(0, max);
}
