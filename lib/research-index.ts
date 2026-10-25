/** One searchable projection for discovery, visual exploration and AI retrieval.
 * All claims remain owned by the research corpus; this module only joins them.
 *
 * Identity comes from `lib/entities/registry.ts`, which is the one place that
 * decides what exists and what it is called. This file used to build ids and
 * hrefs itself, which meant search could know about a thing the profile pages
 * did not, and vice versa. It is now a thin projection: entity plus the long
 * text used for ranking and retrieval.
 */
import { allEntities } from './entities/registry';
import { isIdentified, isStub, type Entity, type EntityKind } from './entities/types';

export interface ResearchDocument {
  id: string;
  kind: EntityKind;
  title: string;
  href: string;
  text: string;
  sources: string[];
  evidence: string;
  topics: string[];
  /**
   * Multiplies the score, below 1 for a stub company. A down-weighted document
   * is found by its words but does not count towards how rare a word is, so a
   * thousand yearbook names cannot make "Niger" or "uranium" common.
   */
  weight?: number;
}

/** A stub company's weight in every ranking (search, retrieval): present, below anything profiled. */
export const STUB_WEIGHT = 0.6;

/** A tier B company (identified, not profiled): above a stub, below a profiled company. */
export const IDENTIFIED_WEIGHT = 0.8;

/** The ranking weight an entity carries, when it is not a full one. */
export function entityWeight(entity: Pick<Entity, 'evidence'>): number | undefined {
  if (isStub(entity)) return STUB_WEIGHT;
  if (isIdentified(entity)) return IDENTIFIED_WEIGHT;
  return undefined;
}

export function researchDocuments(): ResearchDocument[] {
  return allEntities().map((entity) => ({
    id: entity.id,
    kind: entity.kind,
    title: entity.name,
    href: entity.href,
    text: entity.retrievalText,
    sources: entity.sources,
    evidence: entity.evidence,
    topics: entity.topics,
    ...(entityWeight(entity) ? { weight: entityWeight(entity) } : {}),
  }));
}

const WORD_RE = /[\p{L}\p{N}]+/gu;

function tokenize(text: string): string[] {
  return text.toLocaleLowerCase().match(WORD_RE) ?? [];
}

/**
 * A crude, dependency-free plural fold — "wafers" and "wafer" should be the
 * same word to a search, but "robot" and "robotics" should not (they were the
 * same word under the old substring match, which is why a query for
 * "robotics" scored "ABB Robotics" — a real hit — the same as any document
 * that merely mentioned a robot in passing). Stripping a trailing "s" is the
 * narrowest rule that fixes the former without reopening the latter.
 */
function fold(word: string): string {
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

/** A text's whole words, lower-cased and plural-folded exactly as the scorer reads them. */
export function foldedWords(text: string): Set<string> {
  return new Set(tokenize(text).map(fold));
}

interface IndexedDocument {
  document: ResearchDocument;
  titleWords: Set<string>;
  bodyWords: Set<string>;
}

function indexDocuments(documents: ResearchDocument[]): IndexedDocument[] {
  return documents.map((document) => {
    const titleWords = new Set(tokenize(document.title).map(fold));
    const bodyWords = new Set([
      ...titleWords,
      ...tokenize(document.text).map(fold),
      ...tokenize(document.topics.join(' ')).map(fold),
    ]);
    return { document, titleWords, bodyWords };
  });
}

/**
 * How many documents in the corpus contain a given (folded) word. A word that
 * shows up in almost every document — a boilerplate template sentence
 * ("Bottlenecks its mandate could fund relief for: …") repeated on every
 * capital and country row, or a connector word like "development" — is not a
 * signal that a document is about anything in particular. A word that shows
 * up in a handful of documents is.
 */
function documentFrequencies(indexed: IndexedDocument[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const { document, bodyWords } of indexed) {
    if (document.weight !== undefined) continue;
    for (const word of bodyWords) freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  return freq;
}

/** Rarer words carry more weight; ubiquitous ones taper toward a small floor. */
function wordWeight(freq: number): number {
  return 1 / Math.log2(1 + Math.max(freq, 1));
}

function prepare(documents: ResearchDocument[]) {
  const indexed = indexDocuments(documents);
  return { indexed, freq: documentFrequencies(indexed) };
}

export interface ScoredDocument {
  document: ResearchDocument;
  score: number;
}

/**
 * Score every document against a list of already-extracted words — OR
 * semantics, so a document matching only some of a question's words still
 * surfaces, each word matched as a whole word (never a substring) against the
 * title, body text and topic tags, and weighted by how rare that word is
 * across the corpus rather than counted flatly. Used by chat retrieval, which
 * reduces a question to its meaningful words itself and wants every word's
 * contribution combined, not an all-or-nothing filter.
 */
export function scoreDocuments(documents: ResearchDocument[], words: string[]): ScoredDocument[] {
  const folded = [...new Set(words.map(fold))];
  if (!folded.length) return [];
  const { indexed, freq } = prepare(documents);
  return indexed
    .map(({ document, titleWords, bodyWords }) => {
      let score = 0;
      for (const word of folded) {
        if (!bodyWords.has(word)) continue;
        const weight = wordWeight(freq.get(word) ?? 1);
        score += titleWords.has(word) ? weight * 4 : weight;
      }
      return { document, score: score * (document.weight ?? 1) };
    })
    .filter((x) => x.score > 0);
}

/**
 * Whole-query search: every word in the query must appear, as a whole word,
 * somewhere in the document, ranked by the same rarity-weighted score as
 * `scoreDocuments`. Used by the `/search` page, where a query is a phrase a
 * reader typed and a partial match is usually noise.
 */
export function searchResearch(documents: ResearchDocument[], query: string): ResearchDocument[] {
  const words = [...new Set(tokenize(query).map(fold))];
  if (!words.length) return documents;
  const { indexed, freq } = prepare(documents);
  return indexed
    .filter(({ bodyWords }) => words.every((w) => bodyWords.has(w)))
    .map(({ document, titleWords }) => ({
      document,
      score:
        words.reduce((n, w) => n + (titleWords.has(w) ? 4 : 1) * wordWeight(freq.get(w) ?? 1), 0) *
        (document.weight ?? 1),
    }))
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title))
    .map((x) => x.document);
}
