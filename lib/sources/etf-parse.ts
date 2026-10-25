/**
 * Issuer holdings files, parsed into one shape. Each holding keeps the text of
 * its own row as `quote`: the CSV line as served, or the table cells in order
 * (HTML, xlsx), so a reader can find it in the file the URL returns.
 *
 * Cash, currency, money-market and treasury lines are not companies and are
 * dropped here (they carry no ticker, or a fund-sweep identifier).
 */
import type { HoldingsFormat } from '@/config/universe-sources';
import { xlsxRows } from './xlsx';

export interface Holding {
  name: string;
  ticker: string;
  /** Listing venue: `US`, or the Bloomberg-style code the file printed (`KS`, `CN`, `SW`). */
  exchange: string;
  cusip?: string;
  sedol?: string;
  marketValueUsd?: number;
  weightPct?: number;
  quote: string;
  locator: string;
}

export interface ParsedHoldings {
  /** YYYY-MM-DD the file says it is as of. */
  asOf: string | null;
  holdings: Holding[];
}

/** One CSV line into cells (quoted fields with commas and doubled quotes). */
export function csvCells(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cell);
      cell = '';
    } else cell += ch;
  }
  out.push(cell);
  return out.map((c) => c.trim());
}

const money = (s: string | undefined) => {
  const n = Number((s ?? '').replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) && (s ?? '').trim() !== '' ? n : undefined;
};

/** "10/23/2026" → "2026-10-23"; "22-Oct-2026" → "2026-10-22". */
export function isoOf(date: string | undefined): string | null {
  if (!date) return null;
  const us = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const d = Date.parse(date.replace(/-/g, ' '));
  return Number.isNaN(d) ? null : new Date(d + 12 * 3_600_000).toISOString().slice(0, 10);
}

/** US composite suffixes a file may print after a US ticker. */
const US_SUFFIX = new Set(['US', 'UQ', 'UN', 'UW', 'UR', 'UA', 'UP', 'UV']);

/** "RKLB UQ" → RKLB/US; "388720 KS" → 388720/KS; "ABBN.SW" → ABBN/SW; "TSLA" → TSLA/US. */
export function splitTicker(raw: string): { ticker: string; exchange: string } | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(\S+?)(?:[ .]([A-Z]{2}))?$/);
  if (!m) return null;
  const exchange = !m[2] || US_SUFFIX.has(m[2]) ? 'US' : m[2];
  return { ticker: m[1], exchange };
}

const NOT_COMPANY =
  /\b(CASH|CURRENCY|DOLLAR|POUND|YEN|WON|EURO|FRANC|KRONE|KRONA|RUPEE|YUAN|RENMINBI|REAL|PESO|LIRA|RAND|ETF|TREASURY|TRSY|OBLIG|MONEY MARKET|GOVERNMENT OBLIGATIONS|FUTURE)\b/i;

function holding(
  name: string,
  rawTicker: string,
  rest: Omit<Holding, 'name' | 'ticker' | 'exchange'>,
): Holding | null {
  const split = splitTicker(rawTicker);
  if (!split || !name || NOT_COMPANY.test(name)) return null;
  return { name, ...split, ...rest };
}

function arkCsv(text: string): ParsedHoldings {
  const lines = text.split(/\r?\n/);
  const holdings: Holding[] = [];
  let asOf: string | null = null;
  lines.forEach((line, i) => {
    const c = csvCells(line);
    if (i === 0 || c.length < 8 || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(c[0])) return;
    asOf ??= isoOf(c[0]);
    if (/^X9/.test(c[4])) return;
    const h = holding(c[2], c[3], {
      cusip: c[4] || undefined,
      marketValueUsd: money(c[6]),
      weightPct: money(c[7]),
      quote: line.trim(),
      locator: `line ${i + 1}`,
    });
    if (h) holdings.push(h);
  });
  return { asOf, holdings };
}

function globalxCsv(text: string): ParsedHoldings {
  const lines = text.split(/\r?\n/);
  const asOf = isoOf(
    lines
      .slice(0, 3)
      .join(' ')
      .match(/as of (\S+)/i)?.[1],
  );
  const holdings: Holding[] = [];
  lines.forEach((line, i) => {
    const c = csvCells(line);
    if (i < 3 || c.length < 7 || !c[1]) return;
    const h = holding(c[2], c[1], {
      sedol: c[3] || undefined,
      marketValueUsd: money(c[6]),
      weightPct: money(c[0]),
      quote: line.trim(),
      locator: `line ${i + 1}`,
    });
    if (h) holdings.push(h);
  });
  return { asOf, holdings };
}

function decodeHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Table rows (td cells only) of an HTML page. */
export function htmlRows(html: string): string[][] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => decodeHtml(c[1])),
  );
}

function ftHtml(html: string): ParsedHoldings {
  const asOf = isoOf(html.match(/Holdings of the Fund as of (\d{1,2}\/\d{1,2}\/\d{4})/)?.[1]);
  const holdings: Holding[] = [];
  htmlRows(html).forEach((c, i) => {
    if (c.length !== 7 || c[0] === 'Security Name' || !/\$/.test(c[5])) return;
    const h = holding(c[0], c[1], {
      cusip: c[2] || undefined,
      marketValueUsd: money(c[5]),
      weightPct: money(c[6]),
      quote: c.join(' '),
      locator: `holdings table row ${i + 1}`,
    });
    if (h) holdings.push(h);
  });
  return { asOf, holdings };
}

function defianceHtml(html: string): ParsedHoldings {
  const asOf = isoOf(html.match(/Data as of (\d{1,2}\/\d{1,2}\/\d{4})/)?.[1]);
  const holdings: Holding[] = [];
  const header = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => decodeHtml(m[1]));
  if (header[0] !== 'Ticker') return { asOf, holdings };
  htmlRows(html).forEach((c, i) => {
    if (c.length < 5) return;
    const h = holding(c[1], c[0], {
      ...(/^[0-9A-Z]{9}$/.test(c[2]) ? { cusip: c[2] } : {}),
      weightPct: money(c[3]),
      quote: c.join(' '),
      locator: `holdings table row ${i + 1}`,
    });
    if (h) holdings.push(h);
  });
  return { asOf, holdings };
}

function ssgaXlsx(bytes: Uint8Array): ParsedHoldings {
  const rows = xlsxRows(bytes);
  const asOf = isoOf(
    rows
      .flat()
      .find((c) => /^As of /.test(c))
      ?.slice(6),
  );
  const head = rows.findIndex((r) => r[0] === 'Name' && r[1] === 'Ticker');
  const holdings: Holding[] = [];
  if (head < 0) return { asOf, holdings };
  rows.slice(head + 1).forEach((c, i) => {
    if (!c[1] || c[1] === '-' || c.length < 7) return;
    const h = holding(c[0], c[1], {
      cusip: c[2] || undefined,
      sedol: c[3] || undefined,
      weightPct: money(c[4]),
      quote: c.filter(Boolean).join(' | '),
      locator: `sheet 1 row ${head + i + 2}`,
    });
    if (h) holdings.push(h);
  });
  return { asOf, holdings };
}

export function parseHoldings(format: HoldingsFormat, body: Uint8Array): ParsedHoldings {
  if (format === 'ssga-xlsx') return ssgaXlsx(body);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(body);
  if (format === 'ark-csv') return arkCsv(text);
  if (format === 'globalx-csv') return globalxCsv(text);
  if (format === 'ft-html') return ftHtml(text);
  return defianceHtml(text);
}
