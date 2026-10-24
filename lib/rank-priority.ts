/**
 * What a page IS outranks what merely MENTIONS it. Shared by the ⌘K search
 * (`lib/search/score.ts`) and the Ask's retrieval (`lib/index/retrieve.ts`),
 * so the two cannot disagree about which kind of record answers a name.
 *
 * Why this exists: word-match scores grow with every record that repeats a
 * material's name. A news event's headline is a sentence, and a sentence
 * about gallium in China holds BOTH words of "gallium china" — the bottleneck
 * page, named "Gallium, refined", holds one of them in its name. Every event
 * filed about a material therefore stood a chance of pushing that material's
 * own page down, and adding sourced data made search worse. Three bounded,
 * named adjustments fix it at the root:
 *
 *   1. a kind weight: for an equal word match, the record a reader means by a
 *      name comes first — bottleneck > country > company > science/policy >
 *      event > note/article — and a stub company keeps its own 0.6 on top;
 *   2. a headline is not a name: an event's title words count half a name's,
 *      in the search, where a title word is otherwise worth a name's;
 *   3. a named-term bonus: when a query word (or a run of them) IS a record's
 *      name, the head of its name or one of its other spellings, that record
 *      is the thing itself, not a document about it.
 *
 * Both are bounded: the weight is a fixed factor per kind, the bonus is at
 * most one full step and scales with the share of the query the name covers.
 */

/**
 * The factor a kind's word-match score is multiplied by. Reasons per row; the
 * order is the point, the gaps are kept small so a much better word match
 * (an event's own distinctive words, "MOFCOM announcement 46") still wins.
 */
export const KIND_WEIGHT: Readonly<Record<string, number>> = {
  // The site's subject: a named constraint is what a material query means.
  bottleneck: 1.15,
  // Where it is made or controlled: the other half of "gallium china".
  country: 1.1,
  // Who makes it. A stub company is further multiplied by STUB_WEIGHT (0.6).
  company: 1.05,
  // Records that explain or govern a bottleneck: profiled, but secondary to it.
  science: 1,
  policy: 1,
  // Definitions and smaller registers: read through, rarely the destination.
  glossary: 0.9,
  capital: 0.9,
  facility: 0.9,
  loop: 0.9,
  talent: 0.9,
  lab: 0.9,
  // One dated fact ABOUT a bottleneck or country, under the page it is about.
  event: 0.8,
  // Long prose that mentions many things: found by its words, never by a name.
  note: 0.75,
  article: 0.75,
  learn: 0.75,
};

/** The weight of a kind with no row: a profiled record, neither raised nor lowered. */
export function kindWeight(kind: string | undefined): number {
  return (kind ? KIND_WEIGHT[kind] : undefined) ?? 1;
}

/**
 * Kinds whose title is a HEADLINE (a sentence about things), not a name. A
 * word in a headline says the record is about that thing; a word in a name
 * says the record IS it. Search counts a headline word at `HEADLINE_SHARE` of
 * a name word and never gives a headline the "every word is in the name"
 * bonuses: otherwise one event whose sentence holds every query word
 * out-points the page named by one of them, and more events mean more of it.
 */
export const HEADLINE_KINDS: ReadonlySet<string> = new Set(['event', 'note', 'article', 'learn']);

/** A headline word's worth, as a share of a name word's: between a body word and another spelling. */
export const HEADLINE_SHARE = 0.5;

/**
 * The search's bonus, in its score units, when the WHOLE query is a record's
 * name: one name-field step (NAME = 10) for every word, twice — the size of
 * the gap between a word in a name and a word in a headline, so a page named
 * by the query is not out-pointed by a sentence that happens to hold more of
 * the query's words. Scaled by the share of the query the name covers.
 */
export const NAMED_TERM_BONUS = 20;

/**
 * The retrieval's equivalent, as a multiplier on the chunk's raw word score:
 * up to +50% when the whole question is the record's name. Retrieval scores
 * are normalised to the best hit, so a factor, not points.
 */
export const NAMED_TERM_LIFT = 0.5;

/**
 * The ways a record is named, as word runs: its full name, the head of its
 * name (the part before a comma, a bracket or a dash — "Gallium, refined" is
 * named "gallium", "Liquid helium (He-4)" is named "liquid helium"), and each
 * other spelling. `tokenize` is the caller's own, so a key matches exactly
 * what that caller's index would.
 */
export function nameKeys(
  name: string,
  aka: readonly string[],
  tokenize: (text: string) => string[],
): string[] {
  const head = name.split(/\s*[,(]|\s+[—–-]\s+/)[0] ?? name;
  const keys = [name, head, ...aka].map((t) => tokenize(t).join(' ')).filter(Boolean);
  return [...new Set(keys)];
}

/**
 * The query's word positions, grouped into the units a reader means: a run
 * that is exactly one of `unitKeys` (a country's name or other spelling,
 * "united state america") is ONE unit, every other word its own. Longest run
 * first. Without it "gallium United States of America" is four words, three
 * of them a country's, and any page that says "United States" out-points the
 * page named "Gallium" by sheer word count.
 */
export function queryUnits(query: readonly string[], unitKeys: ReadonlySet<string>): number[][] {
  const units: number[][] = [];
  for (let i = 0; i < query.length;) {
    let end = i + 1;
    for (let j = query.length; j > i + 1; j--)
      if (unitKeys.has(query.slice(i, j).join(' '))) {
        end = j;
        break;
      }
    units.push(Array.from({ length: end - i }, (_, k) => i + k));
    i = end;
  }
  return units;
}

/**
 * The share of the query, 0..1, covered by runs that are exactly one of
 * `keys`, counted in `units` (each word its own unit when none are given).
 * "gallium china" against the Gallium bottleneck is 0.5 (the run "gallium"
 * is its head); against China, 0.5; against an event whose headline holds
 * both words, 0: no run of the query is its name.
 */
export function namedShare(
  keys: readonly string[],
  query: readonly string[],
  units: readonly (readonly number[])[] = query.map((_, i) => [i]),
): number {
  if (!query.length || !keys.length) return 0;
  const set = new Set(keys);
  const covered = new Array<boolean>(query.length).fill(false);
  for (let i = 0; i < query.length; i++)
    for (let j = i + 1; j <= query.length; j++)
      if (set.has(query.slice(i, j).join(' '))) covered.fill(true, i, j);
  return units.filter((u) => u.every((i) => covered[i])).length / units.length;
}
