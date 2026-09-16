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
import { policyHref } from '@/lib/links';

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
