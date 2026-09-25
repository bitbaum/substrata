/**
 * Who produces a resource in a country, from two places that say different
 * things and are labelled apart:
 *
 * - USGS Minerals Yearbook country chapters, "Structure of the mineral
 *   industry" (research/usgs-producers.json): operating companies, equity
 *   owners, facilities and capacity as printed for the chapter's year.
 * - The corpus's own producer rows on the bottlenecks this resource feeds,
 *   with their verification state (sourced / candidate / unverified).
 */
import data from '@/research/usgs-producers.json';
import { RESOURCE_TO_BOTTLENECKS, type ResourceId } from '@/config/substrata-resources';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { bottleneckHref, marketHref } from '@/lib/links';
import { hasMarketPage } from '@/lib/participants';

export interface Facility {
  resource: string;
  group: string;
  commodity: string;
  companies: string;
  location: string;
  capacity: string;
}

interface CountryChapter {
  iso2: string;
  slug: string;
  year: string;
  url: string;
  pdf: string;
  table: string;
  unit: string;
  facilities: Facility[];
}

const FILE = data as unknown as {
  source: string;
  retrieved: string;
  note: string;
  gaps: string[];
  countries: CountryChapter[];
};

export const PRODUCERS_SOURCE = {
  label: FILE.source,
  retrieved: FILE.retrieved,
  note: FILE.note,
};

export interface CountryFacilities {
  year: string;
  url: string;
  pdf: string;
  table: string;
  unit: string;
  rows: Facility[];
}

/** USGS rows for one country and resource, or null when no chapter was read for the country. */
export function facilitiesFor(iso2: string, resource: string): CountryFacilities | null {
  const chapter = FILE.countries.find((c) => c.iso2 === iso2.toLowerCase());
  if (!chapter) return null;
  return {
    year: chapter.year,
    url: chapter.url,
    pdf: chapter.pdf,
    table: chapter.table,
    unit: chapter.unit,
    rows: chapter.facilities.filter((f) => f.resource === resource),
  };
}

export function hasYearbookChapter(iso2: string): boolean {
  return FILE.countries.some((c) => c.iso2 === iso2.toLowerCase());
}

export interface CorpusProducer {
  name: string;
  href: string | null;
  bottleneck: string;
  bottleneckHref: string;
  role: string;
  verification: string;
  source: string | null;
}

/** Corpus producer rows in this country on the bottlenecks the resource feeds. */
export function corpusProducersFor(iso2: string, resource: string): CorpusProducer[] {
  const id = iso2.toLowerCase();
  const names = RESOURCE_TO_BOTTLENECKS[resource as ResourceId] ?? [];
  return BOTTLENECKS.filter((b) => names.includes(b.name)).flatMap((b) =>
    b.producers
      .filter((p) => p.jurisdictions.some((j) => j.toLowerCase() === id))
      .map((p) => ({
        name: p.name,
        href: hasMarketPage(p.name) ? marketHref(p.name) : null,
        bottleneck: b.name,
        bottleneckHref: bottleneckHref(b.slug),
        role: p.role,
        verification: p.verification,
        source: p.source,
      })),
  );
}
