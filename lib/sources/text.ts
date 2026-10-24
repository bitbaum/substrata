/**
 * Cutting a quote out of fetched text. Every function here returns a slice of
 * the text it was given — never a rewrite — so the quote add.ts later looks
 * for is, by construction, on the page. The schema bounds a quote at 20–400
 * characters; `quoteAround` keeps to them.
 */
import { squash } from '@/lib/event-rules';

export const QUOTE_MIN = 20;
export const QUOTE_MAX = 400;

/** Words that end in a full stop without ending a sentence. */
const ABBREVIATIONS =
  /(?:\b(?:Inc|Corp|Co|Ltd|Pte|Pty|No|Nos|approx|Mr|Ms|Dr|St|Jr|Sr|vs|etc|e\.g|i\.e|U\.S|U\.K|S\.A|N\.V)|\b[A-Z])\.$/;

function sentenceStart(text: string, at: number): number {
  for (let i = at - 1; i > 0; i--) {
    if (
      /[.!?]/.test(text[i - 1]) &&
      /\s/.test(text[i]) &&
      !ABBREVIATIONS.test(text.slice(Math.max(0, i - 8), i))
    )
      return i + 1;
  }
  return 0;
}

function sentenceEnd(text: string, at: number): number {
  for (let i = at; i < text.length; i++) {
    if (/[.!?]/.test(text[i]) && (i + 1 === text.length || /\s/.test(text[i + 1]))) {
      if (!ABBREVIATIONS.test(text.slice(Math.max(0, i - 7), i + 1))) return i + 1;
    }
  }
  return text.length;
}

/**
 * The sentence holding `text[start, end)`, from a whitespace-squashed copy of
 * `text`. When the sentence is longer than QUOTE_MAX, a window of whole words
 * around the match instead. Null when the match alone is too long or short.
 */
export function quoteAround(text: string, start: number, end: number): string | null {
  const flat = squash(text.slice(0, start)).length;
  const page = squash(text);
  // Re-find the match in the squashed text near its old offset.
  const match = squash(text.slice(start, end));
  const at = page.indexOf(match, Math.max(0, flat - 2));
  if (at < 0 || match.length > QUOTE_MAX) return null;
  let s = sentenceStart(page, at);
  let e = sentenceEnd(page, at + match.length);
  if (e - s > QUOTE_MAX) {
    const room = Math.floor((QUOTE_MAX - match.length) / 2);
    s = Math.max(s, at - room);
    e = Math.min(e, at + match.length + room);
    while (s > 0 && s < at && /\S/.test(page[s - 1])) s++;
    while (e < page.length && e > at + match.length && /\S/.test(page[e])) e--;
  }
  const quote = page.slice(s, e).trim();
  return quote.length >= QUOTE_MIN && quote.length <= QUOTE_MAX ? quote : null;
}

/**
 * A span of raw JSON from the first occurrence of `from` (searching after
 * `after`) through the end of the value that follows `to`. Null when either
 * marker is missing or the span is outside the quote bounds (`max`, by default
 * a hand-written quote's; a whole record may pass the relation schema's
 * longer RECORD_QUOTE_MAX).
 */
export function jsonSpan(
  raw: string,
  from: string,
  to: string,
  after = 0,
  max = QUOTE_MAX,
): string | null {
  const s = raw.indexOf(from, after);
  if (s < 0) return null;
  const t = raw.indexOf(to, s);
  if (t < 0) return null;
  let e = t + to.length;
  while (e < raw.length && !/[,}\]]/.test(raw[e])) e++;
  const span = raw.slice(s, e);
  return span.length >= QUOTE_MIN && span.length <= max ? span : null;
}
