import Link from 'next/link';
import type { Metadata } from 'next';
import { INSTRUMENTS, JURISDICTION_LABEL } from '@/config/substrata-policy';
import { EVENTS } from '@/config/substrata-events';
import { WORLD_PATHS } from '@/config/world-paths';
import { WorldMap } from '@/components/portal/WorldMap';
import { Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { EU_MEMBERS, factFor } from '@/lib/geo';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { marketHref, policyHref } from '@/lib/links';

export const metadata: Metadata = {
  title: 'World',
  description:
    'Every country on one map. Open a country to see recorded policy, organisations, events and materials — and the gaps.',
};

export default async function WorldPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country: raw } = await searchParams;
  const selected = typeof raw === 'string' ? raw.toLowerCase() : '';
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
    <Shell currentPath="world">
      <Page>
        <SectionHeader
          title="The physical world, as recorded"
          lede="Paint is coverage, not importance. A pale country is one we have not yet written down. Click any country. EU rules also colour every member state."
        />
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
                  <p>No policy, organisation, event or material row is recorded here yet.</p>
                )}
                {eu && (
                  <p className="mt-3 text-sm text-fg-tertiary">
                    EU instruments are included because this state is a member. That is membership,
                    not a claim that every EU rule binds this country the same way.
                  </p>
                )}
                {fact?.policyHref && (
                  <p className="mt-4">
                    <Link href={fact.policyHref} className="text-accent">
                      {JURISDICTION_LABEL[selected as keyof typeof JURISDICTION_LABEL] ??
                        'Jurisdiction'}{' '}
                      policy page →
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
      </Page>
    </Shell>
  );
}
