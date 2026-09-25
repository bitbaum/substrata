/**
 * "Peers on <resource>": who else leads the resources this country is most
 * significant in, from the same USGS/EIA column. Replaced "Similar
 * geologies", which matched on a shared resource name (Russia ↔ Timor-Leste).
 */
import Link from 'next/link';
import { Figure } from '../Figure';
import { peersFor } from '@/lib/resources/peers';
import { formatShare, ordinal } from '@/lib/resources/format';

export function Peers({ iso2, prefer }: { iso2: string; prefer?: string }) {
  const groups = peersFor(iso2, { prefer });
  if (groups.length === 0) return null;
  return (
    <section className="mt-5 country-peers">
      {groups.map((g) => (
        <div key={g.resource} className="resource-peers">
          <h3>Peers on {g.label.toLowerCase()}</h3>
          <p className="resource-unit">
            The other leading countries by {g.basis.toLowerCase()} (USGS/EIA); this country is{' '}
            <Figure method="world-rank">{ordinal(g.rank)}</Figure>.
          </p>
          <ol className="resource-list">
            {g.peers.map((p) => (
              <li key={p.iso2}>
                <Link href={`/atlas?view=world&country=${p.iso2}&resource=${g.resource}`}>
                  {p.name}
                </Link>{' '}
                <span className="resource-unit">
                  <Figure method="world-rank">{ordinal(p.rank)}</Figure>
                  {p.share !== null && (
                    <>
                      {' · '}
                      <Figure method="share">{formatShare(p.share)}</Figure>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
