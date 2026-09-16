/**
 * Country facts for the world map: policy, organisations, events and
 * materials, keyed by ISO 3166-1 alpha-2. The EU is not a country on the
 * map, so its instruments colour every member state and stay listed when
 * any member is opened.
 */
import { EVENTS } from '@/config/substrata-events';
import {
  INSTRUMENTS,
  JURISDICTION_LABEL,
  hasPolicyPage,
  type JurisdictionId,
} from '@/config/substrata-policy';
import { COVERAGE } from '@/config/substrata-coverage';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { WORLD_PATHS } from '@/config/world-paths';
import { policyHref, bottleneckHref, marketHref } from '@/lib/links';
import {
  COUNTRY_RESOURCES,
  RESOURCE_DIRECTORY_NOTE,
  RESOURCE_TO_BOTTLENECKS,
  resourceLabel,
  resourcesFor,
  type ResourceId,
} from '@/config/substrata-resources';
import { COUNTRIES, countryIndex, type PathRole } from '@/config/substrata-countries';
import { BOTTLENECKS } from '@/lib/bottlenecks';

/** Current EU member states. Used only to paint EU instruments onto the map. */
export const EU_MEMBERS = [
  'at',
  'be',
  'bg',
  'hr',
  'cy',
  'cz',
  'dk',
  'ee',
  'fi',
  'fr',
  'de',
  'gr',
  'hu',
  'ie',
  'it',
  'lv',
  'lt',
  'lu',
  'mt',
  'nl',
  'pl',
  'pt',
  'ro',
  'sk',
  'si',
  'es',
  'se',
] as const;

export type CountryFact = {
  iso2: string;
  name: string;
  instruments: number;
  organisations: number;
  events: number;
  materials: number;
  policyHref: string | null;
  hasRecord: boolean;
};

function norm(code: string): string {
  return code.trim().toLowerCase();
}

function nameFor(iso2: string): string {
  if (iso2 === 'eu') return JURISDICTION_LABEL.eu;
  const path = WORLD_PATHS.find((p) => p.iso2 === iso2);
  if (path?.name) return path.name;
  const id = iso2 as JurisdictionId;
  return JURISDICTION_LABEL[id] ?? iso2.toUpperCase();
}

export function countryFacts(): Map<string, CountryFact> {
  const facts = new Map<string, CountryFact>();
  const ensure = (iso2: string) => {
    const id = norm(iso2);
    if (!id) return null;
    let row = facts.get(id);
    if (!row) {
      row = {
        iso2: id,
        name: nameFor(id),
        instruments: 0,
        organisations: 0,
        events: 0,
        materials: 0,
        policyHref: hasPolicyPage(id) ? policyHref(id) : null,
        hasRecord: false,
      };
      facts.set(id, row);
    }
    return row;
  };

  for (const instrument of INSTRUMENTS) {
    const row = ensure(instrument.jurisdiction);
    if (row) {
      row.instruments += 1;
      row.hasRecord = true;
    }
    if (instrument.jurisdiction === 'eu') {
      for (const member of EU_MEMBERS) {
        const m = ensure(member);
        if (m) {
          m.instruments += 1;
          m.hasRecord = true;
        }
      }
    }
  }

  for (const org of MARKET_PARTICIPANTS) {
    for (const code of org.jurisdictions) {
      const row = ensure(code);
      if (row) {
        row.organisations += 1;
        row.hasRecord = true;
      }
    }
  }

  for (const event of EVENTS) {
    for (const code of event.jurisdictions) {
      const row = ensure(code);
      if (row) {
        row.events += 1;
        row.hasRecord = true;
      }
    }
  }

  for (const material of COVERAGE) {
    for (const producer of material.producers) {
      for (const code of producer.jurisdictions) {
        const row = ensure(code);
        if (row) {
          row.materials += 1;
          row.hasRecord = true;
        }
      }
    }
  }

  return facts;
}

export function factFor(iso2: string): CountryFact | null {
  return countryFacts().get(norm(iso2)) ?? null;
}

export type CountryLink = { href: string; label: string };

export type CountryDossier = {
  iso2: string;
  name: string;
  region: string;
  roles: PathRole[];
  why: string;
  resources: { id: ResourceId; label: string }[];
  relatedBottlenecks: CountryLink[];
  organisations: CountryLink[];
  events: { date: string; headline: string }[];
  instruments: CountryLink[];
  similar: CountryLink[];
  corpus: CountryFact;
  directoryNote: string;
  hasAnything: boolean;
};

export function countryDossier(iso2: string): CountryDossier | null {
  const id = norm(iso2);
  if (!id) return null;
  const path = WORLD_PATHS.find((p) => p.iso2 === id);
  const fact = factFor(id);
  const endowment = resourcesFor(id);
  const index = countryIndex(id);
  const name = path?.name ?? index?.name ?? fact?.name ?? nameFor(id);
  const eu = (EU_MEMBERS as readonly string[]).includes(id);
  const derivedNames = [
    ...(endowment?.relatedBottlenecks ?? []),
    ...(endowment?.resources ?? []).flatMap((r) => RESOURCE_TO_BOTTLENECKS[r] ?? []),
  ];
  const related = [...new Set(derivedNames)]
    .map((n) => BOTTLENECKS.find((b) => b.name === n))
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .map((b) => ({ href: bottleneckHref(b.slug), label: b.name }));
  const similar = (endowment?.resources ?? [])
    .flatMap((r) =>
      COUNTRIES.filter(
        (row) =>
          row.iso2 && row.iso2 !== id && (resourcesFor(row.iso2)?.resources.includes(r) ?? false),
      ).map((row) => row.iso2),
    )
    .filter((iso, i, all) => all.indexOf(iso) === i)
    .slice(0, 8)
    .map((iso) => ({
      href: `/atlas?view=world&country=${iso}`,
      label: WORLD_PATHS.find((p) => p.iso2 === iso)?.name ?? iso.toUpperCase(),
    }));
  const roles = new Set<PathRole>(index?.roles ?? []);
  if (endowment?.resources.length) roles.add('extract');
  if (fact?.hasRecord) roles.add('research');
  roles.delete('gap');
  if (roles.size === 0) roles.add('gap');
  const organisations = MARKET_PARTICIPANTS.filter((p) =>
    p.jurisdictions.some((j) => j.toLowerCase() === id),
  )
    .slice(0, 12)
    .map((p) => ({ href: marketHref(p.slug), label: p.name }));
  const events = EVENTS.filter((e) =>
    e.jurisdictions.some((j) => j.toLowerCase() === id || (eu && j.toLowerCase() === 'eu')),
  )
    .slice(0, 8)
    .map((e) => ({ date: e.date, headline: e.headline }));
  const instruments = INSTRUMENTS.filter(
    (i) => i.jurisdiction === id || (eu && i.jurisdiction === 'eu'),
  )
    .slice(0, 8)
    .map((i) => ({
      href: policyHref(i.jurisdiction),
      label: i.title,
    }));
  const why =
    endowment?.why ??
    (fact?.hasRecord
      ? 'This country appears in the research corpus. Open the rows below.'
      : 'No geology directory row and no corpus row yet. That is a gap, not a judgement that the place is unimportant.');
  const resources = (endowment?.resources ?? []).map((r) => ({ id: r, label: resourceLabel(r) }));
  const corpus: CountryFact = fact ?? {
    iso2: id,
    name,
    instruments: instruments.length,
    organisations: organisations.length,
    events: events.length,
    materials: 0,
    policyHref: hasPolicyPage(id) ? policyHref(id) : null,
    hasRecord: organisations.length + events.length + instruments.length > 0,
  };
  return {
    iso2: id,
    name,
    region: index?.region ?? 'Unassigned',
    roles: [...roles],
    why,
    resources,
    relatedBottlenecks: related,
    organisations,
    events,
    instruments,
    similar,
    corpus,
    directoryNote: RESOURCE_DIRECTORY_NOTE,
    hasAnything: resources.length + related.length + organisations.length + events.length > 0,
  };
}

export function worldInsights() {
  const facts = countryFacts();
  const onMap = COUNTRIES.filter((c) => c.iso2 && c.iso2 !== 'aq');
  const withDirectory = onMap.filter((c) => (resourcesFor(c.iso2)?.resources.length ?? 0) > 0);
  const withCorpus = onMap.filter((c) => facts.get(c.iso2)?.hasRecord);
  const tallies = new Map<string, number>();
  for (const c of onMap) {
    for (const r of resourcesFor(c.iso2)?.resources ?? []) {
      tallies.set(r, (tallies.get(r) ?? 0) + 1);
    }
  }
  const resources = [...tallies.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, label: resourceLabel(id), count }));
  return {
    onMap: onMap.length,
    withDirectory: withDirectory.length,
    withCorpus: withCorpus.length,
    gaps: onMap.length - withDirectory.length,
    resources,
  };
}

export function countriesWithResources(): Set<string> {
  return new Set(
    COUNTRIES.filter((c) => (resourcesFor(c.iso2)?.resources.length ?? 0) > 0).map((c) => c.iso2),
  );
}
