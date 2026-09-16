import Link from 'next/link';
import { INSTRUMENTS } from '@/config/substrata-policy';
import { EVENTS } from '@/config/substrata-events';
import { WORLD_PATHS } from '@/config/world-paths';
import { WorldMap } from './WorldMap';
import { Inquire } from './Inquire';
import { EU_MEMBERS, factFor } from '@/lib/geo';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { marketHref, policyHref } from '@/lib/links';

export function WorldPanel({ country }: { country?: string }) {
  const selected = country?.toLowerCase() ?? '';
  const path = WORLD_PATHS.find((p) => p.iso2 === selected);
  const fact = selected ? factFor(selected) : null;
  const eu = selected && (EU_MEMBERS as readonly string[]).includes(selected);
  const instruments = INSTRUMENTS.filter(
    (i) => i.jurisdiction === selected || (eu && i.jurisdiction === 'eu'),
  );
  const orgs = MARKET_PARTICIPANTS.filter((p) =>
    p.jurisdictions.some((j) => j.toLowerCase() === selected),
  ).slice(0, 12);
  const events = EVENTS.filter((e) =>
    e.jurisdictions.some((j) => j.toLowerCase() === selected || (eu && j.toLowerCase() === 'eu')),
  ).slice(0, 8);

  return (
    <div className="world-layout">
      <WorldMap selected={selected || undefined} />
      <aside className="world-panel">
        {selected && (path || fact) ? (
          <>
            <p className="research-kicker">{selected.toUpperCase()}</p>
            <h2>{path?.name ?? fact?.name ?? selected.toUpperCase()}</h2>
            {fact?.hasRecord ? (
              <dl className="world-stats">
                <div>
                  <dt>Rules</dt>
                  <dd>{fact.instruments}</dd>
                </div>
                <div>
                  <dt>Organisations</dt>
                  <dd>{fact.organisations}</dd>
                </div>
                <div>
                  <dt>Events</dt>
                  <dd>{fact.events}</dd>
                </div>
                <div>
                  <dt>Material rows</dt>
                  <dd>{fact.materials}</dd>
                </div>
              </dl>
            ) : (
              <>
                <p>No policy, organisation, event or material row is recorded here yet.</p>
                <Inquire topic={`country:${selected}`} />
              </>
            )}
            {eu && (
              <p className="mt-3 text-sm text-fg-tertiary">
                EU instruments are included because this state is a member.
              </p>
            )}
            {fact?.policyHref && (
              <p className="mt-4">
                <Link href={fact.policyHref} className="text-accent">
                  Policy page →
                </Link>
              </p>
            )}
            {eu && !fact?.policyHref && (
              <p className="mt-4">
                <Link href={policyHref('eu')} className="text-accent">
                  EU policy page →
                </Link>
              </p>
            )}
            {orgs.length > 0 && (
              <section className="mt-6">
                <h3>Organisations</h3>
                <ul>
                  {orgs.map((org) => (
                    <li key={org.slug}>
                      <Link href={marketHref(org.slug)}>{org.name}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {instruments.length > 0 && (
              <section className="mt-6">
                <h3>Rules</h3>
                <ul>
                  {instruments.map((instrument) => (
                    <li key={instrument.id}>
                      <Link href={policyHref(instrument.jurisdiction)}>{instrument.title}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {events.length > 0 && (
              <section className="mt-6">
                <h3>Recent events</h3>
                <ul>
                  {events.map((event) => (
                    <li key={event.id}>
                      <span className="font-mono text-xs">{event.date}</span> {event.headline}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <p>Choose a country. Grey means we have not recorded a row there yet.</p>
        )}
      </aside>
    </div>
  );
}
