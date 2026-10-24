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
    // A figure printed once for many rows may be stated once (table-guard handles its repeats).
    else if (!facts.printedOnce.includes(r.capacity ?? '') && capacityIn(line, r.capacity))
      hit.add(i);
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

/** A row's capacity given in the line, however its digits are grouped ("44,000" or "44 000"). */
function capacityIn(line: string, capacity: string | null | undefined): boolean {
  const n = capacity?.match(/^[\d,.\s]+/)?.[0].replace(/[,\s]/g, '');
  if (!n || n.replace(/\D/g, '').length < 3) return false;
  return (line.match(/\d[\d,.\s\u00a0\u202f]*\d/g) ?? []).some(
    (m) => m.replace(/[,\s\u00a0\u202f]/g, '') === n,
  );
}

const FILLER_LINE = /^\s*([-*•>]|\d+\.)?\s*$/;
/** Rows a run must repeat to go: four, or all but one of a smaller table. */
const runMin = (rows: number) => Math.min(4, Math.max(2, rows - 1));

/** The prose without runs of lines that redo the table's rows. */
export function stripRowRuns(answer: string, facts: TableFacts): string {
  if (!facts.rows.length) return answer;
  const lines = answer.split('\n');
  const drop = new Set<number>();
  const close = (start: number, end: number, rows: Set<number>) => {
    if (rows.size < runMin(facts.rows.length)) return;
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

/** The computed summary as the answer's first paragraph (after a leading heading). */
export function openWithSummary(answer: string, summary: string[]): string {
  if (!summary.length) return answer;
  // Where the model copied the summary itself — "The summary sentences are:" then the
  // sentences in quotes (seen live, Chile, 2026-10-24) — the copy, its quote marks
  // and the line that introduced it all go: the summary is said once, first.
  const lines = answer.split('\n');
  const drop = new Set<number>();
  lines.forEach((line, i) => {
    let rest = line;
    for (const s of summary) rest = rest.split(s).join('');
    if (rest === line) return;
    lines[i] = rest;
    if (/^[\s“”"'‘’«»\-–—*•>]*$/.test(rest)) {
      drop.add(i);
      for (let j = i - 1; j >= 0; j--) {
        if (/^[\s“”"'‘’«»\-–—*•>]*$/.test(lines[j])) {
          drop.add(j);
          continue;
        }
        if (/:\s*$/.test(lines[j])) drop.add(j);
        break;
      }
    }
  });
  // A line of nothing but quote marks or dashes is what is left of a copy made
  // earlier (the recorded Chile answer); it goes, with the "…are:" it hangs from.
  const kept = lines.filter((_, i) => !drop.has(i));
  for (let i = 0; i < kept.length; i++) {
    if (!/^[\s“”"'‘’«»\-–—*•]+$/.test(kept[i]) || !kept[i].trim()) continue;
    kept[i] = '';
    for (let j = i - 1; j >= 0; j--) {
      if (!kept[j].trim()) continue;
      if (/:\s*$/.test(kept[j]))
        kept[j] = kept[j].replace(/(^|(?<=[.!?])\s+)[^.!?]*:\s*$/, '').trimEnd();
      break;
    }
  }
  const body = kept
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
  // Models write no-break and narrow no-break spaces inside names and copied
  // sentences ("Sociedad\u202fQuímica"); every check here compares exact text.
  const spaced = answer.replace(/[\u00a0\u202f\u2009]/g, ' ');
  return fixQuotes(stripRowRuns(stripModelTables(spaced, facts.printedOnce), facts), facts);
}
