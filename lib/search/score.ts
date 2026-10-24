/**
 * Scoring: name beats other spellings beats body, with term frequency, idf,
 * phrase-level bonuses, a bonus when a run of the query IS the name, and a
 * per-kind weight — the last two shared with retrieval (`lib/rank-priority.ts`).
 */
import {
  HEADLINE_KINDS,
  HEADLINE_SHARE,
  NAMED_TERM_BONUS,
  kindWeight,
  namedShare,
} from '../rank-priority';
import type { Indexed, SearchIndex } from './build';
import type { Expansion } from './expand';

const NAME = 10;
const AKA = 7;
const BODY = 1.5;

export function idf(index: SearchIndex, word: string): number {
  return Math.log(1 + index.rankDocs / (index.rankDf.get(word) ?? 1));
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
  // A headline word is never "in the name": it earns no name bonuses below.
  const headline = HEADLINE_KINDS.has(d.doc.type);
  for (const { word, weight = 0 } of expansions) {
    let field = 0;
    if (d.name.has(word)) field = headline ? NAME * HEADLINE_SHARE : NAME;
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
  /** Token positions grouped as the reader means them (`queryUnits`): a country's name is one. */
  units: readonly (readonly number[])[] = tokens.map((_, i) => [i]),
): Match | null {
  let score = 0;
  let inName = 0;
  let hitCount = 0;
  const matched: string[] = [];
  for (const unit of units) {
    // A unit weighs as one word: the mean of its words, so a long name cannot outvote a short one.
    let unitScore = 0;
    let unitHits = 0;
    for (const i of unit) {
      const t = scoreToken(index, d, tokens[i]);
      if (t.score === 0) {
        if (requireAll) return null;
        continue;
      }
      unitScore += t.score;
      unitHits++;
      if (t.inName) inName++;
      matched.push(...t.matched);
    }
    if (unitScore === 0) continue;
    // Half a country's name is half a match of it.
    hitCount += unitHits / unit.length;
    score += unitScore / unit.length;
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
  // A run of the query that IS this record's name: the thing, not a page about it.
  if (phrase) score += NAMED_TERM_BONUS * namedShare(d.keys, phrase.split(' '), units);
  // A partial match is ranked by how much of the query it covers first.
  if (!requireAll) score *= hitCount / units.length;
  score *= kindWeight(d.doc.type) * (d.doc.weight ?? 1);
  return { score, words: matched, inName };
}
