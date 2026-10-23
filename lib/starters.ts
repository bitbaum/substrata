/**
 * The questions offered before anyone has asked one — on the home page under
 * the Ask box, on /chat's empty screen, in the dock.
 *
 * Every one is GENERATED from the corpus, per facet, never typed: the
 * bottleneck that binds worst now, a company that holds one, a material with
 * a USGS table, a country with a computed headline, a rule, a science entry,
 * a chokepoint whose makers publish open roles, a lender, the bottleneck the
 * newest event moved. A typed list showed the same three questions to every
 * reader every day (one of them about one country), and said nothing about
 * how many kinds of thing the corpus holds. Now four tiles never share a
 * facet, and the set rotates with the date.
 *
 * Pure: the same seed gives the same set, so a page served from a cache and
 * the page rendered fresh agree.
 */
import { CHAT_STARTERS } from '@/config/substrata-chat';
import type { HomeAsk } from '@/lib/home-asks';
import { FACETS, GENERATORS, LABEL_MAX, clip, type Facet, type Starter } from './starter-facets';

export { FACETS, LABEL_MAX, clip, type Facet, type Starter };

/** FNV-1a, 32-bit: small, stable across runtimes, spread enough to pick a row. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The day the seed names, as a count of days, so consecutive dates start the
 * facet rotation one step apart and every facet is reached within nine days.
 * A seed that is not a date walks by its hash instead.
 */
function dayOf(seed: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(seed);
  if (!m) return hash(seed);
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

const cache = new Map<Facet, Starter[]>();

/** Every question a facet can ask, built once: the corpus is static config. */
export function candidates(facet: Facet): Starter[] {
  let rows = cache.get(facet);
  if (!rows) {
    rows = GENERATORS[facet]();
    cache.set(facet, rows);
  }
  return rows;
}

/** The typed fallback, only for a corpus with nothing to draw from. */
function fallback(count: number): Starter[] {
  return CHAT_STARTERS.slice(0, count).map((s) => ({
    facet: 'bottleneck' as const,
    label: clip(s.label),
    question: s.question,
    about: '',
    href: '/bottlenecks',
  }));
}

export interface StarterOptions {
  /** An ISO date, optionally followed by `|` and where the reader came from. */
  seed: string;
  /** Which facets may be drawn from; all of them by default. */
  facets?: readonly Facet[];
  count?: number;
  /** Questions not to offer again (another screen already shows them). */
  exclude?: readonly string[];
}

/**
 * `count` starters, no two from one facet, chosen by the seed.
 *
 * The facets are walked round-robin from an offset the date sets, so the
 * tiles move one facet along each day and every facet is reached within nine
 * days; within a facet the seed's hash picks the row, so the same facet asks
 * about a different company or rule from one day to the next.
 */
export function starters({
  seed,
  facets = FACETS,
  count = 4,
  exclude = [],
}: StarterOptions): Starter[] {
  const open = facets.filter((f) => candidates(f).length > 0);
  if (open.length === 0) return fallback(count);
  const skip = new Set(exclude);
  const [, rest = ''] = seed.split('|', 2);
  const offset = (dayOf(seed) + hash(rest)) % open.length;
  const out: Starter[] = [];
  for (let i = 0; i < Math.min(count, open.length); i++) {
    const facet = open[(offset + i) % open.length];
    const rows = candidates(facet);
    const start = hash(`${seed}|${facet}`) % rows.length;
    for (let j = 0; j < rows.length; j++) {
      const row = rows[(start + j) % rows.length];
      if (skip.has(row.question)) continue;
      out.push(row);
      break;
    }
  }
  return out;
}

/** A screen's seed: today's date, and where the reader came from when that matters. */
export function seedFor(now: Date, from?: string): string {
  const date = now.toISOString().slice(0, 10);
  return from ? `${date}|${from}` : date;
}

/**
 * The home page's four, for the seed (an ISO date): one per facet, so the
 * first thing a reader sees says how many kinds of thing are here — a
 * bottleneck, a company, a country, a rule, a material, a science entry, a
 * lender, the newest event. /chat's empty screen draws its own four with a
 * different seed, so the two screens differ.
 */
export function homeAsks(seed: string): HomeAsk[] {
  return starters({ seed, count: 4 }).map(({ label, question }) => ({ label, question }));
}
