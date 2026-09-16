import Link from 'next/link';
import { WORLD_PATHS } from '@/config/world-paths';
import { WorldMap } from './WorldMap';
import { Inquire } from './Inquire';
import { countryDossier } from '@/lib/geo';
import { neighbors } from '@/lib/graph';
import { EU_MEMBERS } from '@/lib/geo';
import { policyHref } from '@/lib/links';

export function WorldPanel({ country }: { country?: string }) {
  const selected = country?.toLowerCase() ?? '';
  const dossier = selected ? countryDossier(selected) : null;
  const eu = selected && (EU_MEMBERS as readonly string[]).includes(selected);
  const connected = selected ? neighbors('country', selected).slice(0, 12) : [];
  const options = WORLD_PATHS.filter((p) => p.iso2 && p.iso2 !== 'aq').sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="world-layout">
      <div>
        <form action="/atlas" className="world-find">
          <input type="hidden" name="view" value="world" />
          <label htmlFor="country-pick">Open a country</label>
          <select id="country-pick" name="country" defaultValue={selected}>
            <option value="">Choose…</option>
            {options.map((p) => (
              <option key={p.iso2} value={p.iso2}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit">Open</button>
        </form>
        <WorldMap selected={selected || undefined} />
        <ul className="world-legend">
          <li>
            <span className="swatch has-resource" /> Resource directory
          </li>
          <li>
            <span className="swatch has-corpus" /> Research corpus
          </li>
          <li>
            <span className="swatch is-active" /> Selected
          </li>
        </ul>
      </div>
      <aside className="world-panel">
        {dossier ? (
          <>
            <p className="research-kicker">{dossier.iso2.toUpperCase()}</p>
            <h2>{dossier.name}</h2>
            <p className="world-why">{dossier.why}</p>
            {dossier.resources.length > 0 && (
              <section className="mt-5">
                <h3>Natural resources</h3>
                <ul className="resource-chips">
                  {dossier.resources.map((r) => (
                    <li key={r.id}>{r.label}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-fg-tertiary">{dossier.directoryNote}</p>
              </section>
            )}
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
                <h3>Organisations in the corpus</h3>
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
                No directory row and no corpus row yet. That is a research gap.
              </p>
            )}
            <div className="mt-6">
              <Inquire topic={`country:${dossier.iso2}`} />
            </div>
          </>
        ) : (
          <p>
            Pick a country. Mineral fill is the geology directory. Stronger outline is a row we have
            actually researched. Grey is a gap — click it anyway.
          </p>
        )}
      </aside>
    </div>
  );
}
