import Link from 'next/link';
import { Inquire } from './Inquire';
import { countryDossier, worldInsights } from '@/lib/geo';
import { neighbors } from '@/lib/graph';
import { EU_MEMBERS } from '@/lib/geo';
import { policyHref } from '@/lib/links';
import { countryDiagram } from '@/lib/country-diagram';
import { countryResources } from '@/lib/resources/country';
import { CountryResources } from './resources/CountryResources';
import { CountryAccess } from './resources/CountryAccess';
import { Peers } from './resources/Peers';

export function WorldPanel({ country, resource }: { country?: string; resource?: string }) {
  const selected = country?.toLowerCase() ?? '';
  const dossier = selected ? countryDossier(selected) : null;
  const measured = selected ? countryResources(selected).measured.length > 0 : false;
  const eu = selected && (EU_MEMBERS as readonly string[]).includes(selected);
  const connected = selected ? neighbors('country', selected).slice(0, 12) : [];
  const insights = worldInsights();
  const graphNodes = [
    ...((dossier?.relatedBottlenecks ?? []).map((b) => ({
      href: b.href,
      label: b.label,
      kind: 'bottleneck',
    })) ?? []),
    ...((dossier?.organisations ?? []).map((o) => ({
      href: o.href,
      label: o.label,
      kind: 'company',
    })) ?? []),
  ];

  // The map, the controls and the panel's frame and title are the atlas'
  // (app/atlas/page.tsx); this renders what the panel says about the place.
  return (
    <div className="world-panel">
      {dossier ? (
        <>
          <p className="world-roles">{dossier.roles.join(' · ')}</p>
          {!measured && dossier.why && (
            // The directory sentence is an interpretation, not a figure: shown
            // only when no production table lists the country, and labelled.
            <p className="world-why">
              <span className="resource-unit">Directory note, not a finding: </span>
              {dossier.why}
            </p>
          )}
          {graphNodes.length > 0 && (
            <figure
              className="country-graph"
              dangerouslySetInnerHTML={{ __html: countryDiagram(dossier.name, graphNodes) }}
            />
          )}
          <CountryResources iso2={dossier.iso2} selected={resource} />
          <CountryAccess iso2={dossier.iso2} />
          <Peers iso2={dossier.iso2} prefer={resource} />
          {dossier.relatedBottlenecks.length > 0 && (
            <section className="mt-5">
              <h3>Related bottlenecks</h3>
              <ul>
                {dossier.relatedBottlenecks.map((b) => (
                  <li key={b.href}>
                    <Link href={b.href}>{b.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {dossier.organisations.length > 0 && (
            <section className="mt-5">
              <h3>Organisations</h3>
              <ul>
                {dossier.organisations.map((org) => (
                  <li key={org.href}>
                    <Link href={org.href}>{org.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {dossier.instruments.length > 0 && (
            <section className="mt-5">
              <h3>Rules</h3>
              <ul>
                {dossier.instruments.map((row) => (
                  <li key={row.href + row.label}>
                    <Link href={row.href}>{row.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {eu && (
            <p className="mt-3 text-sm text-fg-tertiary">
              EU instruments are included because this state is a member.{' '}
              <Link href={policyHref('eu')}>EU policy →</Link>
            </p>
          )}
          {dossier.events.length > 0 && (
            <section className="mt-5">
              <h3>Events</h3>
              <ul>
                {dossier.events.map((event) => (
                  <li key={event.date + event.headline}>
                    <span className="font-mono text-xs">{event.date}</span> {event.headline}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {connected.length > 0 && (
            <section className="mt-5">
              <h3>Connected</h3>
              <ul>
                {connected.map((edge) => (
                  <li key={edge.rel + edge.to.href}>
                    {edge.rel} <Link href={edge.to.href}>{edge.to.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!dossier.hasAnything && (
            <p className="mt-4 text-sm">
              No mineral directory row and no corpus row yet. The gap is the point — send what you
              know.
            </p>
          )}
          <p className="mt-4 text-sm">
            <Link href="/chat">Ask about {dossier.name} →</Link>
          </p>
          <div className="mt-6">
            <Inquire topic={`country:${dossier.iso2}`} />
          </div>
        </>
      ) : (
        <div>
          <h2>The world, as recorded</h2>
          <p className="world-why">
            {insights.onMap} countries on the map. {insights.withDirectory} have a geology directory
            row. {insights.withCorpus} appear in the research corpus. {insights.gaps} are still
            gaps. Paint is coverage, not importance.
          </p>
          <h3>Directory minerals</h3>
          <ul className="resource-chips">
            {insights.resources.slice(0, 12).map((r) => (
              <li key={r.id}>
                <Link href={`/atlas?view=world&resource=${r.id}`}>
                  {r.label} {r.count}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-fg-tertiary">
            Open any country. Lithium countries link to the lithium-chemicals bottleneck. Uranium
            countries link to the fuel cycle. Grey still opens a dossier.
          </p>
        </div>
      )}
    </div>
  );
}
