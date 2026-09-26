/**
 * Cross-dataset consistency: where two datasets state the same fact, they
 * must agree. A disagreement is listed, not auto-resolved — one of the two is
 * wrong, or they describe different things, and a person decides which.
 */
import producers from '@/research/usgs-producers.json';
import mcs from '@/research/usgs-mcs.json';
import { RESOURCE_TO_BOTTLENECKS } from '@/config/substrata-resources';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { bottleneckHref } from '@/lib/links';
import type { UsgsChapter } from '@/lib/resources/usgs';
import { judge, type CheckResult } from './types';

const STOP = new Set([
  'the',
  'co',
  'corp',
  'corporation',
  'inc',
  'ltd',
  'limited',
  'plc',
  'group',
  'sa',
  'ag',
  'nv',
  'se',
  'holdings',
  'company',
  'and',
  'of',
  'resources',
  'materials',
  'metals',
  'mining',
  'rare',
  'earths',
  'earth',
  'international',
]);

/** The words that identify a company in someone else's table: "Lynas Rare Earths" → ["lynas"]. */
export function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export function namedIn(name: string, aliases: readonly string[], text: string): boolean {
  const hay = ` ${nameWords(text).join(' ')} `;
  return [name, ...aliases].some((n) => {
    const words = nameWords(n);
    return words.length > 0 && hay.includes(` ${words[0]} `);
  });
}

/** Producer rows on bottlenecks fed by a resource, one per (row, jurisdiction). */
function rowsByResource() {
  return Object.entries(RESOURCE_TO_BOTTLENECKS).flatMap(([resource, names]) =>
    BOTTLENECKS.filter((b) => names?.includes(b.name)).flatMap((b) =>
      b.producers
        .filter((p) => !p.supplier)
        .flatMap((p) => p.jurisdictions.map((j) => ({ resource, b, p, iso2: j.toLowerCase() }))),
    ),
  );
}

export function crossChecks(): CheckResult[] {
  const chapters = producers.countries;
  const yearbook = rowsByResource().flatMap((r) => {
    const chapter = chapters.find((c) => c.iso2 === r.iso2);
    const facilities = chapter?.facilities.filter((f) => f.resource === r.resource) ?? [];
    // Comparable only for mining rows where USGS prints facilities for this
    // resource in this country: a refiner or converter is a different product
    // (polysilicon is not silicon metal, GOES is not iron ore) and would read
    // as a disagreement that is not one.
    return chapter && facilities.length > 0 && r.p.role.toLowerCase().startsWith('mine')
      ? [{ ...r, chapter, facilities }]
      : [];
  });
  const table = mcs.chapters as unknown as UsgsChapter[];
  const mined = rowsByResource().flatMap((r) => {
    const ch = table.find((c) => c.resource === r.resource);
    return ch && r.p.role.toLowerCase().startsWith('mine') ? [{ ...r, ch }] : [];
  });
  return [
    judge(
      {
        dataset: 'producers',
        criterion: 'consistency',
        check: 'producers/in-usgs-yearbook',
        label:
          'A mining row is named in the USGS Minerals Yearbook table for that country and resource',
      },
      yearbook,
      ({ b, p, iso2, chapter, facilities }) =>
        facilities.some((f) => namedIn(p.name, [], f.companies))
          ? null
          : {
              row: `${b.name}: ${p.name} (${iso2.toUpperCase()})`,
              problem: `USGS ${chapter.year} lists ${facilities.length} ${facilities[0].commodity.toLowerCase()} facilit${facilities.length === 1 ? 'y' : 'ies'} there; none names this company`,
              link: chapter.url,
              page: bottleneckHref(b.slug),
            },
    ),
    judge(
      {
        dataset: 'producers',
        criterion: 'consistency',
        check: 'producers/in-usgs-mcs',
        label:
          'A mining row’s country is one USGS Mineral Commodity Summaries lists as producing that resource',
      },
      mined,
      ({ b, p, iso2, ch }) => {
        const row = ch.rows.find((r) => r.iso2 === iso2);
        const produces =
          row && Object.values(row.cells).some((c) => (c.value ?? 0) > 0 || c.withheld);
        return produces
          ? null
          : {
              row: `${b.name}: ${p.name} (${iso2.toUpperCase()})`,
              problem: `USGS MCS lists no ${ch.commodity.toLowerCase()} production for this country`,
              link: ch.url,
              page: bottleneckHref(b.slug),
            };
      },
    ),
  ];
}
