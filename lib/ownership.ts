/**
 * What a company page says about who owns it, derived in one place from the
 * ownership rows (config/substrata-ownership.ts) and the listing record
 * (research/listings.json), so the header tile, the ownership section and
 * the chat tool cannot disagree.
 *
 * Kept free of React so the join is tested. Nothing here computes a share
 * the config does not hold: the "rest" is 100 minus the named, sourced
 * shares, and is shown only when every named holder is sourced — a null
 * share makes the remainder unknowable, and the page says so.
 */
import {
  HOLDER_KIND_LABEL,
  OWNERSHIP_STATUS_LABEL,
  ownershipOf,
  type Holder,
  type OwnershipStatus,
} from '@/config/substrata-ownership';
import { listingFor, type Listing } from './listings';

export interface OwnershipView {
  status: OwnershipStatus;
  statusLabel: string;
  /** For a subsidiary: the parent whose shares the holders are of. */
  parent: string | null;
  /** One line for the tile and the chat: "Listed", "Private — owned by …", "Subsidiary of Hitachi". */
  line: string;
  holders: Holder[];
  /** Holders whose share was read off a document. */
  sourced: Holder[];
  /** Holders named but with no share on record. */
  leads: Holder[];
  /** Sum of sourced shares, or null when nothing is sourced. */
  namedTotal: number | null;
  /** 100 minus the named shares, only when every named holder is sourced. */
  rest: number | null;
  /** Whether there is any row at all — a company with none shows no section. */
  recorded: boolean;
}

function statusFrom(listing: Listing | undefined): {
  status: OwnershipStatus;
  parent: string | null;
} {
  if (!listing) return { status: 'listed', parent: null };
  if (listing.status === 'private') return { status: 'private', parent: null };
  if (listing.status === 'parent') return { status: 'subsidiary', parent: listing.parent ?? null };
  return { status: 'listed', parent: null };
}

export function ownershipView(slug: string): OwnershipView {
  const row = ownershipOf(slug);
  const listing = listingFor(slug);
  const fallback = statusFrom(listing);
  const status = row?.status ?? fallback.status;
  const parent = row?.parent ?? (status === 'subsidiary' ? fallback.parent : null);
  const holders = row?.holders ?? [];
  const sourced = holders.filter((h) => h.share !== null);
  const leads = holders.filter((h) => h.share === null);
  const namedTotal =
    sourced.length > 0 ? sourced.reduce((sum, h) => sum + (h.share ?? 0), 0) : null;
  const rest = namedTotal !== null && leads.length === 0 ? Math.max(0, 100 - namedTotal) : null;

  const ownedBy = row?.ownedBy;
  let line = OWNERSHIP_STATUS_LABEL[status];
  if (status === 'subsidiary' && parent) line = `Subsidiary of ${parent}`;
  else if ((status === 'private' || status === 'state-owned') && ownedBy)
    line = `${OWNERSHIP_STATUS_LABEL[status]} — owned by ${ownedBy}`;
  else if (status === 'private' && listing?.status === 'private') line = 'Private';

  return {
    status,
    statusLabel: OWNERSHIP_STATUS_LABEL[status],
    parent,
    line,
    holders,
    sourced,
    leads,
    namedTotal,
    rest,
    recorded: Boolean(row),
  };
}

/** "Fund · 2025 proxy statement" — the one line under a holder's name. */
export function holderDetail(h: Holder): string {
  return `${HOLDER_KIND_LABEL[h.kind]} · as of ${h.asOf}`;
}

/** Shares rounded for display; the config keeps what the document said. */
export function formatShare(share: number): string {
  return `${Number.isInteger(share) ? share : share.toFixed(share < 10 ? 2 : 1)}%`;
}
