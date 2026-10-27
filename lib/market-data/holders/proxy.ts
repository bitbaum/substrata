/**
 * The beneficial-ownership table of a proxy statement (DEF 14A), read from the
 * filing's text: every row the filer printed WITH A PERCENTAGE — the holders
 * of more than 5%, and any director or officer at 1% or more — plus the
 * "directors and executive officers as a group" row.
 *
 * Rows printed "*" (under 1%) are skipped: the filing gives them no share.
 * The table is the filer's own: it states the record date ("as of March 23,
 * 2026") and the share count the percentages are of; both are kept, because
 * a percentage without its date is the "Vanguard 8.9%" problem.
 *
 * Read by pattern, not by a model. Proxy layouts differ by filer (columns for
 * options vested within 60 days, addresses under names, footnote markers);
 * the rule that holds across all of them is: a row is a name, some share
 * counts, then a percentage with a % sign. Tested on recorded excerpts of
 * NVIDIA's, AMD's, Amazon's, Tesla's and GE Vernova's 2026 proxies.
 */

export interface ProxyRow {
  name: string;
  shares: number | null;
  percent: number;
  /** The "directors and executive officers as a group" row. */
  group: boolean;
  /** The date the table this row stands in is as of, YYYY-MM-DD. */
  asOf: string | null;
  /** The printed row, squashed, for a quote. */
  quote: string;
}

export interface ProxyTable {
  /** The record date the table is as of, YYYY-MM-DD; null if the text does not say. */
  asOf: string | null;
  sharesOutstanding: number | null;
  rows: ProxyRow[];
  /** Percentages are of one class among several (Class A / Class B): not summed to 100. */
  multiClass: boolean;
}

const HEADING =
  /(?:security|stock) ownership of certain|beneficial owners? of more than (?:5|five)|more than (?:5|five) ?(?:%|percent) of (?:our|the)|5% or (?:more|greater)|principal (?:stock|share)holders|5% (?:stock|share)holders|5% beneficial owners|beneficial ownership of (?:shares|securities)/gi;
/** A table row's tail: a share count (with footnote marks and further columns), then a percentage. */
const ROW_TAIL =
  /\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:\s*\(\d+\)|[¹²³⁴⁵⁶⁷⁸⁹⁰]+)?(?:\s+(?:—|-|\d[\d,.]*)(?:\s*\(\d+\)|[¹²³⁴⁵⁶⁷⁸⁹⁰]+)?)*\s+\d{1,2}(?:\.\d{1,2})?\s?%/g;
/** Words a table puts where a name would be, never a holder. */
const NOT_A_NAME = /^(?:Fiscal|Schedule|Burn|Total|Year|Page|Table|Plan|Equity)\b/;
const END =
  /\*\s*(?:represents |denotes )?less than|less than (?:1|one) ?(?:%|percent)|\(1\) (?!Percent)[A-Z][a-z]/i;
const STOP = new Set(
  'Percent Percentage Class Owned Ownership Beneficially Beneficial Owner Owners Stockholders Shareholders Holders Directors Officers NEOs Name Amount Nature Shares Number Total Days Within Issuable Named Address Principal Greater Common Stock Executive Outstanding Sole Shared Voting Investment Power Information Basis Ordinary Meeting Voted'.split(
    ' ',
  ),
);
/** Lower-case words a holder's name may carry ("Capital Research and Affiliates", "U.S. government"). */
const JOIN = new Set(['and', 'of', 'de', '&', 'la', 'van', 'der', 'du', 'des']);
const MONTHS =
  'January February March April May June July August September October November December'.split(
    ' ',
  );

export function isoDate(text: string): string | null {
  const n = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (n) return `${n[3]}-${n[1]}-${n[2]}`;
  const m = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})/,
  );
  if (!m) return null;
  return `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/** A holder's name: the capitalised run that ends a stretch of text, walking back. */
function trailingName(piece: string): string {
  const words = piece
    .replace(/\(\d+\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
  const kept: string[] = [];
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    const bare = w.replace(/[,.:;]$/, '');
    if (!bare || w.endsWith(':') || STOP.has(bare) || /^[\d—–-]/.test(w)) break;
    if (/^[a-z]/.test(w) && !JOIN.has(w) && i !== words.length - 1) break;
    kept.unshift(w);
  }
  return kept
    .join(' ')
    .replace(/^(?:(?:and|of|the|The)\s+)+/, '')
    .replace(/[,;]$/, '')
    .replace(/\s+P\.O\.( Box)?$/, '')
    .trim();
}

/** The name in a row's text: before its address, after the column headings and section labels. */
function nameOf(own: string): string {
  for (const piece of own.split(/\s(?=\d)/)) {
    const name = trailingName(piece);
    if (/^[A-Z]/.test(name)) return name;
  }
  return '';
}

const AS_OF =
  /as of ((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}|\d{2}\/\d{2}\/\d{4})/g;

/** The last "as of <date>" before the table's first row: the date its figures are of. */
function tableDate(head: string): string | null {
  const dates = [...head.matchAll(AS_OF)];
  return dates.length ? isoDate(dates.at(-1)![1]) : null;
}

function rowsIn(window: string, before: string): ProxyRow[] {
  const first = window.search(ROW_TAIL);
  if (first < 0) return [];
  const asOf = tableDate(before + window.slice(0, first));
  // The table ends at its footnotes or its "* less than 1%" key, after the first row.
  const end = window.slice(first + 20).search(END);
  const table = window.slice(0, end < 0 ? window.length : first + 20 + end);
  const rows: ProxyRow[] = [];
  let from = 0;
  for (const m of table.matchAll(ROW_TAIL)) {
    const segment = table.slice(from, m.index!);
    from = m.index! + m[0].length;
    // A row's own text starts after the previous row's "*" (an under-1% row),
    // and is never longer than a name and an address.
    const own = segment.slice(segment.lastIndexOf(' * ') + 1).slice(-160);
    const numbers = [...m[0].matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?/g)].map((n) =>
      Number(n[0].replace(/,/g, '')),
    );
    const percent = Number(m[0].match(/(\d{1,2}(?:\.\d{1,2})?)\s?%$/)?.[1]);
    const group = /as a group/i.test(own);
    const name = group ? 'Directors and executive officers as a group' : nameOf(own);
    if (!/^[A-Z]/.test(name) || NOT_A_NAME.test(name) || name.split(' ').length > 9) continue;
    rows.push({
      name,
      shares: Math.max(...numbers),
      percent,
      group,
      asOf,
      quote: `${own.trim().split(' ').slice(-16).join(' ')} ${m[0]}`.trim(),
    });
  }
  return rows;
}

/**
 * Every ownership table in a proxy's text (the 5% holders and the insiders
 * are separate tables in some proxies), rows merged by name, first wins.
 */
export function parseProxyTable(raw: string): ProxyTable | null {
  const text = raw.replace(/[​ ]/g, ' ').replace(/\s+/g, ' ');
  const starts = [...text.matchAll(HEADING)].map((m) => m.index!);
  const rows: ProxyRow[] = [];
  let intro: string | null = null;
  for (const at of starts) {
    const found = rowsIn(text.slice(at, at + 9000), text.slice(Math.max(0, at - 1500), at));
    if (!found.length) continue;
    intro ??= text.slice(at, at + 9000);
    for (const r of found) if (!rows.some((x) => x.name === r.name)) rows.push(r);
  }
  if (!intro) return null;
  const outstanding = intro.match(
    /(?:based on|we had|by) ([\d,]{9,}) (?:total voting )?shares of [^.]{0,60}?(?:common stock|ordinary shares)[^.]{0,40}?outstanding/i,
  );
  return {
    asOf: rows[0]?.asOf ?? null,
    sharesOutstanding: outstanding ? Number(outstanding[1].replace(/,/g, '')) : null,
    rows,
    multiClass: /Class B common stock/i.test(intro),
  };
}
