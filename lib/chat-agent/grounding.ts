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
 * reader's trust. Years, small counts and numbers the reader typed are never
 * questioned. Labelled background is (since 2026-10-24, open-web-ask.md):
 * figures come from a corpus row or a dated web passage, never from memory.
 */
import type { ChatMessage } from '@bitbaum/ai-kit';
import { REVISION_RULE, type ModelTurn } from './turn';

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
  // A number fused into a field name — `net_pressure_90d` — is still a number
  // the reader was given: the model writes it as "90-day pressure". Missed,
  // it sent a correct answer back for a rewrite, a full extra call (2026-10-02).
  for (const m of text.matchAll(/(?<=[A-Za-z_])(\d+)(?=[A-Za-z_])|(?<=_)(\d+)(?![\d.,])/g))
    out.add(m[1] ?? m[2]);
  return out;
}

/**
 * The answer without the sentences that carry unsupported figures — the
 * fallback when a revision fails, so a figure from nowhere is never shown.
 */
export function withoutSentencesHolding(answer: string, figures: string[]): string {
  return answer
    .split('\n')
    .flatMap((line) => {
      const kept = line
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => !figures.some((f) => sentence.includes(f)))
        .join(' ');
      // A line emptied by the removal goes; a blank line the answer had stays.
      return line.trim() && !kept.trim() ? [] : [kept];
    })
    .join('\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Units. Asked who produces gallium (2026-10-23), the answer said Russia made
// "6 kt"; the row said "6,000 kg (estimated)" — 6 t, a thousandfold less. The
// "6" was in the evidence, so the number check above let it through. A figure
// is therefore also checked against the unit of the row it came from.
// ---------------------------------------------------------------------------

/** A quantity with a unit the tables print: mass, volume, energy, carats. */
const QUANTITY =
  /(?<![\w./-])(\d{1,3}(?:[,\u00a0\u202f ]\d{3})+|\d+)(?:\.(\d+))?\s?(thousand (?:metric )?(?:tonnes|tons|t)|million (?:metric )?(?:tonnes|tons|t)|kilograms?|kg|metric tons?|tonnes?|tons?|kt|mt|t|mct|bcm|mcm|twh)(?![\w])/gi;

/** One spelling per unit, and which family it belongs to (a kg is never compared with a bcm). */
function unitOf(raw: string): { unit: string; family: string } {
  const u = raw.toLowerCase().replace(/\s+/g, ' ');
  if (/^kilograms?$|^kg$/.test(u)) return { unit: 'kg', family: 'mass' };
  if (/^(metric )?tons?$|^tonnes?$|^t$/.test(u)) return { unit: 't', family: 'mass' };
  if (/^thousand /.test(u) || u === 'kt') return { unit: 'kt', family: 'mass' };
  if (/^million /.test(u) || u === 'mt') return { unit: 'Mt', family: 'mass' };
  return { unit: u, family: u };
}

interface Quantity {
  text: string;
  value: number;
  unit: string;
  family: string;
}

function quantitiesIn(text: string): Quantity[] {
  return [...text.matchAll(QUANTITY)].map((m) => ({
    text: m[0].trim(),
    value: Number(canonical(m[1], m[2])),
    ...unitOf(m[3]),
  }));
}

/** 6 and 6,000 and 6,000,000: the same digits a thousandfold apart, as a re-unit produces. */
function sameDigits(a: number, b: number): boolean {
  if (!(a > 0 && b > 0)) return false;
  const k = Math.log10(a / b) / 3;
  return Math.abs(k - Math.round(k)) < 1e-6;
}

/**
 * Answer quantities written in a different unit from the row they came from:
 * "6 kt" where the row says "6,000 kg". A quantity that appears as written in
 * the evidence is fine; one whose digits match a row's in another unit of the
 * same family has been converted or abbreviated, and the prompt says neither.
 */
export function unitMismatches(answer: string, evidence: string): string[] {
  const rows = quantitiesIn(evidence);
  const out = new Set<string>();
  for (const q of quantitiesIn(answer)) {
    const same = rows.filter((r) => r.family === q.family);
    if (same.some((r) => r.unit === q.unit && r.value === q.value)) continue;
    if (same.some((r) => r.unit !== q.unit && sameDigits(q.value, r.value))) out.add(q.text);
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Printed form. Seen live 2026-10-24: the yearbook prints "50%" and "24000";
// the answer wrote "50 %" and "24 000". The digits match, so the checks above
// pass, but a quote that is not the printed token is not a quote.
// ---------------------------------------------------------------------------

const SPACED_PERCENT = /(?<![\w.])(\d+(?:\.\d+)?)(?:[ \u00a0\u202f]+%|\s?(?:percent|per cent)\b)/gi;
const GROUPED = /(?<![\w.,])\d{1,3}(?:[ \u00a0\u202f,]\d{3})+(?![\d])/g;

/** Answer tokens that re-format a figure the rows print another way ("50 %" for "50%"). */
export function printedFormMismatches(answer: string, evidence: string): string[] {
  const out = new Set<string>();
  for (const m of answer.matchAll(SPACED_PERCENT))
    if (evidence.includes(`${m[1]}%`)) out.add(m[0].trim());
  for (const m of answer.matchAll(GROUPED)) {
    const token = m[0];
    if (evidence.includes(token)) continue;
    const bare = token.replace(/[ \u00a0\u202f,]/g, '');
    const grouped = new RegExp(
      `(?<![\\d.])${bare.replace(/(\d)(?=(\d{3})+$)/g, '$1[ ,\\u00a0\\u202f]')}(?!\\d)`,
    );
    if (new RegExp(`(?<![\\d.,])${bare}(?![\\d])`).test(evidence) && !grouped.test(evidence))
      out.add(token);
  }
  return [...out];
}

/**
 * The text whose figures are checked: all of it. Background marked "Outside
 * the corpus" used to be exempt; seen in the owner's review on 2026-10-24, a
 * figure is exactly what memory gets wrong, so none is exempt any more.
 */
function claimedText(answer: string): string {
  return answer;
}

/**
 * Figures in the answer that appear in none of the evidence, and quantities
 * written in another unit than the row's (unitMismatches): both are sent back.
 */
export function unsupportedFigures(answer: string, evidence: string): string[] {
  const known = numbersIn(evidence);
  const claimed = claimedText(answer);
  const out = new Set<string>([
    ...unitMismatches(claimed, evidence),
    ...printedFormMismatches(claimed, evidence),
  ]);
  for (const m of claimed.matchAll(FIGURE)) {
    const value = canonical(m[1], m[2]);
    const n = Number(value);
    const unit = (m[3] ?? '').toLowerCase();
    if (!Number.isFinite(n)) continue;
    // Years, list numbering, small counts ("three bullets", "2 suppliers"): not figures.
    if (!m[2] && !unit && (n < 20 || (n >= 1900 && n <= 2100))) continue;
    if (known.has(value) || [...out].some((f) => f.startsWith(m[0].trim()))) continue;
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
          content: `Check before I read this: these figures in your answer appear in none of the looked-up rows, or are written in a unit or a form the row does not use: ${figures.join(', ')}. Rewrite the whole answer: a figure from a row is copied exactly as the row prints it ("50%", never "50 %"; "24000", never "24 000"), a quantity exactly as the source states it — same number, same unit, never converted or abbreviated; a figure from a web passage is copied exactly as that passage [W#] prints it and cited to it; a figure from no row and no passage is removed, and the sentence says what the sources did show instead. Keep every figure that IS in the rows or passages, with its source. No tools. ${REVISION_RULE}`,
        },
      ],
      onText,
    });
    // A revision cut off at the length limit is worse than the original.
    return result.text.trim() && !result.truncated ? result.text : null;
  } catch {
    return null;
  }
}
