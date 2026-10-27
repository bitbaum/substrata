/**
 * The page's reads, deduplicated per request with React's `cache`: the header
 * quote, the price section, the key statistics and the peers all ask for the
 * same closes, and each section streams on its own (Suspense), so whichever
 * asks first reads and the rest wait on that one read. The readers themselves
 * (lib/market-data) keep their own caches across requests.
 */
import { cache } from 'react';

import { marketCompanyFor } from '@/lib/market-data/company';
import { fundamentals } from '@/lib/market-data/fundamentals/read';
import { holders } from '@/lib/market-data/holders/read';
import type { Exchange } from '@/lib/market-data/identity';
import { priceHistory } from '@/lib/market-data/prices/store';

export const listingOf = cache((slug: string) => marketCompanyFor(slug));

export const pricesOf = cache((exchange: Exchange, symbol: string) =>
  priceHistory({ exchange, symbol }),
);

export const fundamentalsOf = cache(async (slug: string) => {
  const c = marketCompanyFor(slug);
  return c ? fundamentals(c) : null;
});

export const holdersOf = cache(async (slug: string) => {
  const c = marketCompanyFor(slug);
  return c ? holders(c) : null;
});
