/**
 * What a company's page can show, counted honestly. Three kinds, decided by
 * identifiers only (no network read), so the count is the same everywhere it
 * is printed: /data/companies, the directory and the coverage script.
 *
 *   filer     a listing the price source serves AND an SEC CIK: quote, price
 *             history, XBRL statements, holders from proxies and 13G/13D
 *   quote     a listing, no SEC filings: quote and history; statements and
 *             holders say why they are missing and queue a task
 *   identity  admitted, but no listing the price source can be told apart on
 *             (private, a subsidiary, or a venue code that names several
 *             exchanges): identity, themes and evidence; no quote
 */
import { marketCompanyFor } from '@/lib/market-data/company';
import type { UniverseEntry } from './types';

export type PageKind = 'filer' | 'quote' | 'identity';

export const PAGE_KINDS: readonly { kind: PageKind; label: string; shows: string }[] = [
  {
    kind: 'filer',
    label: 'Quote and SEC filings',
    shows: 'Quote, price history, XBRL statements and holders from its SEC filings.',
  },
  {
    kind: 'quote',
    label: 'Quote only',
    shows:
      'Quote and price history. It files nothing with the SEC, so statements and holders show why they are missing.',
  },
  {
    kind: 'identity',
    label: 'Identity only',
    shows: 'Identifiers, themes and the evidence that admits it. No readable listing, so no quote.',
  },
];

export function pageKindOf(entry: Pick<UniverseEntry, 'slug' | 'ids'>): PageKind {
  const line = marketCompanyFor(entry.slug);
  if (!line) return 'identity';
  return line.cik ? 'filer' : 'quote';
}

export function pageKindCounts(entries: readonly UniverseEntry[]): Record<PageKind, number> {
  const out: Record<PageKind, number> = { filer: 0, quote: 0, identity: 0 };
  for (const e of entries) if (e.admitted) out[pageKindOf(e)] += 1;
  return out;
}
