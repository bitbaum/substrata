/**
 * Tier A: the directory's profiled companies (config/substrata-participants.ts
 * and the coverage join), as universe candidates. Their chain role is the
 * hand-verified claim that admits them; their identifiers come from
 * research/listings.json (SEC + OpenFIGI), where the directory holds one.
 *
 * A directory row with no sourced role (an unverified producer lead only) is
 * NOT tier A: it is judged like any other candidate, by the rows it has.
 */
import type { ChainLayer } from '@/config/substrata-participants';
import type { ThemeId } from '@/config/universe-themes';
import { listingFor } from '@/lib/listings';
import { MARKET_PARTICIPANTS, type MarketParticipant } from '@/lib/participants';
import type { ChainRole, Identifiers } from './types';

/**
 * The theme a chain layer sits in. Equipment through systems is the compute
 * chain; extraction through conversion serves every branch, so it is filed
 * under materials, where the tracked chokepoints sit.
 */
export const LAYER_THEME: Record<ChainLayer, ThemeId> = {
  extraction: 'materials',
  refining: 'materials',
  conversion: 'materials',
  equipment: 'compute',
  fabrication: 'compute',
  packaging: 'compute',
  systems: 'compute',
  energy: 'grid',
  actuation: 'robotics',
  deployment: 'ai',
};

export function chainRoleOf(p: MarketParticipant): ChainRole | undefined {
  const source = p.directorySource ?? p.existenceVerifiedBy?.url;
  if (!source) return undefined;
  const role =
    p.role ??
    (p.existenceVerifiedBy ? `makes ${p.existenceVerifiedBy.bottleneck}` : `${p.layer} layer`);
  return { role, source, themes: [LAYER_THEME[p.layer]] };
}

/** The identifiers research/listings.json holds for a directory company, own listing only. */
export function listedIds(slug: string): { ids: Identifiers; source?: string } {
  const listing = listingFor(slug);
  if (!listing || listing.status !== 'listed') return { ids: {} };
  const ref = listing.primary ?? listing.us;
  if (!ref) return { ids: {} };
  const cik = listing.us?.cik ?? ref.cik;
  return {
    ids: {
      ticker: ref.ticker,
      exchange: ref.exchange,
      ...(cik ? { cik: String(cik) } : {}),
    },
    source: ref.source,
  };
}

export function tierAParticipants(): readonly MarketParticipant[] {
  return MARKET_PARTICIPANTS;
}
