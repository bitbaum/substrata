/**
 * Every figure an answer gives must be in something it read.
 *
 * Measured 2026-10-02: asked what a blockade of Taiwan would do, gpt-oss wrote
 * "≈70% of leading-edge capacity" and ">80% of wafer output", each attributed
 * to a record that held neither number. The prompt already forbade inventing
 * figures; a small model does it anyway. So the rule is checked, not trusted:
 * figures in the answer are compared with the text of everything looked up,
 * and an answer with figures from nowhere is sent back once to remove them
 * or mark them as outside the corpus.
 *
 * Deliberately lenient — a false alarm costs a model call, a miss costs the
 * reader's trust. Years, small counts, numbers the reader typed, and anything
 * in a sentence marked "Outside the corpus" are never questioned.
 */
import type { ChatMessage } from '@bitbaum/ai-kit';
import type { ModelTurn } from './turn';

/** A figure as written: digits with separators, an optional decimal, and its unit or %. */
const FIGURE =
  /(?<![\w./-])(\d{1,3}(?:[,   ]\d{3})+|\d+)(?:\.(\d+))?\s?(%|percent|kt|mt|t|kg|tonnes?|weeks?|months?|days?|gw|mw|bcm|bn|billion|million|usd|eur)?(?![\w])/gi;

/** "128,000" → "128000", "13.1" → "13.1": one spelling to compare. */
function canonical(intPart: string, frac?: string): string {
  const whole = intPart.replace(/[,   ]/g, '');
  return frac ? `${whole}.${frac}` : whole;
}

/** Every number in a text, in canonical form (and its whole part, so "13.1" also allows "13"). */
export function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(FIGURE)) {
    const c = canonical(m[1], m[2]);
    out.add(c);
    if (m[2]) out.add(canonical(m[1]));
  }
  return out;
}

/** Figures in the answer that appear in none of the evidence. */
export function unsupportedFigures(answer: string, evidence: string): string[] {
  const known = numbersIn(evidence);
  const out = new Set<string>();
  // Sentences the answer itself marks as background are its own claim, labelled.
  const claimed = answer
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => !/outside the corpus|außerhalb des korpus/i.test(sentence))
    .join('\n');
  for (const m of claimed.matchAll(FIGURE)) {
    const value = canonical(m[1], m[2]);
    const n = Number(value);
    const unit = (m[3] ?? '').toLowerCase();
    if (!Number.isFinite(n)) continue;
    // Years, list numbering, small counts ("three bullets", "2 suppliers"): not figures.
    if (!m[2] && !unit && (n < 20 || (n >= 1900 && n <= 2100))) continue;
    if (known.has(value)) continue;
    // A rounding of something in the evidence ("128 weeks" from "128.0") is fine.
    if (m[2] && known.has(canonical(m[1]))) continue;
    out.add(m[0].trim());
  }
  return [...out];
}

/**
 * Send an answer with figures from nowhere back once. Returns the revised
 * answer, or the original if the revision fails or still has none to offer.
 */
export async function reviseUnsupported(opts: {
  messages: ChatMessage[];
  answer: string;
  figures: string[];
  turn: ModelTurn;
  onText: (text: string) => void;
}): Promise<string | null> {
  const { messages, answer, figures, turn, onText } = opts;
  try {
    const result = await turn({
      messages: [
        ...messages,
        { role: 'assistant', content: answer },
        {
          role: 'user',
          content: `Check before I read this: these figures in your answer appear in none of the looked-up rows: ${figures.join(', ')}. Rewrite the whole answer without them — or, only if one is well-established general knowledge, keep it in a sentence that starts "Outside the corpus —". Keep every figure that IS in the rows, with its source. No tools.`,
        },
      ],
      onText,
    });
    return result.text.trim() ? result.text : null;
  } catch {
    return null;
  }
}
