/**
 * Claim check, step one: READ what the reader brought — a screenshot, or a
 * long pasted post — before anything is answered.
 *
 * The owner, 2026-10-27, with a screenshot of a post about AI "neoclouds"
 * (SpaceX's $40B of GPU debt, CoreWeave down ~38% this month, Gartner's $4.9T
 * revenue gap): "what's your take on it??". A take on a post is only worth
 * having once the post's checkable claims are known and checked. So one model
 * call — a model that can see, for a picture (ai-kit routes a turn carrying
 * an image only to links that read one) — returns the visible text and the
 * claims in it as JSON, and code decides whether that is a reading:
 *
 * - at most MAX_CLAIMS claims, each a short sentence, deduplicated;
 * - a claim's numbers must be printed in the text the model says it read —
 *   a vision model that invents "down 38%" from a blurry chart is caught here,
 *   because the same model also has to have read "38%" somewhere;
 * - the text itself is bounded and kept only as the READER'S MATERIAL: it is
 *   quoted back as "your screenshot says", never cited as a source.
 *
 * Pure except `readClaims`, which makes the one call.
 */
import type { ChatMessage } from '@bitbaum/ai-kit';
import type { ModelTurn } from './turn';

export const MAX_CLAIMS = 6;
export const MAX_READ_TEXT = 3000;

export type ClaimKind = 'market' | 'quote' | 'figure' | 'event';

export interface Claim {
  /** C1, C2, … — what the answer's claim lines name. */
  id: string;
  /** The claim in one sentence, as the material states it. */
  text: string;
  /** Who said or reported it, when the material names someone. */
  who?: string;
  kind: ClaimKind;
}

export interface Reading {
  /** The visible text, as read. The reader's material, never a source. */
  text: string;
  claims: Claim[];
}

export const READ_INSTRUCTION = [
  'You read material a reader attached to a question: screenshots of posts, articles or charts, or a pasted post.',
  'Return ONLY one JSON object, no prose, no code fence:',
  '{"text":"<every visible word of the material, in reading order, verbatim; skip buttons, menus and ads>","claims":[{"claim":"<one checkable statement of fact from the material, one sentence>","who":"<the person or organisation it is attributed to, if the material names one>"}]}',
  `At most ${MAX_CLAIMS} claims: the ones a careful reader would check first — named companies, people and organisations, numbers, percentages, money, dates, who said what. Keep each number exactly as printed. Opinions, predictions without a source and rhetorical questions are not claims.`,
  'Never add anything that is not in the material. If you cannot read it, return {"text":"","claims":[]}.',
].join('\n');

/** The numbers in a string, as printed tokens without separators ("4.9", "40", "38"). */
export function numbersIn(s: string): string[] {
  return (s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, '').replace(/,/g, ''));
}

const kindOf = (claim: string, who?: string): ClaimKind =>
  /\b(shares?|stocks?|market (cap|value)|valuation|price|traded|trading|ipo)\b/i.test(claim)
    ? 'market'
    : who || /\b(said|says|warn(s|ed)?|told|wrote|according to|claims?)\b/i.test(claim)
      ? 'quote'
      : /\d/.test(claim)
        ? 'figure'
        : 'event';

const clean = (s: unknown, max: number): string =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** The first JSON object in a model's reply (a fence or a sentence around it is tolerated). */
function jsonIn(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * A model's reply → a reading, or null when it is not one. Pure.
 * `material` is text the reader typed or pasted: its numbers count as read too.
 */
export function parseReading(raw: string, material = ''): Reading | null {
  const value = jsonIn(raw);
  if (!value || typeof value !== 'object') return null;
  const v = value as { text?: unknown; claims?: unknown };
  const text = clean(v.text, MAX_READ_TEXT);
  if (!Array.isArray(v.claims)) return text ? { text, claims: [] } : null;
  const seen = new Set<string>();
  const printed = new Set(numbersIn(`${text} ${material}`));
  const claims: Claim[] = [];
  for (const item of v.claims) {
    if (claims.length >= MAX_CLAIMS) break;
    const c = (item ?? {}) as { claim?: unknown; who?: unknown };
    const claim = clean(c.claim, 240);
    if (claim.length < 8) continue;
    const key = claim.toLowerCase();
    if (seen.has(key)) continue;
    // A number the reading never printed is the model's, not the material's.
    if (numbersIn(claim).some((n) => !printed.has(n))) continue;
    seen.add(key);
    const who = clean(c.who, 80) || undefined;
    claims.push({
      id: `C${claims.length + 1}`,
      text: claim,
      ...(who ? { who } : {}),
      kind: kindOf(claim, who),
    });
  }
  if (!text && !claims.length) return null;
  return { text, claims };
}

/**
 * A question with a pasted post in it is material to check, like a screenshot:
 * long, and carrying figures. A long question with no figures is a question.
 */
export const LONG_PASTE = 280;

/** Whether this turn brings material to read: pictures, attached text, or a pasted post. */
export function bringsMaterial(input: { question: string; images?: string[]; attached?: string }) {
  if (input.images?.length || input.attached?.trim()) return true;
  return (
    input.question.length >= LONG_PASTE &&
    numbersIn(input.question).filter((n) => n.length > 1).length >= 2
  );
}

/** The read call: one model turn, nothing streamed to the reader (it is JSON for code). */
export async function readClaims(opts: {
  question: string;
  images: string[];
  attached: string;
  turn: ModelTurn;
}): Promise<Reading | null> {
  const words = [
    `The reader's question: ${opts.question.slice(0, 600)}`,
    opts.attached ? `Attached text:\n${opts.attached}` : '',
    bringsMaterial({ question: opts.question })
      ? `Pasted with the question:\n${opts.question}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const messages: ChatMessage[] = [
    { role: 'system', content: READ_INSTRUCTION },
    {
      role: 'user',
      content: opts.images.length
        ? [
            { type: 'text', text: words },
            ...opts.images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
          ]
        : words,
    },
  ];
  const result = await opts.turn({ messages, onText: () => {} });
  return parseReading(result.text, `${opts.question}\n${opts.attached}`);
}
