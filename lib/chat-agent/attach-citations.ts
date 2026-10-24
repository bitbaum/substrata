/**
 * A citation the code can vouch for, attached by the code.
 *
 * Default deny (default-deny.ts) keeps a sentence only when something stands
 * behind it. Seen live on 2026-10-24, Russia: the model listed the operators,
 * places and capacities straight from the USGS rows but without a link, and
 * all of it was dropped. Those sentences were true — verifiably: every name
 * and every figure in them is in one row the lookups returned. So when that
 * holds, the row's own link is attached here, and the sentence is cited.
 *
 * The test is strict and checked, never inferred:
 * - the sentence names something (a capitalised word that is not its opening
 *   word) or gives a figure — a sentence of neither is not a fact about a row;
 * - every such name and every figure appears in ONE row of the lookups,
 *   verbatim (names) or as the same number (figures);
 * - it generalises nothing ("many", "most", "largest", "typically", "all",
 *   "only", "world's"…): a row says what it holds, not what is typical;
 * - the row (or the result it sits in) carries a link: a site page or a
 *   source URL.
 */
import { numbersIn } from './grounding';

interface Row {
  text: string;
  href: string;
  label: string;
}

// The source before the site page: a reader is sent to the publication that says it.
const LINKISH = ['source', 'url', 'link', 'href', 'page'] as const;

/** A link and its label from an object's own fields, if it carries one. */
function linkOf(o: Record<string, unknown>): { href: string; label: string } | null {
  for (const k of LINKISH) {
    const v = o[k];
    if (typeof v === 'string' && /^(https?:\/\/|\/)/.test(v))
      return {
        href: v,
        label:
          typeof o.label === 'string' ? o.label : typeof o.title === 'string' ? o.title : 'source',
      };
    if (v && typeof v === 'object') {
      const inner = linkOf(v as Record<string, unknown>);
      if (inner) return inner;
    }
  }
  return null;
}

/** Every object in the tool results as a row, with the nearest link it sits under. */
export function rowsIn(results: string[]): Row[] {
  const rows: Row[] = [];
  const walk = (v: unknown, inherited: { href: string; label: string } | null) => {
    if (Array.isArray(v)) return v.forEach((x) => walk(x, inherited));
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    const own = linkOf(o) ?? inherited;
    if (own) rows.push({ text: JSON.stringify(o), ...own });
    for (const x of Object.values(o)) if (x && typeof x === 'object') walk(x, own);
  };
  for (const r of results) {
    try {
      walk(JSON.parse(r.replace(/^\[[^\]]+\]\s*/, '')), null);
    } catch {
      // A result cut short for length: nothing to attach from it.
    }
  }
  // Smallest first: the row that says it, not the whole result around it.
  return rows.sort((a, b) => a.text.length - b.text.length);
}

const GENERALISES =
  /\b(many|most|typically|usually|generally|often|mostly|largest|biggest|leading|dominant|major|main|top|all|every|only|sole|world'?s|globally|always|never)\b/i;
const CITED = /\[[^\]]+\]\((https?:\/\/|\/)[^)]+\)|\[(W|F|R)\d+\]/;
const YEAR = /^(19|20)\d{2}$/;
/** Words that name the source, not the fact: the citation will name it. */
const SOURCE_WORDS = new Set(
  'USGS Minerals Mineral Yearbook Commodity Summaries Sourced Chapter Table Structure Industry'.split(
    ' ',
  ),
);

/** The names a sentence gives: capitalised words after its first, and quoted or bold phrases. */
function namesIn(sentence: string): string[] {
  const plain = sentence.replace(/[*_`]/g, '');
  const words = plain.match(/(?<=[\s(“"])[\p{Lu}][\p{L}\p{N}.'’-]+/gu) ?? [];
  return words
    .map((w) => w.replace(/[.'’-]+$/, ''))
    .filter((w) => w.length >= 3 && !SOURCE_WORDS.has(w));
}

/** The row that vouches for a sentence, if one does. */
export function rowFor(sentence: string, rows: Row[]): Row | null {
  if (CITED.test(sentence) || GENERALISES.test(sentence)) return null;
  const names = namesIn(sentence);
  const figures = [...numbersIn(sentence)].filter((n) => !YEAR.test(n));
  if (!names.length && !figures.length) return null;
  return (
    rows.find((r) => {
      if (!names.every((n) => r.text.includes(n))) return false;
      if (!figures.length) return true;
      const known = numbersIn(r.text);
      return figures.every((f) => known.has(f));
    }) ?? null
  );
}

const SPLIT =
  /(?<=(?<!\b(?:Inc|Corp|Ltd|Co|Plc|plc|JSC|LLP|B\.V|N\.V|S\.A|e\.g|i\.e|No|St))[.!?])\s+(?=[A-Z“"*[(])/;

/** The answer with the row's link attached to every sentence a single row vouches for. */
export function attachCitations(
  answer: string,
  results: string[],
  /** Sentences computed in code: already the code's, never re-cited. */
  computed: string[] = [],
): string {
  const rows = rowsIn(results);
  if (!rows.length) return answer;
  let fence = false;
  return answer
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) fence = !fence;
      if (fence || /^\s*```/.test(line) || /^\s*#/.test(line) || !line.trim()) return line;
      const lead = line.match(/^\s*(?:[-*•>]|\d+\.)?\s*/)?.[0] ?? '';
      const parts = line.slice(lead.length).split(SPLIT);
      return (
        lead +
        parts
          .map((p) => {
            if (computed.some((c) => p.includes(c) || c.includes(p))) return p;
            // A title (no full stop) states nothing to cite: it is left as it is.
            if (!/[.!?]\s*$/.test(p)) return p;
            const row = rowFor(p, rows);
            if (!row) return p;
            const link = ` ([${row.label.replace(/[[\]]/g, '')}](${row.href}))`;
            const end = p.match(/[.!?:]\s*$/)?.[0] ?? '';
            return `${p.slice(0, p.length - end.length).trimEnd()}${link}${end}`;
          })
          .join(' ')
      );
    })
    .join('\n');
}
