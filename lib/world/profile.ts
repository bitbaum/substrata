/**
 * One country as a profile: what it produces (USGS/EIA shares and ranks),
 * who operates there, the rules it sets, the exports it restricts and the
 * sanctions that name it, and what has happened. Read once per page; the
 * header's tiles and the modules below both read this object, so a count at
 * the top is the length of the list it points to.
 */
import { EVENTS, type CoverageEvent } from '@/config/substrata-events';
import { INSTRUMENTS, type Instrument } from '@/config/substrata-policy';
import { resourceLabel } from '@/config/substrata-resources';
import type { PathRole } from '@/config/substrata-countries';
import { EU_MEMBERS, ROLE_WORDS, countryDossier, type CountryLink } from '@/lib/geo';
import { MARKET_PARTICIPANTS, type MarketParticipant } from '@/lib/participants';
import { countryResources, leadOf } from '@/lib/resources/country';
import { groupByResource } from '@/lib/resources/restriction-kinds';
import { countryNameOf } from './pages';
import { restrictionsFor, inInventory, type Restriction } from '@/lib/resources/restrictions';
import {
  euRegimesFor,
  ofacProgramsFor,
  type EuRegime,
  type OfacProgram,
} from '@/lib/resources/sanctions';

export interface ProducesRow {
  resource: string;
  label: string;
  /** Share of world output on the country's leading production series, 0–1. */
  share: number | null;
  rank: number;
  year: number;
  seriesLabel: string;
  /** USGS/EIA value as printed, with its unit. */
  text: string;
  unitLabel: string;
  estimated: boolean;
  /** Fractional change from the prior year, when the table has both. */
  change: number | null;
  /** Worth leading with: at least 1% of the world and within the top ten (lib/resources/country.ts). */
  significant: boolean;
}

export interface CountryProfile {
  iso2: string;
  name: string;
  region: string;
  roles: { id: PathRole; word: string }[];
  eu: boolean;
  /** The directory sentence, shown only when no table measures the country. */
  why: string | null;
  glance: { podium: number; companies: number; instruments: number; events: number };
  produces: ProducesRow[];
  /** Resources the directory names with no table listing the country. */
  unmeasured: { id: string; label: string }[];
  companies: MarketParticipant[];
  instruments: { instrument: Instrument; viaEu: boolean }[];
  restricts: {
    all: Restriction[];
    inInventory: boolean;
    byResource: ReturnType<typeof groupByResource>;
  };
  sanctions: { eu: EuRegime[]; us: OfacProgram[] };
  events: CoverageEvent[];
  relatedBottlenecks: CountryLink[];
}

const GRADE_ORDER = { chokepoint: 0, concentrated: 1, competitive: 2 } as const;

const cache = new Map<string, CountryProfile | null>();

/** Memoised per process: five modules and the header read the same country. */
export function countryProfile(iso2: string): CountryProfile | null {
  const id = iso2.toLowerCase();
  if (!cache.has(id)) cache.set(id, build(id));
  return cache.get(id) ?? null;
}

function build(id: string): CountryProfile | null {
  const dossier = countryDossier(id);
  if (!dossier) return null;
  const eu = (EU_MEMBERS as readonly string[]).includes(id);
  const { measured, unmeasured } = countryResources(id);
  const produces: ProducesRow[] = measured
    .map((f) => {
      const lead = leadOf(f.production) ?? f.production[0];
      if (!lead || lead.current.rank === null) return null;
      return {
        resource: f.resource,
        label: f.label,
        share: lead.current.share,
        rank: lead.current.rank,
        year: lead.year,
        seriesLabel: lead.label,
        text: lead.current.text,
        unitLabel: lead.unitLabel,
        estimated: lead.current.estimated,
        change: lead.change,
        significant: f.significant,
      };
    })
    .filter((r): r is ProducesRow => r !== null)
    // Significant rows first, then by share; a 0.1% share never sits above a
    // rank that matters.
    .sort(
      (a, b) =>
        Number(b.significant) - Number(a.significant) ||
        (b.share ?? -1) - (a.share ?? -1) ||
        a.rank - b.rank,
    );
  const companies = MARKET_PARTICIPANTS.filter((p) =>
    p.jurisdictions.some((j) => j.toLowerCase() === id),
  ).sort(
    (a, b) =>
      (a.scarcity ? GRADE_ORDER[a.scarcity] : 3) - (b.scarcity ? GRADE_ORDER[b.scarcity] : 3) ||
      a.name.localeCompare(b.name),
  );
  const instruments = [...INSTRUMENTS]
    .filter((i) => i.jurisdiction === id || (eu && i.jurisdiction === 'eu'))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((instrument) => ({ instrument, viaEu: instrument.jurisdiction !== id }));
  const events = [...EVENTS]
    .filter((e) => e.jurisdictions.some((j) => j.toLowerCase() === id || (eu && j === 'eu')))
    .sort((x, y) => y.date.localeCompare(x.date));
  const all = restrictionsFor(id);
  return {
    iso2: id,
    name: countryNameOf(id),
    region: dossier.region,
    roles: dossier.roles.map((r) => ({ id: r, word: ROLE_WORDS[r] })),
    eu,
    why: measured.length === 0 && dossier.why ? dossier.why : null,
    glance: {
      podium: produces.filter((r) => r.rank <= 3).length,
      companies: companies.length,
      instruments: instruments.length,
      events: events.length,
    },
    produces,
    unmeasured: unmeasured.map((u) => ({ id: u.id, label: u.label })),
    companies,
    instruments,
    restricts: {
      all,
      inInventory: inInventory(id),
      byResource: groupByResource(all, resourceLabel),
    },
    sanctions: { eu: euRegimesFor(id), us: ofacProgramsFor(id) },
    events,
    relatedBottlenecks: dossier.relatedBottlenecks,
  };
}
