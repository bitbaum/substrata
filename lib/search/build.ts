/**
 * The search index: each document's name, aka and body words, document
 * frequencies and a sorted vocabulary. Derived from static config and built
 * once per process.
 */
import { searchDocuments, type SearchDoc } from './corpus';
import { probeOf } from './snippets';
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
  probeSummary: string;
  probeBody: string;
}

export interface SearchIndex {
  docs: Indexed[];
  /** Word → how many documents contain it anywhere. */
  df: Map<string, number>;
  /** Every word, sorted, for prefix lookups by binary search. */
  vocab: string[];
}

function normPhrase(text: string): string {
  return words(text).join(' ');
}

export function buildIndex(documents: SearchDoc[]): SearchIndex {
  const df = new Map<string, number>();
  const docs = documents.map((doc) => {
    const nameWords = words(doc.title);
    const name = new Set(nameWords);
    const aka = new Set(doc.aka.flatMap(words));
    const body = new Map<string, number>();
    for (const w of words(`${doc.summary} ${doc.body}`)) body.set(w, (body.get(w) ?? 0) + 1);
    for (const w of new Set([...name, ...aka, ...body.keys()])) df.set(w, (df.get(w) ?? 0) + 1);
    return {
      doc,
      name,
      nameLength: Math.max(nameWords.length, 1),
      aka,
      body,
      normTitle: nameWords.join(' '),
      normAka: doc.aka.map(normPhrase),
      probeSummary: probeOf(doc.summary),
      probeBody: probeOf(doc.body),
    };
  });
  return { docs, df, vocab: [...df.keys()].sort() };
}

let cached: SearchIndex | null = null;
export function defaultIndex(): SearchIndex {
  if (!cached) cached = buildIndex(searchDocuments());
  return cached;
}
