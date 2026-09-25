/**
 * Around the numbers for one resource in one country: who produces it, what
 * the exporting state restricts, which sanctions name it, and what the sources
 * say holds production back. Each block is sourced or says "not recorded".
 */
import Link from 'next/link';
import { facilitiesFor, corpusProducersFor } from '@/lib/resources/producers';
import {
  restrictionsFor,
  restrictionSummary,
  inInventory,
  RESTRICTIONS_SOURCE,
} from '@/lib/resources/restrictions';
import { sanctionsOn } from '@/lib/resources/sanctions';
import { corpusEvents, usgsStatements } from '@/lib/resources/statements';

const SHOW = 6;

function Producers({ iso2, resource }: { iso2: string; resource: string }) {
  const usgs = facilitiesFor(iso2, resource);
  const corpus = corpusProducersFor(iso2, resource);
  if (!usgs?.rows.length && corpus.length === 0)
    return (
      <p className="resource-empty">
        Not recorded
        {usgs ? ` in the USGS ${usgs.year} country chapter` : ' (no USGS country chapter read)'} or
        the corpus.
      </p>
    );
  return (
    <>
      {usgs && usgs.rows.length > 0 && (
        <>
          <ul className="resource-list">
            {usgs.rows.slice(0, SHOW).map((f, i) => (
              <li key={i}>
                <span className="resource-strong">{f.companies}</span> — {f.commodity.toLowerCase()}
                , {f.location}
                {f.capacity && f.capacity !== 'NA' && (
                  <span className="resource-unit"> capacity {f.capacity}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="resource-source">
            USGS Minerals Yearbook {usgs.year}, {usgs.table}
            {usgs.rows.length > SHOW && `, ${usgs.rows.length - SHOW} more rows`}. Capacity in{' '}
            {usgs.unit.toLowerCase()}.{' '}
            <a href={usgs.pdf} rel="noopener noreferrer" target="_blank">
              Chapter ↗
            </a>{' '}
            <a href={usgs.url} rel="noopener noreferrer" target="_blank">
              Table ↗
            </a>
          </p>
        </>
      )}
      {corpus.length > 0 && (
        <ul className="resource-list">
          {corpus.map((p) => (
            <li key={p.name + p.bottleneck}>
              {p.href ? <Link href={p.href}>{p.name}</Link> : p.name} —{' '}
              <Link href={p.bottleneckHref}>{p.bottleneck}</Link>, {p.role.toLowerCase()} (
              {p.verification})
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Restrictions({ iso2, resource }: { iso2: string; resource: string }) {
  const rows = restrictionsFor(iso2, resource);
  if (rows.length === 0)
    return (
      <p className="resource-empty">
        {inInventory(iso2)
          ? `None recorded for this resource in the OECD inventory (${RESTRICTIONS_SOURCE.dataYear} data).`
          : `This country is not covered by the OECD inventory (${RESTRICTIONS_SOURCE.dataYear} data).`}
      </p>
    );
  return (
    <ul className="resource-list">
      {rows.slice(0, SHOW).map((m, i) => (
        <li key={i}>
          {restrictionSummary(m)}
          {m.lines.some((l) => l.sharedWith) && (
            <span className="resource-unit">
              {' '}
              HS line shared with {m.lines.find((l) => l.sharedWith)?.sharedWith}
            </span>
          )}
          {m.purpose && (
            <span className="resource-unit"> Stated purpose: {m.purpose.toLowerCase()}</span>
          )}{' '}
          {m.link && (
            <a href={m.link} rel="noopener noreferrer" target="_blank">
              {m.document ?? 'Legal text'} ↗
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function Sanctions({ iso2, resource }: { iso2: string; resource: string }) {
  const hits = sanctionsOn(iso2, resource);
  if (hits.length === 0)
    return <p className="resource-empty">No EU or US measure found that names this resource.</p>;
  return (
    <ul className="resource-list">
      {hits.map((h, i) => (
        <li key={i}>
          <span className="resource-strong">{h.by}</span> · {h.type}: {h.text}{' '}
          <a href={h.url} rel="noopener noreferrer" target="_blank">
            {h.date ? `${h.date} ↗` : 'Source ↗'}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Constraints({ iso2, resource }: { iso2: string; resource: string }) {
  const usgs = usgsStatements(iso2, resource);
  const events = corpusEvents(iso2, resource);
  if (usgs.length + events.length === 0)
    return (
      <p className="resource-empty">
        Not recorded: no sourced statement about this country in the sources read.
      </p>
    );
  return (
    <ul className="resource-list">
      {usgs.map((s, i) => (
        <li key={`u${i}`}>
          “{s.text}”{' '}
          <a href={s.source} rel="noopener noreferrer" target="_blank" title={s.sourceLabel}>
            USGS ↗
          </a>
        </li>
      ))}
      {events.slice(0, SHOW).map((e, i) => (
        <li key={`e${i}`}>
          <span className="font-mono text-xs">{e.date}</span> {e.text}{' '}
          <a href={e.source} rel="noopener noreferrer" target="_blank">
            {e.primary ? 'Primary source ↗' : 'Source ↗'}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ResourceContext({ iso2, resource }: { iso2: string; resource: string }) {
  return (
    <div className="resource-context">
      <h4>Who produces it</h4>
      <Producers iso2={iso2} resource={resource} />
      <h4>Constraints and changes, as the sources state them</h4>
      <Constraints iso2={iso2} resource={resource} />
      <h4>Export restrictions (OECD, {RESTRICTIONS_SOURCE.dataYear} data)</h4>
      <Restrictions iso2={iso2} resource={resource} />
      <h4>Sanctions that name it</h4>
      <Sanctions iso2={iso2} resource={resource} />
    </div>
  );
}
