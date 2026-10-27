/**
 * THE SEAM for the market-data workstream. A tier B page (and later every
 * company page) asks `marketDataKey(entry)` for the identifiers market data is
 * keyed by, and renders whatever sections `lib/market-data` registers in
 * `MARKET_DATA_SECTIONS`. Nothing is registered here: financials, ownership
 * charts and relations arrive from that workstream, keyed by ticker, and plug
 * in by pushing a provider — this file never fetches or computes a figure.
 */
import type { ReactNode } from 'react';

import type { UniverseEntry } from './types';

export interface MarketDataKey {
  ticker?: string;
  exchange?: string;
  cik?: string;
  lei?: string;
  isin?: string;
}

export interface MarketDataSection {
  id: string;
  title: string;
  importance: number;
  evidence?: string;
  /** null when it has nothing for this key: the section is then not rendered. */
  render: (key: MarketDataKey) => ReactNode | null;
}

/**
 * Extra providers. Empty: the market frame itself (price, key statistics,
 * financials, holders, business, peers) is rendered for every company page by
 * components/company/marketSections.tsx, joined through
 * lib/market-data/company.ts `marketCompanyFor`, which reads `marketDataKey`.
 */
export const MARKET_DATA_SECTIONS: MarketDataSection[] = [];

export function marketDataKey(entry: Pick<UniverseEntry, 'ids'>): MarketDataKey | null {
  const { ticker, exchange, cik, lei, isin } = entry.ids;
  if (!ticker && !cik && !lei && !isin) return null;
  return { ticker, exchange, cik, lei, isin };
}
