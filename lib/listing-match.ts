/**
 * Is this security the company we mean? The rule the listings generator uses,
 * kept pure so its failures are tests rather than tickers on a page.
 *
 * Both names are reduced to their distinguishing words (legal forms, share
 * classes and "the" removed). The security's name must contain every word of
 * the company's, and may add only GENERIC words — "Chemicals" in "Air
 * Products & Chemicals", "Holdings" in "Impala Platinum Holdings". Any other
 * extra word is a different company. The first version only required the
 * first half, and matched:
 *
 *   The Quartz Corp       → Quartz Mountain Resources
 *   SK Inc.               → SK Telecom
 *   China Rare Earth Group → China Northern Rare Earth
 */
import { HOME_COMPOSITE, type SecurityRef } from '@/lib/listings';
import type { PinnedLine } from '@/config/substrata-listing-overrides';

const LEGAL = new Set([
  'the',
  'and',
  'of',
  'co',
  'corp',
  'corporation',
  'inc',
  'in',
  'ltd',
  'limited',
  'plc',
  'nv',
  'sa',
  'ag',
  'se',
  'kk',
  'spa',
  'asa',
  'ab',
  'oyj',
  'pjsc',
  'tbk',
  'persero',
  'pt',
  'mmc',
  'adr',
  'l',
]);

/** Words a listed name may add without becoming another company. */
const GENERIC = new Set([
  'group',
  'holding',
  'holdings',
  'company',
  'technology',
  'technologies',
  'industries',
  'industry',
  'chemical',
  'chemicals',
  'international',
  'electronics',
  'manufacturing',
]);

/** Share-class and market-segment tails: "-A", "- AUC", "SA-INVERSIONES". */
const TAIL = /\s*-\s*(a|b|h|auc|inversiones|reg|pfd)\s*$/i;

export function distinguishingWords(name: string): string[] {
  return (
    name
      .replace(TAIL, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      // A US state of incorporation, however spaced: "/DE", "/ DE", "/DE/".
      .replace(/\/\s*[a-z]{2,3}\s*\/?/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(' ')
      .filter((w) => w && !LEGAL.has(w))
  );
}

export function sameCompany(wanted: string, candidate: string): boolean {
  const want = distinguishingWords(wanted).filter((w) => !GENERIC.has(w));
  const have = distinguishingWords(candidate);
  if (want.length === 0) return false;
  const haveSet = new Set(have);
  return want.every((w) => haveSet.has(w)) && have.every((w) => want.includes(w) || GENERIC.has(w));
}

/**
 * The listing a desk shows first.
 *
 * A company with a US jurisdiction and a NYSE/Nasdaq line trades there
 * (Linde's home line is LIN US, not the London order-book code 0M2B). Else
 * the first home-exchange line found; London's international order book
 * ("0xxx") is never a home line. Else a NYSE/Nasdaq line. An OTC-only ADR is
 * never the primary; it is still shown, as the US line beside it.
 */
export function choosePrimary(
  homeLines: readonly SecurityRef[],
  us: SecurityRef | null,
  jurisdictions: readonly string[],
): SecurityRef | null {
  const usMajor = us && us.exchange !== 'OTC' ? us : null;
  if (usMajor && jurisdictions.includes('US')) return usMajor;
  const homes = jurisdictions.map((j) => HOME_COMPOSITE[j]).filter(Boolean);
  for (const code of homes) {
    const line = homeLines.find(
      (l) => l.exchange === code && !(code === 'LN' && /^0/.test(l.ticker)),
    );
    if (line) return line;
  }
  return usMajor ?? null;
}

/** One row of an OpenFIGI mapping response. */
export interface FigiMapped {
  ticker: string;
  name: string;
  figi: string;
  compositeFIGI?: string;
}

/**
 * The pinned home line, if OpenFIGI still returns exactly it.
 *
 * Equality on ticker AND name, never similarity: a pin exists because the
 * name is truncated past what `sameCompany` can read, so the only safe test
 * is that it is the very string a person checked. A renamed or reused ticker
 * comes back null and the generator says so, rather than keeping a stale
 * line.
 */
export function pinnedLine(rows: readonly FigiMapped[], pin: PinnedLine): SecurityRef | null {
  const row = rows.find((r) => r.ticker === pin.ticker && r.name === pin.figiName);
  if (!row) return null;
  // The row's own FIGI, not its composite: for these lines OpenFIGI has no
  // record of the composite (openfigi.com/id/<composite> is a 404 and an
  // ID_BB_GLOBAL mapping of it finds nothing), found by the quality run
  // 2026-09-26. The exchange line is the one a reader can open and re-map.
  const figi = row.figi;
  return {
    ticker: row.ticker,
    exchange: pin.exchange,
    name: row.name,
    figi,
    source: `https://www.openfigi.com/id/${figi}`,
  };
}

/** Whether a stored line is the one a pin names. */
export function isPinned(ref: SecurityRef | null, pin: PinnedLine | undefined): boolean {
  return (
    !!ref &&
    !!pin &&
    ref.ticker === pin.ticker &&
    ref.exchange === pin.exchange &&
    ref.name === pin.figiName
  );
}
