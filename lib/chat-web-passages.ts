/**
 * The passages of a page that answer a question, quoted verbatim.
 *
 * A search snippet is the engine's sentence about a page, and it rarely holds
 * the figure: asked for Kazatomprom's 2026 production guidance (2026-10-24),
 * the answer paraphrased snippets — "moved to lower its 2026 production
 * guidance" — and never gave the number, because the number was on the page
 * nobody read. So pages are read (chat-web.ts `lookUp`) and the model is given
 * the windows of text that match the question: every word and number exactly
 * as the page prints it, so a figure in the answer can be checked against the
 * passage it cites (web-figures.ts).
 */

const STOP = new Set(
  'that this with from have were which their about than what into more most also been does did they them will would could should there where when your here over under after before said says say'.split(
    ' ',
  ),
);

/** Words a question asks for figures with: sentences that carry numbers then score higher. */
const FIGURE_ASK =
  /\b(how (much|many)|guidance|production|output|price|prices|share|percent|capacity|forecast|target|revenue|earnings|tonnes?|tons?|lbs?|pounds?|volume|moved|rose|fell)\b/i;

function digits(n: string): string {
  return n.replace(/[^\d]/g, '').replace(/^0+/, '');
}

export interface Scoring {
  words: Set<string>;
  numbers: Set<string>;
  figures: boolean;
}

export function scoringFor(query: string): Scoring {
  return {
    words: new Set(
      (query.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []).filter((w) => !STOP.has(w)),
    ),
    numbers: new Set((query.match(/\d[\d.,]*/g) ?? []).map(digits).filter(Boolean)),
    figures: FIGURE_ASK.test(query),
  };
}

/** How much a sentence bears on the question: shared words, the question's numbers heavily, any figure a little. */
export function scoreSentence(sentence: string, s: Scoring): number {
  const lower = sentence.toLowerCase();
  let score = 0;
  for (const w of s.words) if (lower.includes(w)) score += 1;
  const nums = sentence.match(/\d[\d.,]*/g) ?? [];
  for (const n of nums) if (s.numbers.has(digits(n))) score += 4;
  if (s.figures && nums.some((n) => digits(n).length >= 2)) score += 1;
  return score;
}

export function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .filter(Boolean);
}

/**
 * Up to `count` windows of whole sentences around the best-scoring ones, each
 * at most `max` characters, in page order and never overlapping. Empty when
 * nothing on the page shares a word with the question.
 */
export function passagesFor(text: string, query: string, count = 2, max = 600): string[] {
  const sentences = sentencesOf(text);
  const scoring = scoringFor(query);
  const ranked = sentences
    .map((s, i) => ({ i, score: scoreSentence(s, scoring) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const taken: [number, number][] = [];
  for (const { i } of ranked) {
    if (taken.length >= count) break;
    if (taken.some(([lo, hi]) => i >= lo - 1 && i <= hi + 1)) continue;
    let lo = i;
    let hi = i;
    let length = sentences[i].length;
    // Widen by one sentence after, then before, while it fits: context for the figure.
    const after = sentences[hi + 1];
    if (after && length + after.length + 1 <= max && !taken.some(([a]) => a === hi + 1)) {
      hi++;
      length += after.length + 1;
    }
    const before = sentences[lo - 1];
    if (before && length + before.length + 1 <= max && !taken.some(([, b]) => b === lo - 1)) {
      lo--;
      length += before.length + 1;
    }
    taken.push([lo, hi]);
  }
  return taken
    .sort((a, b) => a[0] - b[0])
    .map(([lo, hi]) =>
      sentences
        .slice(lo, hi + 1)
        .join(' ')
        .slice(0, max)
        .trim(),
    );
}

const MONTH =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const DATES = [
  /\b(20\d{2})-(\d{2})-(\d{2})\b/,
  new RegExp(`\\b${MONTH}\\.? (\\d{1,2}),? (20\\d{2})\\b`),
  new RegExp(`\\b(\\d{1,2}) ${MONTH}\\.? (20\\d{2})\\b`),
];

/**
 * A page's date when it prints one near the top (a dateline or a byline), as
 * it is printed. Undefined otherwise: an undated page is said to be undated,
 * never given today's date.
 */
export function printedDate(text: string): string | undefined {
  const head = text.slice(0, 800);
  for (const re of DATES) {
    const m = head.match(re);
    if (m) return m[0];
  }
  return undefined;
}

/** The site a url is on, for "Reading reuters.com…" and the source chip. */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
