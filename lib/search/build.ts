/**
 * The search index: each document's name, aka and body words, document
 * frequencies and the vocabulary typed words are expanded against. Derived
 * from static config and built once per process.
 */
import { createVocabulary, type Vocabulary } from '@bitbaum/searchkit';
import { nameKeys } from '../rank-priority';
import { searchDocuments, type SearchDoc } from './corpus';
import { words } from './text';

export interface Indexed {
  doc: SearchDoc;
  name: Set<string>;
  nameLength: number;
  aka: Set<string>;
  /** Body word → occurrences, for a gentle term-frequency lift. */
  body: Map<string, number>;
  normTitle: string;
  normAka: string[];
  /** Name, head of the name and other spellings, as word runs (`lib/rank-priority.ts`). */
  keys: string[];
}

export interface SearchIndex {
  docs: Indexed[];
  /** Word → how many documents contain it anywhere. */
  df: Map<string, number>;
  /**
   * The same over the documents that weigh in full, and their count: what idf
   * is computed from. A down-weighted document (a stub company) is findable by
   * its words but never changes how rare a word is, so a thousand yearbook
   * names cannot reorder the profiled entities.
   */
  rankDf: Map<string, number>;
  rankDocs: number;
  /** Every word, counted by documents, so the commoner completion comes first. */
  vocab: Vocabulary;
}

function normPhrase(text: string): string {
  return words(text).join(' ');
}

export function buildIndex(documents: SearchDoc[]): SearchIndex {
  const df = new Map<string, number>();
  const rankDf = new Map<string, number>();
  let rankDocs = 0;
  const docs = documents.map((doc) => {
    const nameWords = words(doc.title);
    const name = new Set(nameWords);
    const aka = new Set(doc.aka.flatMap(words));
    const body = new Map<string, number>();
    for (const w of words(`${doc.summary} ${doc.body}`)) body.set(w, (body.get(w) ?? 0) + 1);
    const full = doc.weight === undefined;
    if (full) rankDocs += 1;
    for (const w of new Set([...name, ...aka, ...body.keys()])) {
      df.set(w, (df.get(w) ?? 0) + 1);
      if (full) rankDf.set(w, (rankDf.get(w) ?? 0) + 1);
    }
    return {
      doc,
      name,
      nameLength: Math.max(nameWords.length, 1),
      aka,
      body,
      normTitle: nameWords.join(' '),
      normAka: doc.aka.map(normPhrase),
      keys: nameKeys(doc.title, doc.aka, words),
    };
  });
  return { docs, df, rankDf, rankDocs, vocab: createVocabulary(df) };
}

let cached: SearchIndex | null = null;
export function defaultIndex(): SearchIndex {
  if (!cached) cached = buildIndex(searchDocuments());
  return cached;
}
