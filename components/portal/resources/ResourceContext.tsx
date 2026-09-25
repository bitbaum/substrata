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
/** Restrictions and sanctions can run to dozens of rows; the rest live on /resources/[slug]. */
const SHOW_MEASURES = 3;

/** The first sentence of a long register text; the link carries the rest. */
function firstSentence(text: string): string {
  const m = text.match(/^.*?[.;](?=\s|$)/);
  return m ? m[0] : text;
}

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
            {usgs.rows.length > SHOW && `, ${usgs.rows.length - SHOW} more rows`}. Capacity as
            printed: the table says “{usgs.unit.toLowerCase()}”, and names other units line by line
            — read the unit in the table.{' '}
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
      {rows.slice(0, SHOW_MEASURES).map((m, i) => (
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
              <span title={m.document ?? undefined}>Legal text ↗</span>
            </a>
          )}
        </li>
      ))}
      {rows.length > SHOW_MEASURES && (
        <li>
          <Link href={`/resources/${resource}#restrictions-${iso2}`}>
            All {rows.length} measures →
          </Link>
        </li>
      )}
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
          <span className="resource-strong">{h.by}</span> · {h.type}: {firstSentence(h.text)}{' '}
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

/**
 * Only blocks with something sourced are rendered. A heading followed by "not
 * recorded", four times per resource, read as 25 empty rows on Russia's panel
 * (2026-09-25): the absence is still stated, once, in one line that names what
 * was looked for and in which sources.
 */
export function ResourceContext({ iso2, resource }: { iso2: string; resource: string }) {
  const usgsFacilities = facilitiesFor(iso2, resource);
  const hasProducers =
    Boolean(usgsFacilities?.rows.length) || corpusProducersFor(iso2, resource).length > 0;
  const hasConstraints =
    usgsStatements(iso2, resource).length + corpusEvents(iso2, resource).length > 0;
  const hasRestrictions = restrictionsFor(iso2, resource).length > 0;
  const hasSanctions = sanctionsOn(iso2, resource).length > 0;

  const missing = [
    !hasProducers &&
      `producers (${usgsFacilities ? `USGS ${usgsFacilities.year} country chapter` : 'no USGS country chapter read'}, corpus)`,
    !hasConstraints && 'constraints or changes (USGS, accepted events)',
    !hasRestrictions &&
      (inInventory(iso2)
        ? `export restrictions (OECD ${RESTRICTIONS_SOURCE.dataYear})`
        : `export restrictions (country not in the OECD ${RESTRICTIONS_SOURCE.dataYear} inventory)`),
    !hasSanctions && 'EU or US sanctions naming it',
  ].filter((m): m is string => Boolean(m));

  return (
    <div className="resource-context">
      {hasProducers && (
        <>
          <h4>Who produces it</h4>
          <Producers iso2={iso2} resource={resource} />
        </>
      )}
      {hasConstraints && (
        <>
          <h4>Constraints and changes, as the sources state them</h4>
          <Constraints iso2={iso2} resource={resource} />
        </>
      )}
      {hasRestrictions && (
        <>
          <h4>Export restrictions (OECD, {RESTRICTIONS_SOURCE.dataYear} data)</h4>
          <Restrictions iso2={iso2} resource={resource} />
        </>
      )}
      {hasSanctions && (
        <>
          <h4>Sanctions that name it</h4>
          <Sanctions iso2={iso2} resource={resource} />
        </>
      )}
      {missing.length > 0 && (
        <p className="resource-empty">Not in the sources read: {missing.join(' · ')}.</p>
      )}
    </div>
  );
}
