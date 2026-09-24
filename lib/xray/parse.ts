/**
 * Reading a pasted portfolio: one holding per line, or a CSV with a header.
 *
 * Accepts the forms a desk actually copies out of a terminal, a broker export
 * or a spreadsheet: "ASML", "ASML NA", "ASML NA Equity", "8035 JP",
 * "NVDA US", "NASDAQ:NVDA", "8035.T", each optionally followed by a weight
 * ("NVDA 12.5%", "NVDA, 0.125", "NVDA\t1200"). Weights are relative: they are
 * normalised over the holdings that resolve, so a share count, a value or a
 * percentage all work as long as the column is one kind.
 *
 * Pure: no lookup happens here. What a ticker IS comes from lib/xray/resolve.
 */

export interface ParsedHolding {
  /** The line as the reader wrote it, trimmed. */
  raw: string;
  ticker: string;
  /** Composite code ("US", "JP", "NA"), when the input named one. */
  exchange: string | null;
  weight: number | null;
}

export const MAX_HOLDINGS = 200;
export const MAX_INPUT_CHARS = 20_000;

/**
 * Venue and vendor codes to the Bloomberg composite the listings file uses.
 * US venues collapse to "US": a terminal quotes NVDA UW and NVDA US as one line.
 */
const EXCHANGE_ALIAS: Record<string, string> = {
  US: 'US',
  UW: 'US',
  UQ: 'US',
  UN: 'US',
  UR: 'US',
  UA: 'US',
  UP: 'US',
  UV: 'US',
  NASDAQ: 'US',
  NYSE: 'US',
  NYSEARCA: 'US',
  AMEX: 'US',
  OTC: 'US',
  ARCA: 'US',
  JP: 'JP',
  JT: 'JP',
  TYO: 'JP',
  TSE: 'JP',
  NA: 'NA',
  AMS: 'NA',
  AEX: 'NA',
  KS: 'KS',
  KRX: 'KS',
  KP: 'KS',
  TT: 'TT',
  TPE: 'TT',
  TWSE: 'TT',
  GR: 'GR',
  GY: 'GR',
  ETR: 'GR',
  XETRA: 'GR',
  FRA: 'GR',
  FP: 'FP',
  EPA: 'FP',
  LN: 'LN',
  LON: 'LN',
  LSE: 'LN',
  SW: 'SW',
  SE: 'SW',
  SIX: 'SW',
  VX: 'SW',
  IM: 'IM',
  BIT: 'IM',
  BB: 'BB',
  EBR: 'BB',
  CH: 'CH',
  CG: 'CH',
  CS: 'CH',
  SHA: 'CH',
  SHE: 'CH',
  HK: 'HK',
  HKG: 'HK',
  AU: 'AU',
  AT: 'AU',
  ASX: 'AU',
  CN: 'CN',
  CT: 'CN',
  TSX: 'CN',
  SJ: 'SJ',
  JSE: 'SJ',
  DC: 'DC',
  CPH: 'DC',
  SS: 'SS',
  STO: 'SS',
  NO: 'NO',
  OSL: 'NO',
  PW: 'PW',
  WSE: 'PW',
  IJ: 'IJ',
  IDX: 'IJ',
  PE: 'PE',
  RU: 'RU',
  MK: 'MK',
  SP: 'SP',
};

/** Yahoo-style suffixes: "8035.T", "ASML.AS". */
const SUFFIX: Record<string, string> = {
  T: 'JP',
  AS: 'NA',
  KS: 'KS',
  KQ: 'KS',
  TW: 'TT',
  TWO: 'TT',
  DE: 'GR',
  F: 'GR',
  PA: 'FP',
  L: 'LN',
  SW: 'SW',
  MI: 'IM',
  BR: 'BB',
  SS: 'CH',
  SZ: 'CH',
  HK: 'HK',
  AX: 'AU',
  TO: 'CN',
  JO: 'SJ',
  CO: 'DC',
  ST: 'SS',
  OL: 'NO',
  WA: 'PW',
  JK: 'IJ',
  LM: 'PE',
  ME: 'RU',
  KL: 'MK',
  SI: 'SP',
};

export function normaliseExchange(code: string): string | null {
  return EXCHANGE_ALIAS[code.toUpperCase()] ?? null;
}

/** "12.5%", "0.125", "1,200", "1 200" → a number, or null when it is not one. */
export function parseWeight(text: string): number | null {
  const clean = text.replace(/[%\s']/g, '').replace(/,(?=\d{3}\b)/g, '');
  if (!/^\d*\.?\d+$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** One cell or line holding a security, without its weight. */
export function parseTicker(text: string): { ticker: string; exchange: string | null } | null {
  let t = text
    .trim()
    .toUpperCase()
    .replace(/\s+EQUITY$/, '')
    .trim();
  if (!t) return null;
  const prefixed = /^([A-Z]+):\s*([A-Z0-9.\-/]+)$/.exec(t);
  if (prefixed) {
    const ex = normaliseExchange(prefixed[1]);
    return ex ? { ticker: prefixed[2], exchange: ex } : null;
  }
  const spaced = /^([A-Z0-9.\-/]+)\s+([A-Z]{2,7})$/.exec(t);
  if (spaced) {
    const ex = normaliseExchange(spaced[2]);
    return ex ? { ticker: spaced[1], exchange: ex } : null;
  }
  const dotted = /^([A-Z0-9-]+)\.([A-Z]{1,3})$/.exec(t);
  if (dotted && SUFFIX[dotted[2]]) return { ticker: dotted[1], exchange: SUFFIX[dotted[2]] };
  // A space left at this point means a name ("Carl Zeiss SMT"), not a ticker.
  return /^[A-Z0-9.\-/]{1,12}$/.test(t) ? { ticker: t, exchange: null } : null;
}

function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(';')) return line.split(';');
  // A comma followed by a space inside "1, 200" is rare in a paste; a comma is a separator.
  return line.split(',');
}

const TICKER_HEADER = /^(ticker|symbol|security|instrument|bbg ticker|code)$/i;
const WEIGHT_HEADER =
  /^(weight|weight %|%|pct|percent|allocation|value|market value|mv|position|quantity|shares|holding)$/i;

function fromLine(line: string): ParsedHolding | null {
  const raw = line.trim();
  const cells = splitCells(raw)
    .map((c) => c.trim())
    .filter(Boolean);
  if (cells.length >= 2) {
    const weight = parseWeight(cells[cells.length - 1]);
    const head = weight !== null ? cells.slice(0, -1).join(' ') : cells[0];
    const sec = parseTicker(head) ?? parseTicker(cells[0]);
    return sec ? { raw, ...sec, weight } : null;
  }
  // "NVDA US 12%" or "NVDA 12%": a trailing number is a weight.
  const tail = /^(.*?)\s+([\d.,' ]+%?)$/.exec(raw);
  if (tail) {
    const weight = parseWeight(tail[2]);
    const sec = weight !== null ? parseTicker(tail[1]) : null;
    if (sec) return { raw, ...sec, weight };
  }
  const sec = parseTicker(raw);
  return sec ? { raw, ...sec, weight: null } : null;
}

export interface ParseResult {
  holdings: ParsedHolding[];
  /** Lines that were not a holding in any form, as written. */
  rejected: string[];
  truncated: boolean;
}

export function parseHoldings(input: string): ParseResult {
  const lines = input
    .slice(0, MAX_INPUT_CHARS)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const holdings: ParsedHolding[] = [];
  const rejected: string[] = [];

  let tickerCol = -1;
  let weightCol = -1;
  const header = lines[0] ? splitCells(lines[0]).map((c) => c.trim()) : [];
  if (header.some((c) => TICKER_HEADER.test(c))) {
    tickerCol = header.findIndex((c) => TICKER_HEADER.test(c));
    weightCol = header.findIndex((c) => WEIGHT_HEADER.test(c));
    lines.shift();
  }

  for (const line of lines) {
    if (holdings.length >= MAX_HOLDINGS) return { holdings, rejected, truncated: true };
    let parsed: ParsedHolding | null;
    if (tickerCol >= 0) {
      const cells = splitCells(line).map((c) => c.trim());
      const sec = parseTicker(cells[tickerCol] ?? '');
      parsed = sec
        ? { raw: line, ...sec, weight: weightCol >= 0 ? parseWeight(cells[weightCol] ?? '') : null }
        : null;
    } else {
      parsed = fromLine(line);
    }
    if (parsed) holdings.push(parsed);
    else rejected.push(line);
  }
  return { holdings, rejected, truncated: false };
}
