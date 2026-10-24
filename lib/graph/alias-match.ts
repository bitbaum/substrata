/**
 * Which graph nodes might be one organisation printed two ways. PROPOSES only:
 * nothing here changes the graph. A pair merges when a person has read the
 * evidence and written it into config/entity-aliases.ts.
 *
 * Conservative on purpose. Four readings, each a named rule a reviewer can
 * check against the two strings:
 *
 * - `legal-form`: equal once case, punctuation, diacritics and legal forms are
 *   gone ("Glencore" / "Glencore Plc.");
 * - `spacing`: equal once spaces and hyphens are gone too ("UraniumOne Inc." /
 *   "Uranium One Inc.");
 * - `cut-short`: the same words, the last one in one name a prefix of the
 *   other's (at least five letters) ("NAC Kazatomp JSC" / "NAC Kazatomprom
 *   JSC") — only between nodes printed in the same country;
 * - `transliteration`: equal after folding the usual Latin spellings of one
 *   Cyrillic or Kazakh sound (iy/ii/y, kh/h, ts/tz, zh/j, ou/u, doubled
 *   letters) ("Norilskiy" / "Norilsky").
 *
 * The evidence printed with each pair is what a reviewer needs to say yes or
 * no: both strings, their countries, and the counterparties and facilities
 * they share. A pair with no country in common and nothing shared is still
 * listed — a reviewer may know better — but it sorts last.
 */
import { bareName } from './parties';

export type AliasRule = 'legal-form' | 'spacing' | 'cut-short' | 'transliteration';

export interface MatchNode {
  id: string;
  name: string;
  iso2: string[];
  /** Ids of the nodes it has a relation with, either direction. */
  neighbours: string[];
}

export interface AliasCandidate {
  a: MatchNode;
  b: MatchNode;
  rule: AliasRule;
  sharedCountries: string[];
  /** Counterparties and facilities both are related to. */
  shared: string[];
}

/** Lower case, no diacritics, no punctuation, no legal forms, single spaces. */
export function matchKey(name: string): string {
  return bareName(name.replace(/\s*\([^)]*\)\s*/g, ' '))
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const FOLDS: [RegExp, string][] = [
  [/(iy|ii|yi|ij)\b/g, 'y'],
  [/kh/g, 'h'],
  [/tz/g, 'ts'],
  [/zh/g, 'j'],
  [/ou/g, 'u'],
  [/([a-z])\1/g, '$1'],
];

/** The key with the usual transliteration variants folded together. */
export function foldedKey(key: string): string {
  return FOLDS.reduce((s, [re, to]) => s.replace(re, to), key);
}

function cutShort(a: string, b: string): boolean {
  const x = a.split(' ');
  const y = b.split(' ');
  if (x.length !== y.length || x.length < 2) return false;
  const last = x.length - 1;
  if (x.slice(0, last).join(' ') !== y.slice(0, last).join(' ')) return false;
  const [short, long] = x[last].length < y[last].length ? [x[last], y[last]] : [y[last], x[last]];
  return short.length >= 5 && short !== long && long.startsWith(short);
}

/** The rule two names meet, strongest first, or null. */
export function aliasRule(a: MatchNode, b: MatchNode): AliasRule | null {
  const ka = matchKey(a.name);
  const kb = matchKey(b.name);
  if (!ka || !kb || ka.length < 3 || kb.length < 3) return null;
  if (ka === kb) return 'legal-form';
  if (ka.replace(/ /g, '') === kb.replace(/ /g, '')) return 'spacing';
  if (a.iso2.some((c) => b.iso2.includes(c)) && cutShort(ka, kb)) return 'cut-short';
  if (foldedKey(ka) === foldedKey(kb)) return 'transliteration';
  return null;
}

/**
 * Every pair of nodes that meets a rule, strongest evidence first: pairs that
 * share a country and a counterparty, then a country, then neither.
 * `reviewed` holds `alias|canonical` keys already decided; they are skipped.
 */
export function aliasCandidates(
  nodes: readonly MatchNode[],
  reviewed: ReadonlySet<string> = new Set(),
): AliasCandidate[] {
  const out: AliasCandidate[] = [];
  // Bucket by the first word of the folded key: every rule above keeps it.
  const buckets = new Map<string, MatchNode[]>();
  for (const n of nodes) {
    const first = foldedKey(matchKey(n.name)).split(' ')[0];
    if (first) (buckets.get(first) ?? buckets.set(first, []).get(first)!).push(n);
  }
  // Spacing can split the first word ("uraniumone" / "uranium one"): bucket by its first five letters too.
  const byPrefix = new Map<string, MatchNode[]>();
  for (const n of nodes) {
    const p = matchKey(n.name).replace(/ /g, '').slice(0, 5);
    if (p.length === 5) (byPrefix.get(p) ?? byPrefix.set(p, []).get(p)!).push(n);
  }
  const seen = new Set<string>();
  for (const group of [...buckets.values(), ...byPrefix.values()]) {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const [a, b] = [group[i], group[j]].sort((x, y) => x.id.localeCompare(y.id));
        const key = `${a.id}|${b.id}`;
        if (a.id === b.id || seen.has(key)) continue;
        seen.add(key);
        if (reviewed.has(`${a.id}|${b.id}`) || reviewed.has(`${b.id}|${a.id}`)) continue;
        const rule = aliasRule(a, b);
        if (!rule) continue;
        out.push({
          a,
          b,
          rule,
          sharedCountries: a.iso2.filter((c) => b.iso2.includes(c)),
          shared: a.neighbours.filter((n) => b.neighbours.includes(n)),
        });
      }
  }
  const weight = (c: AliasCandidate) =>
    (c.shared.length ? 2 : 0) + (c.sharedCountries.length ? 1 : 0);
  return out.sort((x, y) => weight(y) - weight(x) || x.a.id.localeCompare(y.a.id));
}
