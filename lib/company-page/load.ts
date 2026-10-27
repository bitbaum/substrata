/**
 * The page's reads, deduplicated per request with React's `cache`: the header
 * quote, the price section, the key statistics and the peers all ask for the
 * same closes, and each section streams on its own (Suspense), so whichever
 * asks first reads and the rest wait on that one read. The readers themselves
 * (lib/market-data) keep their own caches across requests.
 */
import { cache } from 'react';

import { isSeedLine, marketCompanyFor } from '@/lib/market-data/company';
import type { MarketCompany } from '@/lib/market-data/identity';
import { fundamentals } from '@/lib/market-data/fundamentals/read';
import { holders } from '@/lib/market-data/holders/read';
import type { Exchange } from '@/lib/market-data/identity';
import { priceHistory } from '@/lib/market-data/prices/store';

export const listingOf = cache((slug: string) => marketCompanyFor(slug));

/**
 * `expectName`: pass the company's name for a listing from the universe, so a
 * symbol that is another company's on that venue is refused, not drawn.
 */
export const pricesOf = cache((exchange: Exchange, symbol: string, expectName?: string) =>
  priceHistory({ exchange, symbol }, expectName ? { expectName } : {}),
);

export const fundamentalsOf = cache(async (slug: string) => {
  const c = marketCompanyFor(slug);
  return c ? fundamentals(c) : null;
});

export const holdersOf = cache(async (slug: string) => {
  const c = marketCompanyFor(slug);
  return c ? holders(c) : null;
});

/** The name a listing's price line must carry: none for a hand-checked seed line. */
export const expectNameOf = (c: MarketCompany): string | undefined =>
  isSeedLine(c) ? undefined : c.name;
