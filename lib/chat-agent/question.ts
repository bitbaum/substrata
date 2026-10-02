/**
 * What a question names: the bottlenecks, companies and countries in its
 * words. Pure string work over the corpus's own names; the planner (plan.ts)
 * decides what to look up from it.
 */
import { BOTTLENECKS, type Bottleneck } from '../bottlenecks';
import { MARKET_PARTICIPANTS, type MarketParticipant } from '../participants';
import { norm } from '../chat-tools/resolve';
import { entitiesOfKind } from '../entities/registry';

// Words too generic to name a bottleneck on their own: "EUV machines" once
// pulled the laser powder-bed fusion MACHINES record before the EUV one.
const STOP = new Set([
  'and',
  'the',
  'for',
  'with',
  'from',
  'slots',
  'grade',
  'high',
  'large',
  'machines',
  'capacity',
  'supply',
  'equipment',
  'materials',
  'tools',
  'production',
]);
// Brand words too generic to name one company on their own.
const GENERIC_BRAND = new Set([
  'advanced',
  'applied',
  'china',
  'chinese',
  'global',
  'united',
  'american',
  'general',
  'national',
  'international',
  'tokyo',
  'japan',
  'first',
  'new',
  'north',
  'south',
]);
/**
 * The words of a bottleneck's name worth matching: long, non-generic words,
 * plus short ones written in capitals (EUV, HBM, GOES) — the most specific
 * words a reader types.
 */
function distinctiveWords(name: string): string[] {
  const caps = new Set(
    (name.match(/\b[A-Z][A-Za-z]*[A-Z][A-Za-z]*\b/g) ?? []).map((w) => w.toLowerCase()),
  );
  return norm(name)
    .split(' ')
    .filter((w) => (w.length > 3 || caps.has(w)) && !STOP.has(w));
}

/** The bottleneck a question names, by its most distinctive words — or none when two tie. */
export function bottleneckIn(question: string): Bottleneck | undefined {
  const q = ` ${norm(question)} `;
  let best: { b: Bottleneck; score: number } | undefined;
  let tied = false;
  for (const b of BOTTLENECKS) {
    const words = distinctiveWords(b.name);
    // "transformer" should meet "transformers": match a word or its plural.
    const score = words.filter((w) => q.includes(` ${w} `) || q.includes(` ${w}s `)).length;
    if (!score) continue;
    if (!best || score > best.score) {
      best = { b, score };
      tied = false;
    } else if (score === best.score) tied = true;
  }
  return best && !tied ? best.b : undefined;
}

/**
 * Up to two bottlenecks a question names by their distinctive words, best
 * first — "neon and helium" names two; `bottleneckIn` returns none on a tie.
 */
export function bottlenecksIn(question: string, max = 2): Bottleneck[] {
  const q = ` ${norm(question)} `;
  return BOTTLENECKS.map((b) => {
    const words = distinctiveWords(b.name);
    return { b, score: words.filter((w) => q.includes(` ${w} `) || q.includes(` ${w}s `)).length };
  })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, max)
    .map((x) => x.b);
}

/** Countries a question names as whole words ("Germany", "Russia"), at most two. */
export function countriesIn(question: string): { iso2: string; name: string }[] {
  const q = ` ${norm(question)} `;
  return entitiesOfKind('country')
    .filter((c) => q.includes(` ${norm(c.name)} `))
    .slice(0, 2)
    .map((c) => ({ iso2: c.key, name: c.name }));
}

/**
 * Companies a question names, longest names first, at most `max`: the full
 * name, or its brand word when that is distinctive — "Samsung" finds Samsung
 * Foundry and Samsung Memory (asked "TSMC vs Samsung", the model was told
 * Samsung was not recorded, 2026-10-02).
 */
export function companiesIn(question: string, max = 2): MarketParticipant[] {
  const q = ` ${norm(question)} `;
  const exact = (p: MarketParticipant) => {
    const n = norm(p.name);
    return n.length >= 3 && q.includes(` ${n} `);
  };
  const byBrand = (p: MarketParticipant) => {
    const n = norm(p.name);
    const brand = n.split(' ')[0];
    return (
      n.includes(' ') && brand.length >= 4 && !GENERIC_BRAND.has(brand) && q.includes(` ${brand} `)
    );
  };
  const named = MARKET_PARTICIPANTS.filter(exact).sort((a, b) => b.name.length - a.name.length);
  // A brand word only counts when no full name already covers it: "TSMC" is
  // TSMC, not TSMC Advanced Packaging.
  const brands = MARKET_PARTICIPANTS.filter(
    (p) =>
      !exact(p) &&
      byBrand(p) &&
      !named.some((n) => norm(n.name).split(' ')[0] === norm(p.name).split(' ')[0]),
  );
  return [...named, ...brands].slice(0, max);
}
