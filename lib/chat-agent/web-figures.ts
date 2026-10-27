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
import { sentencesIn } from './sentences';

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

// ---------------------------------------------------------------------------
// A chip with nothing behind it. Seen live (2026-10-27, a screenshot of a post
// about neoclouds): the opening's generic analysis ended in [W1], drawn as a
// finance.yahoo.com chip, and the page — a stock quote — said nothing of the
// kind. A sentence that cites a page must carry something the page holds: a
// figure its passage prints (above) or a name its passage gives.
// ---------------------------------------------------------------------------

/** Capitalised words that open sentences, never names. */
const COMMON = new Set(
  'a an and as at both but by each even for from he here how if in it its many most no not of on our she so some still such that the their there these they this those to we what when where why with yet you your'.split(
    ' ',
  ),
);

/** Names a sentence gives: capitalised words that are not common openers, and acronyms. */
function namesIn(sentence: string): string[] {
  const plain = sentence.replace(/\[W\d+\]|[*_`]/g, '');
  const words = plain.match(/(?<![\p{L}\p{N}])\p{Lu}[\p{L}\p{N}&'’-]*/gu) ?? [];
  return words
    .map((w) => w.replace(/(['’]s|['’-]+)$/u, ''))
    .filter((w) => w.length >= 2 && !COMMON.has(w.toLowerCase()));
}

/**
 * Whether the pages a sentence cites hold what it says: a figure they print,
 * or — for a sentence with no figure — a name they give. True when it cites
 * no page or one whose passage we do not have (nothing can be said).
 */
export function webCiteSupported(sentence: string, passages: Map<number, string>): boolean {
  const cites = citesIn(sentence);
  if (!cites.length || cites.some((n) => !passages.has(n))) return true;
  const text = cites.map((n) => passages.get(n)!).join('\n');
  const figures = checkedFigures(sentence);
  if (figures.length) {
    const known = numbersIn(text);
    return figures.some((f) => known.has(f));
  }
  const lower = text.toLowerCase();
  return namesIn(sentence).some((n) => lower.includes(n.toLowerCase()));
}

/**
 * The answer with the [W#] taken off every sentence its pages do not support,
 * so no chip stands on it; the sentence is then judged as uncited (default
 * deny). Tables, code and headings are left to their own checks.
 */
export function withoutUnsupportedWebCites(answer: string, passages: Map<number, string>): string {
  if (!passages.size) return answer;
  let fence = false;
  return answer
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) fence = !fence;
      if (fence || /^\s*(```|#|\|)/.test(line) || !/\[W\d+\]/.test(line)) return line;
      return sentencesIn(line)
        .map((s) =>
          webCiteSupported(s, passages)
            ? s
            : s.replace(/\s*\[W\d+\]/g, '').replace(/\s+([.!?])$/, '$1'),
        )
        .join(' ');
    })
    .join('\n');
}
