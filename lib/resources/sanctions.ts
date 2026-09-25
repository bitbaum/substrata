/**
 * Market access at country level: which sanctions regimes name a country, and
 * which of their measures name a resource.
 *
 * Sources: research/sanctions.json (EU Sanctions Map regimes and OFAC country
 * programs, scripts/research/sanctions.py) and config/substrata-sanctions.ts
 * (hand-recorded resource measures, each with a quote). A regime is scoped by
 * its measures — an asset freeze on listed persons is not an embargo on the
 * country — so the panel shows measure types, never "sanctioned: yes".
 */
import data from '@/research/sanctions.json';
import { RESOURCE_SANCTIONS, type ResourceSanction } from '@/config/substrata-sanctions';

export interface EuMeasure {
  type: string;
  text: string;
}

export interface EuRegime {
  id: number;
  iso2: string;
  adoptedBy: string;
  title: string;
  amended: string | null;
  url: string;
  legalActs: { title: string; number: string | null; url: string | null }[];
  measures: EuMeasure[];
}

export interface OfacProgram {
  iso2: string;
  title: string;
  url: string;
}

const FILE = data as unknown as {
  retrieved: string;
  eu: { source: string; api: string; regimes: EuRegime[] };
  us: { source: string; url: string; programs: OfacProgram[] };
  gaps: string[];
};

export const SANCTIONS_SOURCE = {
  retrieved: FILE.retrieved,
  eu: { label: FILE.eu.source, url: 'https://www.sanctionsmap.eu/' },
  us: { label: FILE.us.source, url: FILE.us.url },
  gaps: FILE.gaps,
};

/** Words that tie a goods measure to a resource. Matched on the measure's type and text. */
const RESOURCE_WORDS: Record<string, RegExp> = {
  iron: /\biron\b/i,
  gold: /\bgold\b/i,
  diamonds: /diamond/i,
  oil: /crude oil|petroleum/i,
  'natural-gas': /natural gas|liquefied natural gas|liquified natural gas/i,
  coal: /\bcoal\b/i,
  copper: /\bcopper\b/i,
  nickel: /\bnickel\b/i,
  silver: /\bsilver\b/i,
  'rare-earths': /rare[- ]earth/i,
  bauxite: /\balumini?um\b|bauxite/i,
  graphite: /graphite/i,
  uranium: /uranium/i,
  helium: /helium/i,
  phosphates: /phosphat/i,
};

/** A goods measure restricts buying from, or selling to, the country. */
const GOODS = /import|purchase|procure|export|sell|supply/i;

export interface SanctionHit {
  by: 'EU' | 'US' | 'UK';
  type: string;
  text: string;
  /** Regime title (EU) or source label (hand-recorded). */
  regime: string;
  url: string;
  date: string | null;
}

export function euRegimesFor(iso2: string): EuRegime[] {
  const id = iso2.toLowerCase();
  return FILE.eu.regimes.filter((r) => r.iso2 === id);
}

export function ofacProgramsFor(iso2: string): OfacProgram[] {
  const id = iso2.toLowerCase();
  return FILE.us.programs.filter((p) => p.iso2 === id);
}

/** The measure types a regime applies, deduplicated, in the register's order. */
export function measureTypes(regime: EuRegime): string[] {
  return [...new Set(regime.measures.map((m) => m.type))];
}

/** Sanctions measures that name this resource, for this country. */
export function sanctionsOn(iso2: string, resource: string): SanctionHit[] {
  const words = RESOURCE_WORDS[resource];
  const eu: SanctionHit[] = words
    ? euRegimesFor(iso2).flatMap((regime) =>
        regime.measures
          .filter((m) => GOODS.test(m.text) && (words.test(m.type) || words.test(m.text)))
          .map((m) => ({
            by: 'EU' as const,
            type: m.type,
            text: m.text,
            regime: regime.title,
            url: regime.url,
            date: regime.amended,
          })),
      )
    : [];
  const recorded = RESOURCE_SANCTIONS.filter(
    (row: ResourceSanction) => row.iso2 === iso2.toLowerCase() && row.resources.includes(resource),
  ).map((row) => ({
    by: row.by,
    type: 'Import and exchange restrictions',
    text: row.quote,
    regime: row.sourceLabel,
    url: row.source,
    date: row.date,
  }));
  return [...recorded, ...eu];
}
