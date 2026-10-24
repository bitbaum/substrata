/**
 * The jurisdictions an instrument can be recorded under.
 *
 * Ten are curated: each carries a one-line `detail` a person wrote about what
 * that jurisdiction decides in this map. Every other country on the map
 * (config/substrata-countries.ts) is a jurisdiction too, by its ISO2, so a
 * data agent can record Kazakhstan's subsoil law or Chile's lithium regime
 * without a code edit per country. Adding one asserts nothing about its law:
 * a derived jurisdiction's `detail` is one neutral generated line, and it is
 * listed beside the ten only once an adopted or in-force rule is recorded
 * under it (`isListedJurisdiction` in ./substrata-policy.ts).
 *
 * Created: 2026-10-24
 */

import { COUNTRIES } from './substrata-countries';

/** The ten written by hand. Their ids, order and lines do not change here. */
export type CuratedJurisdictionId =
  'us' | 'eu' | 'cn' | 'jp' | 'kr' | 'tw' | 'nl' | 'gb' | 'de' | 'ch';

declare const COUNTRY_JURISDICTION: unique symbol;

/**
 * A country on the map, as a jurisdiction. Branded so a bare string cannot
 * pass for one: it comes only from `isJurisdictionId` or this module's list.
 */
export type CountryJurisdictionId = string & { readonly [COUNTRY_JURISDICTION]: true };

export type JurisdictionId = CuratedJurisdictionId | CountryJurisdictionId;

export interface Jurisdiction {
  id: JurisdictionId;
  name: string;
  /** The name as it fits a tile, where the full one does not: "US", "EU", "UK". */
  short?: string;
  /** What this jurisdiction is, for the purposes of this map, in one line. */
  detail: string;
  /** True for a country taken from the map rather than written by hand. */
  derived?: true;
}

export const CURATED_JURISDICTIONS: readonly Jurisdiction[] = [
  {
    id: 'us',
    short: 'US',
    name: 'United States',
    detail: 'Sets the export rules most of the chip chain is written against.',
  },
  {
    id: 'eu',
    short: 'EU',
    name: 'European Union',
    detail: 'Trade defence, dual-use controls, and the first broad AI statute.',
  },
  {
    id: 'cn',
    name: 'China',
    detail: 'Holds the refining and magnet steps, and licenses their export.',
  },
  {
    id: 'jp',
    name: 'Japan',
    detail: 'Chemistry and precision machinery the rest of the chain qualifies against.',
  },
  { id: 'kr', name: 'South Korea', detail: 'Memory and wafer capacity.' },
  { id: 'tw', name: 'Taiwan', detail: 'Leading-edge foundry and advanced packaging.' },
  { id: 'nl', name: 'Netherlands', detail: 'The lithography chokepoint sits here.' },
  {
    id: 'gb',
    short: 'UK',
    name: 'United Kingdom',
    detail: 'Research base and grid connection reform.',
  },
  { id: 'de', name: 'Germany', detail: 'Optics, electrical steel and industrial gases.' },
  { id: 'ch', name: 'Switzerland', detail: 'Where this project is written.' },
];

/** The line every derived jurisdiction carries. It states no fact about the country. */
export const DERIVED_JURISDICTION_DETAIL =
  'Rules this country applies to its minerals, from instruments recorded here.';

const ISO2 = /^[a-z]{2}$/;
const CURATED_IDS = new Set<string>(CURATED_JURISDICTIONS.map((j) => j.id));

/** Every map country not already curated, by id. */
const DERIVED_JURISDICTIONS: readonly Jurisdiction[] = [
  ...new Map(
    COUNTRIES.filter((c) => ISO2.test(c.iso2) && !CURATED_IDS.has(c.iso2)).map((c) => [
      c.iso2,
      {
        id: c.iso2 as CountryJurisdictionId,
        name: c.name,
        detail: DERIVED_JURISDICTION_DETAIL,
        derived: true as const,
      },
    ]),
  ).values(),
].sort((a, b) => a.id.localeCompare(b.id));

/** The curated ten first, in their order, then every derived country by id. */
export const JURISDICTIONS: readonly Jurisdiction[] = [
  ...CURATED_JURISDICTIONS,
  ...DERIVED_JURISDICTIONS,
];

const BY_ID = new Map<string, Jurisdiction>(JURISDICTIONS.map((j) => [j.id, j]));

export function isJurisdictionId(id: string): id is JurisdictionId {
  return BY_ID.has(id);
}

export function jurisdictionById(id: string): Jurisdiction | undefined {
  return BY_ID.get(id);
}

export function isCuratedJurisdiction(id: string): id is CuratedJurisdictionId {
  return CURATED_IDS.has(id);
}

export const JURISDICTION_LABEL: Record<JurisdictionId, string> = Object.fromEntries(
  JURISDICTIONS.map((j) => [j.id, j.name]),
) as Record<JurisdictionId, string>;
