/**
 * When the reader already has the rows as a table (lib/chat/answer-table.ts),
 * the prose may not redo it.
 *
 * Seen live on 2026-10-24, the day the code table shipped: told "do not paste",
 * the model wrote its own markdown table above ours anyway — "24 000 metric
 * tons" on every one of sixteen rows (one capacity USGS prints ONCE for all of
 * them, so it read as 24,000 t per venture), "50 %" for the printed "50%" — and
 * then aggregates of its own that were wrong: "17 mining joint-ventures", "the
 * majority … include NAC Kazatomprom JSC as a 50–100 % stakeholder" (its stake
 * in SMCC is 30%). Asking harder did not work, so this is checked:
 *
 * - `stripModelTables` removes any markdown table from the prose, and every
 *   line that repeats a figure printed once for several rows;
 * - `claimProblems` finds sentences that state a count or a share aggregate
 *   ("up to", "at least", "largest", "majority", "all", "17 ventures") that is
 *   not one of the computed `summary` sentences (lib/chat-tools/facility-summary.ts).
 *   The answer is sent back once with the summary to copy; failing that, the
 *   sentences go and the summary takes their place.
 */
import type { ChatMessage } from '@bitbaum/ai-kit';
import { REVISION_RULE, type ModelTurn } from './turn';

export interface TableFacts {
  /** The computed sentences the model was told to copy. */
  summary: string[];
  /** Cells printed once for several rows ("24000 metric tons"). */
  printedOnce: string[];
  /** The table's rows as the tool read them: operator and owners, verbatim. */
  rows: { operator: string | null; owner: string | null; capacity?: string | null }[];
  /** The source cells whole (the `companies` cell of each facility row). */
  cells: string[];
}

/** What the facility lookups said about the table the reader sees, if any. */
export function tableFactsIn(results: string[]): TableFacts | null {
  const facts: TableFacts = { summary: [], printedOnce: [], rows: [], cells: [] };
  let shown = false;
  for (const r of results) {
    if (!/^\[producers_in\]/.test(r)) continue;
    try {
      const v = JSON.parse(r.replace(/^\[[^\]]+\]\s*/, '')) as {
        table_shown?: string;
        summary?: string[];
        printed_once?: string[];
        facilities?: {
          companies?: string;
          capacity?: string | null;
          read_as?: { operator: string | null; owner: string | null }[];
        }[];
      };
      if (!v.table_shown) continue;
      shown = true;
      facts.summary.push(...(v.summary ?? []));
      facts.printedOnce.push(...(v.printed_once ?? []));
      for (const f of v.facilities ?? []) {
        if (f.companies) facts.cells.push(f.companies);
        facts.rows.push(...(f.read_as ?? []).map((r) => ({ ...r, capacity: f.capacity ?? null })));
      }
    } catch {
      // A result cut short for length carries no facts.
    }
  }
  return shown ? facts : null;
}

const digits = (s: string) => s.replace(/[\s  ,.']/g, '');

/** A GFM table: a pipe row, a delimiter row, then pipe rows. */
const DELIMITER = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const PIPE_ROW = /^\s*\|.*\|\s*$|^[^|\n]*\|[^|\n]*\|/;

/** The prose without a table of its own, or lines repeating a once-printed figure. */
export function stripModelTables(answer: string, printedOnce: string[]): string {
  const lines = answer.split('\n');
  const drop = new Set<number>();
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!PIPE_ROW.test(lines[i]) || !DELIMITER.test(lines[i + 1])) continue;
    let j = i;
    while (j < lines.length && (PIPE_ROW.test(lines[j]) || DELIMITER.test(lines[j]))) drop.add(j++);
  }
  // A figure printed once for many rows, given on two or more lines, was given per row.
  for (const once of printedOnce.map(digits).filter((d) => /\d{3,}/.test(d))) {
    const hits = lines.map((l, i) => (digits(l).includes(once) ? i : -1)).filter((i) => i >= 0);
    if (hits.length > 1) hits.forEach((i) => drop.add(i));
  }
  if (!drop.size) return answer;
  return lines
    .filter((_, i) => !drop.has(i))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const CLAIM =
  /\b(up to|at least|at most|no less than|more than|less than|largest|biggest|smallest|majority|minority|most of|all of|all the|every|each of|ranges?|ranging|between)\b/i;
const NUMBER_WORD =
  'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty';
const COUNT = new RegExp(
  `\\b(\\d+|${NUMBER_WORD})\\s+(?:[\\w-]+\\s+){0,2}?(operators?|ventures?|joint[- ]ventures?|jvs?|companies|firms|facilities|plants|mines|rows|owners|shareholders|producers)\\b`,
  'i',
);

function sentences(answer: string): string[] {
  return (
    answer
      .replace(/```[\s\S]*?```/g, ' ')
      // A sentence ends at . ! ? before a capital — not after "Inc." or "Corp." inside a name.
      .split(
        /(?<=(?<!\b(?:Inc|Corp|Ltd|Co|Plc|plc|JSC|LLP|B\.V|N\.V|S\.A|e\.g|i\.e|No|St))[.!?])\s+(?=[A-Z“"*])|\n+/,
      )
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

const plain = (s: string) =>
  s
    .replace(/[*_`>#]/g, '')
    .replace(/^\s*[-•\d.]+\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Sentences stating a count, or a share aggregate with a percentage, that is
 * not a computed summary sentence copied whole.
 */
export function claimProblems(answer: string, summary: string[]): string[] {
  const known = summary.map((s) => plain(s).replace(/\.$/, ''));
  return sentences(answer).filter((raw) => {
    const s = plain(raw);
    const aggregate = (CLAIM.test(s) && /\d\s*%|percent/i.test(s)) || COUNT.test(s);
    if (!aggregate) return false;
    return !known.some((k) => s.includes(k) || (s.length > 20 && k.includes(s.replace(/\.$/, ''))));
  });
}

/** Fallback: the claims go, and the computed summary stands where the first one was. */
export function replaceClaims(answer: string, claims: string[], summary: string[]): string {
  let out = answer;
  let placed = false;
  for (const c of claims) {
    out = out.replace(c, placed ? '' : summary.join(' '));
    placed = true;
  }
  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function claimInstruction(claims: string[], summary: string[]): string {
  return `Check before I read this: these sentences state a count, a range or a "largest / at least / up to / majority" that was not computed from the rows: ${claims.map((c) => `"${c}"`).join('; ')}. Rewrite the whole answer without them. Use these sentences instead, copied exactly — they are counted from the rows: ${summary.map((s) => `"${s}"`).join(' ')} Do not write a table or list the rows; the reader sees them in the table below. Quote any share exactly as printed ("50%", not "50 %"). No tools. ${REVISION_RULE}`;
}

/** Send aggregates of the model's own back once; null when the revision failed. */
export async function reviseClaims(opts: {
  messages: ChatMessage[];
  answer: string;
  claims: string[];
  summary: string[];
  turn: ModelTurn;
  onText: (text: string) => void;
}): Promise<string | null> {
  try {
    const result = await opts.turn({
      messages: [
        ...opts.messages,
        { role: 'assistant', content: opts.answer },
        { role: 'user', content: claimInstruction(opts.claims, opts.summary) },
      ],
      onText: opts.onText,
    });
    return result.text.trim() && !result.truncated ? result.text : null;
  } catch {
    return null;
  }
}
