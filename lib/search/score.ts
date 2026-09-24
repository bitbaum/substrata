/**
 * Scoring: name beats other spellings beats body, with term frequency, idf,
 * phrase-level bonuses and a per-type weight.
 */
import type { SearchType } from '../search-types';
import type { Indexed, SearchIndex } from './build';
import type { Expansion } from './expand';

const NAME = 10;
const AKA = 7;
const BODY = 1.5;

/**
 * How much a type's match is worth, relative to an entity. Evidence rows are
 * named "<producer> · <material>", so they match both halves of most queries
 * and — unweighted — buried the bottleneck they are evidence FOR under seven
 * of its own candidate pages. They are the trail, not the destination.
 */
const TYPE_WEIGHT: Partial<Record<SearchType, number>> = {
  bottleneck: 1.1,
  glossary: 0.9,
  note: 0.9,
  capital: 0.9,
  facility: 0.9,
  loop: 0.9,
  talent: 0.9,
  event: 0.8,
  evidence: 0.55,
};

export function idf(index: SearchIndex, word: string): number {
  return Math.log(1 + index.docs.length / (index.df.get(word) ?? 1));
}

export interface Match {
  score: number;
  /** Words that matched, for highlighting. */
  words: string[];
  /** Query words matched in the name. */
  inName: number;
}

function scoreToken(index: SearchIndex, d: Indexed, expansions: Expansion[]) {
  let best = 0;
  let inName = false;
  const matched: string[] = [];
  for (const { word, weight = 0 } of expansions) {
    let field = 0;
    if (d.name.has(word)) field = NAME;
    else if (d.aka.has(word)) field = AKA;
    const tf = d.body.get(word) ?? 0;
    const body = tf ? BODY * (1 + Math.log(tf)) : 0;
    const s = (field + body) * weight;
    if (s > 0) matched.push(word);
    if (s > best) {
      best = s;
      inName = field === NAME;
    }
  }
  return { score: best, inName, matched };
}

export function scoreDoc(
  index: SearchIndex,
  d: Indexed,
  tokens: Expansion[][],
  phrase: string,
  requireAll: boolean,
): Match | null {
  let score = 0;
  let inName = 0;
  let hitCount = 0;
  const matched: string[] = [];
  for (const expansions of tokens) {
    const t = scoreToken(index, d, expansions);
    if (t.score === 0) {
      if (requireAll) return null;
      continue;
    }
    hitCount++;
    score += t.score;
    if (t.inName) inName++;
    matched.push(...t.matched);
  }
  if (!hitCount) return null;
  // Phrase-level signals: the whole query IS the name, starts it, or sits in it.
  if (phrase) {
    if (d.normTitle === phrase) score += 40;
    else if (d.normAka.includes(phrase)) score += 30;
    else if (d.normTitle.startsWith(`${phrase} `)) score += 12;
    else if (` ${d.normTitle} `.includes(` ${phrase} `)) score += 6;
  }
  // Every word in the name, and a name that is mostly those words, reads as "this is it".
  if (inName === tokens.length) score += 8;
  score += (inName / d.nameLength) * 3;
  // A partial match is ranked by how much of the query it covers first.
  if (!requireAll) score *= hitCount / tokens.length;
  score *= TYPE_WEIGHT[d.doc.type] ?? 1;
  return { score, words: matched, inName };
}
