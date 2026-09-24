import type { Listing } from '@/lib/listings';
import { terminalTicker } from '@/lib/listings';

/**
 * Where a company trades, each ticker linked to the record it came from
 * (OpenFIGI or the SEC). A parent listing says so, because it is a diluted
 * exposure; a private company or an unfound one says that instead of a blank.
 */
export function Ticker({
  listing,
  compact = false,
}: {
  listing: Listing | null;
  compact?: boolean;
}) {
  if (!listing) return <span className="ticker-none">—</span>;
  if (listing.status === 'private')
    return (
      <span className="ticker-none" title={listing.note}>
        Private
      </span>
    );
  if (listing.status === 'none-found')
    return (
      <span
        className="ticker-none"
        title={`No listing found for "${listing.query}" in the SEC ticker file or OpenFIGI, checked ${listing.checkedOn}.`}
      >
        No listing found
      </span>
    );
  const refs = [listing.primary, listing.us].filter(
    (r, i, all): r is NonNullable<typeof r> =>
      Boolean(r) &&
      all.findIndex((o) => o && r && o.ticker === r.ticker && o.exchange === r.exchange) === i,
  );
  return (
    <span className="ticker-group">
      {refs.slice(0, compact ? 1 : 2).map((ref) => (
        <a
          key={`${ref.ticker}-${ref.exchange}`}
          href={ref.source}
          target="_blank"
          rel="noopener noreferrer"
          className="ticker"
          title={`${ref.name} · ${ref.figi ? `OpenFIGI ${ref.figi}` : `SEC CIK ${ref.cik}`} · checked ${listing.checkedOn}`}
        >
          {terminalTicker(ref)}
        </a>
      ))}
      {listing.status === 'parent' && (
        <span className="ticker-parent" title={listing.note}>
          via {listing.parent}
        </span>
      )}
    </span>
  );
}
