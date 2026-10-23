/**
 * The actual places.
 *
 * The corpus said helium comes from "a few natural gas fields with unusual
 * composition" and named none of them, which reads as a mystery rather than
 * research: a reader cannot check a claim about places that are not named, and
 * the assistant could only answer "not in your data" when asked which fields.
 *
 * A facility earns a row the same way anything else does — a source that names
 * it. Three here, which is three more than before and far fewer than exist. The
 * gap is coverage, and coverage is visible; the alternative was a sentence that
 * implied knowledge nobody could inspect.
 */

export type FacilityKind = 'field' | 'plant' | 'mine' | 'refinery' | 'fab';

export const FACILITY_KIND_LABEL: Record<FacilityKind, string> = {
  field: 'Gas or oil field',
  plant: 'Processing plant',
  mine: 'Mine',
  refinery: 'Refinery',
  fab: 'Fabrication plant',
};

export interface Facility {
  /** Stable slug, used in the URL. */
  id: string;
  name: string;
  kind: FacilityKind;
  /** ISO-3166 alpha-2, lowercase. */
  place: string;
  /** Where in the country, in words, because a country is not a location. */
  where: string;
  /** Exact company name as the directory spells it, or null when unrecorded. */
  operator: string | null;
  /** Bottleneck slugs this place supplies. */
  makes: string[];
  /** What the source actually says about it. */
  what: string;
  source: string;
  primary: boolean;
  readOn: string;
}

const READ = '2026-09-17';
const USGS_HELIUM = 'https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-helium.pdf';

export const FACILITIES: readonly Facility[] = [
  {
    id: 'cliffside-field',
    name: 'Cliffside Field',
    kind: 'field',
    place: 'us',
    where: 'near Amarillo, Texas',
    // USGS describes the sale of the Federal Helium System and calls the buyer
    // "the new owner" without naming it here, so neither does this row.
    operator: null,
    makes: ['liquid-helium-he-4'],
    what: 'The United States Federal Helium System stored crude helium in the Bush Dome reservoir here. USGS reports it separately from helium extracted from natural gas: 13 million m³ withdrawn in 2024, against 50 million m³ of reserves, with the system sold out of Government hands in 2024.',
    source: USGS_HELIUM,
    primary: true,
    readOn: READ,
  },
  {
    id: 'labarge',
    name: 'LaBarge',
    kind: 'field',
    place: 'us',
    where: 'south-western Wyoming',
    operator: 'ExxonMobil',
    makes: ['liquid-helium-he-4'],
    what: 'ExxonMobil describes LaBarge as one of a very small number of gas fields with enough helium in the stream to justify extracting it — the company publishes the operation on its own site.',
    source:
      'https://corporate.exxonmobil.com/what-we-do/materials-for-modern-living/labarge-helium-extraction-energy-production-wyoming',
    primary: true,
    readOn: READ,
  },
  {
    id: 'orenburg-helium-plant',
    name: 'Orenburg helium plant',
    kind: 'plant',
    place: 'ru',
    where: 'Orenburg oblast',
    operator: 'Gazprom',
    makes: ['liquid-helium-he-4'],
    what: 'Gazprom documents the Orenburg plant as where helium is separated from its gas. Russia is recorded by USGS at 17 million m³ of helium production in 2024 against 1,700 million m³ of reserves; this plant is the long-standing part of that.',
    source: 'http://www.gazprominfo.de/terms/orenburg-helium-plant/',
    primary: true,
    readOn: READ,
  },
];

export function facilitiesFor(material: string): Facility[] {
  return FACILITIES.filter((facility) => facility.makes.includes(material));
}

export function facilityById(id: string): Facility | undefined {
  return FACILITIES.find((facility) => facility.id === id);
}
