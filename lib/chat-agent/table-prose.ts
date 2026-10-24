/**
 * When a code table is shown, the answer's FACTS come from code: the computed
 * summary (lib/chat-tools/facility-summary.ts) and the table itself. The
 * model's prose may introduce them, name the missing links and what would
 * settle them, and present web leads as leads. Nothing else of the rows.
 *
 * Seen live on 2026-10-24, after #225 stripped the model's own table: one
 * model listed all sixteen ventures as bullets above the table instead, one
 * pasted the whole USGS cell as a blockquote, and one quoted an owners cell
 * with ", and" turned into ";" — a change no figure check can see. So, after
 * table-guard.ts:
 *
 * - `stripRowRuns` removes any run of lines that between them repeat four or
 *   more of the table's rows (operator names or owner cells), and any single
 *   line that does — a list, a blockquote, a paragraph;
 * - `fixQuotes` puts the printed cell back over any quoted span that is
 *   mostly one cell but not that cell exactly;
 * - `openWithSummary` makes the computed summary the answer's first
 *   paragraph, whether or not the model wrote it.
 */
import type { TableFacts } from './table-guard';
import { stripModelTables } from './table-guard';

const flat = (s: string) => s.replace(/\s+/g, ' ');

/** Lower-case words and numbers: what two spellings of one cell share. */
const tokens = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+(?:\.\d+)?%?/gu) ?? [];

/** Which rows of the table a line repeats: an operator named, or an owner cell given. */
function rowsIn(line: string, facts: TableFacts): Set<number> {
  const hit = new Set<number>();
  // Models write names with no-break and narrow no-break spaces ("Akbastau\u202fJV").
  const low = flat(line).toLowerCase();
  facts.rows.forEach((r, i) => {
    if (r.operator && r.operator.length >= 5 && low.includes(r.operator.toLowerCase())) hit.add(i);
    else if (r.owner && low.includes(r.owner.toLowerCase())) hit.add(i);
    else if (r.owner && tokens(r.owner).length >= 5 && similar(line, r.owner) >= 0.8) hit.add(i);
  });
  return hit;
}

/** The share of the cell's words a text carries (0–1). */
function similar(text: string, cell: string): number {
  const have = new Set(tokens(text));
  const want = tokens(cell);
  return want.length ? want.filter((w) => have.has(w)).length / want.length : 0;
}

const FILLER_LINE = /^\s*([-*•>]|\d+\.)?\s*$/;
const RUN_MIN = 4;

/** The prose without runs of lines that redo the table's rows. */
export function stripRowRuns(answer: string, facts: TableFacts): string {
  if (!facts.rows.length) return answer;
  const lines = answer.split('\n');
  const drop = new Set<number>();
  const close = (start: number, end: number, rows: Set<number>) => {
    if (rows.size < RUN_MIN) return;
    for (let i = start; i <= end; i++) drop.add(i);
    // What introduced it goes with it: a sentence ending "…verbatim as:", or a
    // heading over nothing now ("Uranium mining companies … and their owners"),
    // and the stray bullets between.
    for (let i = start - 1; i >= 0; i--) {
      if (FILLER_LINE.test(lines[i])) {
        drop.add(i);
        continue;
      }
      const l = lines[i].trim();
      if (/:$/.test(l) || /^#/.test(l) || (l.length < 90 && !/[.!?)”"]$/.test(l))) drop.add(i);
      break;
    }
  };
  // A line that is a whole source cell redoes every row in it: it goes on its own.
  lines.forEach((l, i) => {
    if (facts.cells.some((c) => tokens(c).length >= 5 && similar(l, c) >= 0.8))
      close(i, i, new Set(facts.rows.map((_, k) => k)));
  });
  let start = -1;
  let end = -1;
  let rows = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const hit = rowsIn(lines[i], facts);
    if (hit.size) {
      if (start < 0) start = i;
      end = i;
      hit.forEach((h) => rows.add(h));
    } else if (!FILLER_LINE.test(lines[i]) && start >= 0) {
      close(start, end, rows);
      start = -1;
      rows = new Set();
    }
  }
  if (start >= 0) close(start, end, rows);
  if (!drop.size) return answer;
  return lines
    .filter((_, i) => !drop.has(i))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Every text a quote may be a quote of: owner cells, operator entries, whole cells. */
function quotables(facts: TableFacts): string[] {
  return [
    ...facts.cells,
    ...facts.rows.flatMap((r) => [
      ...(r.owner ? [r.owner] : []),
      ...(r.operator && r.owner ? [`${r.operator} (${r.owner})`] : []),
    ]),
  ];
}

const QUOTED = /[“"]([^”"\n]{12,})[”"]/g;

/** Quoted spans that are mostly one printed cell but not that cell: put the cell back. */
export function fixQuotes(answer: string, facts: TableFacts): string {
  const cells = quotables(facts);
  if (!cells.length) return answer;
  return answer.replace(QUOTED, (whole, span: string) => {
    if (cells.some((c) => flat(c).includes(flat(span))))
      return flat(span) === span ? whole : whole.replace(span, flat(span));
    const n = tokens(span).length;
    let best: { cell: string; score: number } | null = null;
    for (const cell of cells) {
      const m = tokens(cell).length;
      if (m < n * 0.7 || m > n * 1.4) continue;
      const score = Math.min(similar(span, cell), similar(cell, span));
      if (!best || score > best.score) best = { cell, score };
    }
    return best && best.score >= 0.8 ? whole.replace(span, best.cell) : whole;
  });
}

const plain = (s: string) => s.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();

/** The computed summary as the answer's first paragraph (after a leading heading). */
export function openWithSummary(answer: string, summary: string[]): string {
  if (!summary.length) return answer;
  let body = answer;
  for (const s of summary) {
    const at = body.indexOf(s);
    if (at >= 0) body = body.slice(0, at) + body.slice(at + s.length);
  }
  body = body
    .split('\n')
    .filter((l, i, all) => plain(l) || plain(all[i - 1] ?? '') || i === 0)
    .join('\n')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const lead = summary.join(' ');
  const heading = body.match(/^(#{1,6} .+)\n+/);
  return heading
    ? `${heading[1]}\n\n${lead}\n\n${body.slice(heading[0].length)}`.trim()
    : `${lead}\n\n${body}`.trim();
}

/** Everything the prose may not do when a code table is shown, undone in code. */
export function tableProse(answer: string, facts: TableFacts): string {
  return fixQuotes(stripRowRuns(stripModelTables(answer, facts.printedOnce), facts), facts);
}
