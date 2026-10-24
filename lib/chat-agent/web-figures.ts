/**
 * A figure cited to a web page must be on that page.
 *
 * The web is now read for most questions (route.ts), and the model is told to
 * copy a figure exactly as a passage prints it. That is checked, not trusted:
 * every figure in a sentence that cites [W#] must appear in the passage(s) it
 * cites. A guidance number "according to [W2]" that [W2] never printed is the
 * most convincing kind of invention there is — it has a link.
 */
import { numbersIn } from './grounding';

const YEAR = /^(19|20)\d{2}$/;

/** The figures of a sentence worth checking: not years, not small counts. */
export function checkedFigures(sentence: string): string[] {
  return [...numbersIn(sentence.replace(/\[W\d+\]/g, ''))].filter(
    (n) => !YEAR.test(n) && !(Number(n) < 20 && !n.includes('.')),
  );
}

/** The passage text of each web page the lookups read, by its [W#] number. */
export function webPassagesIn(results: string[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const r of results.filter((x) => /^\[web_search\]/.test(x))) {
    try {
      const value = JSON.parse(r.replace(/^\[[^\]]+\]\s*/, '')) as {
        results?: { cite_as?: string; passage?: string; excerpt?: string; title?: string }[];
      };
      for (const row of value.results ?? []) {
        const n = Number(row.cite_as?.replace(/^W/, ''));
        if (n) out.set(n, `${row.title ?? ''}\n${row.passage ?? row.excerpt ?? ''}`);
      }
    } catch {
      // A result cut short: its passages cannot vouch for anything.
    }
  }
  return out;
}

const citesIn = (s: string) => [...s.matchAll(/\[W(\d+)\]/g)].map((m) => Number(m[1]));

/**
 * The figures of a [W#]-citing sentence that none of its cited passages
 * holds. Empty when the sentence cites no page, or cites one whose passage
 * we do not have (then nothing can be said either way).
 */
export function unbackedWebFigures(sentence: string, passages: Map<number, string>): string[] {
  const cites = citesIn(sentence);
  if (!cites.length || cites.some((n) => !passages.has(n))) return [];
  const known = new Set(cites.flatMap((n) => [...numbersIn(passages.get(n)!)]));
  return checkedFigures(sentence).filter((f) => !known.has(f));
}

/** Every unbacked web figure in an answer, sentence by sentence. */
export function webFigureProblems(answer: string, passages: Map<number, string>): string[] {
  if (!passages.size) return [];
  const out = new Set<string>();
  for (const sentence of answer.replace(/```[\s\S]*?```/g, ' ').split(/(?<=[.!?])\s+|\n+/))
    for (const f of unbackedWebFigures(sentence, passages)) out.add(f);
  return [...out];
}
