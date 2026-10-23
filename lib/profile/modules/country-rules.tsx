import Link from 'next/link';

import { DetailsOpenWide } from '@/components/portal/DetailsOpenWide';
import { EventList } from '@/components/portal/EventList';
import { Figure } from '@/components/portal/Figure';
import { MeasureRows } from '@/components/portal/resources/MeasureRows';
import {
  INSTRUMENT_EFFECT_LABEL,
  INSTRUMENT_KIND_LABEL,
  INSTRUMENT_STATUS_LABEL,
} from '@/config/substrata-policy';
import { policyHref } from '../../links';
import { RESTRICTIONS_SOURCE } from '../../resources/restrictions';
import { SANCTIONS_SOURCE, measureTypes } from '../../resources/sanctions';
import type { CountryProfile } from '../../world/profile';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';
import { profile } from './country';

// What governs a country's part of the chain, from both directions: the
// instruments it issues, the exports it holds back, the sanctions that name
// it. And then what has happened.

/** The instruments it issues, newest first, with which way each moves the constraint. */
const rules: ProfileModule<CountryProfile> = {
  id: 'country-rules',
  title: t('profile.countryRules.title'),
  appliesTo: ['country'],
  importance: 40,
  load(entity) {
    const p = profile(entity);
    return p && p.instruments.length > 0 ? p : null;
  },
  evidence: (p) =>
    `${p.instruments.filter((i) => i.instrument.primary).length} of ${p.instruments.length} from the issuing body`,
  Render({ data: p }) {
    return (
      <>
        <ul className="place-rows">
          {p.instruments.map(({ instrument: i, viaEu }) => (
            <li key={i.id} className="place-row">
              <Link href={policyHref(i.jurisdiction)} className="place-row-name">
                {i.title}
              </Link>
              <p className="place-row-detail">
                {i.date} · {INSTRUMENT_KIND_LABEL[i.kind]} · {INSTRUMENT_STATUS_LABEL[i.status]}
                {viaEu ? ' · as an EU member' : ''}
              </p>
              <span className={`place-row-aside is-${i.effect}`}>
                {INSTRUMENT_EFFECT_LABEL[i.effect]}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <Link
            href={policyHref(p.eu && !p.instruments.some((i) => !i.viaEu) ? 'eu' : p.iso2)}
            className="link-target text-accent underline-offset-4 hover:underline"
          >
            The policy page →
          </Link>
        </p>
      </>
    );
  },
};

/**
 * Where it restricts and where it is restricted: the exports it holds back,
 * folded per resource by what the measure does, and the sanctions regimes
 * that name it. Absence from the OECD inventory is said as such.
 */
const access: ProfileModule<CountryProfile> = {
  id: 'access',
  title: t('profile.access.title'),
  appliesTo: ['country'],
  importance: 42,
  load(entity) {
    const p = profile(entity);
    return p && (p.restricts.all.length > 0 || p.sanctions.eu.length + p.sanctions.us.length > 0)
      ? p
      : null;
  },
  evidence: (p) =>
    [
      p.restricts.all.length > 0 ? `${p.restricts.all.length} export measures` : '',
      p.sanctions.eu.length + p.sanctions.us.length > 0
        ? `${p.sanctions.eu.length + p.sanctions.us.length} sanctions regime${p.sanctions.eu.length + p.sanctions.us.length === 1 ? '' : 's'}`
        : '',
    ]
      .filter(Boolean)
      .join(' · '),
  Render({ data: p }) {
    const { byResource, all } = p.restricts;
    const { eu, us } = p.sanctions;
    return (
      <>
        <h3 className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          Exports it restricts
        </h3>
        {all.length === 0 ? (
          <p className="resource-empty mt-1">
            {p.restricts.inInventory
              ? 'None recorded on the resources tracked here'
              : 'Not covered'}{' '}
            ({RESTRICTIONS_SOURCE.label}).
          </p>
        ) : (
          <>
            <p className="resource-line">
              <Figure source={RESTRICTIONS_SOURCE.url} sourceLabel={RESTRICTIONS_SOURCE.label}>
                {String(all.length)}
              </Figure>{' '}
              measures on {byResource.length} resource{byResource.length === 1 ? '' : 's'}; open a
              row for what each measure does.
            </p>
            <ul className="measure-countries">
              {byResource.map((r, i) => (
                <li key={r.resource}>
                  <DetailsOpenWide
                    className="measure-country"
                    openWide={i < 3}
                    summary={
                      <>
                        <span className="measure-country-name">{r.label}</span>
                        <span className="measure-country-meta">
                          {r.count} measure{r.count === 1 ? '' : 's'}
                        </span>
                      </>
                    }
                  >
                    <MeasureRows groups={r.byKind} />
                    <p className="measure-country-link">
                      <Link href={`/resources/${r.resource}#export-restrictions`}>
                        Who else restricts {r.label.toLowerCase()} →
                      </Link>
                    </p>
                  </DetailsOpenWide>
                </li>
              ))}
            </ul>
          </>
        )}
        <h3 className="mt-8 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          Sanctions that name it
        </h3>
        {eu.length + us.length === 0 ? (
          <p className="resource-empty mt-1">
            No EU regime and no OFAC country program. Thematic lists can still name its people and
            companies.
          </p>
        ) : (
          <ul className="place-rows mt-2">
            {eu.map((r) => (
              <li key={r.id} className="place-row">
                <a
                  href={r.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="place-row-name"
                >
                  {r.title} ↗
                </a>
                <p className="place-row-detail">
                  Applies: {measureTypes(r).join(', ').toLowerCase()}
                  {r.amended && (
                    <>
                      {' · '}
                      <span className="whitespace-nowrap">amended {r.amended}</span>
                    </>
                  )}
                </p>
                <span className="place-row-aside">EU</span>
              </li>
            ))}
            {us.map((pr) => (
              <li key={pr.url} className="place-row">
                <a
                  href={pr.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="place-row-name"
                >
                  {pr.title} ↗
                </a>
                <p className="place-row-detail">OFAC country program</p>
                <span className="place-row-aside">US</span>
              </li>
            ))}
          </ul>
        )}
        <p className="resource-source">
          Export measures: {RESTRICTIONS_SOURCE.label}, read {RESTRICTIONS_SOURCE.retrieved}.
          Sanctions read {SANCTIONS_SOURCE.retrieved} from the EU Sanctions Map and OFAC’s program
          list; a regime targets what its measures name, not the whole country.
        </p>
      </>
    );
  },
};

/** Accepted events in this jurisdiction (and the EU’s, for a member), newest first. */
const countryEvents: ProfileModule<CountryProfile> = {
  id: 'country-events',
  title: t('profile.countryEvents.title'),
  appliesTo: ['country'],
  importance: 80,
  load(entity) {
    const p = profile(entity);
    return p && p.events.length > 0 ? p : null;
  },
  evidence: (p) => `${p.events.length} dated`,
  Render({ data: p }) {
    return (
      <>
        <EventList events={p.events.slice(0, 12)} />
        <p className="mt-3 text-sm">
          <Link
            href="/events"
            className="link-target text-accent underline-offset-4 hover:underline"
          >
            {t('action.allEvents')}
          </Link>
        </p>
      </>
    );
  },
};

export { rules, access, countryEvents };
