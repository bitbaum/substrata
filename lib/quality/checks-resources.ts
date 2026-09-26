/**
 * Pure checks on the country × resource tables: USGS MCS, EIA, the Minerals
 * Yearbook producer tables, the OECD restrictions inventory and sanctions.
 */
import mcs from '@/research/usgs-mcs.json';
import eia from '@/research/eia-energy.json';
import { RESOURCE_KINDS } from '@/config/substrata-resources';
import type { UsgsChapter } from '@/lib/resources/usgs';
import { inventoryChecks } from './checks-inventories';
import { judge, type CheckResult } from './types';

export { isFragment } from './checks-inventories';

const MCS = mcs.chapters as unknown as UsgsChapter[];
const EIA = eia.chapters as unknown as UsgsChapter[];
const RESOURCE_IDS = new Set<string>(RESOURCE_KINDS.map((r) => r.id));
const isIso2 = (c: unknown) => typeof c === 'string' && /^[a-z]{2}$/.test(c);
const resourcePage = (resource: string) => `/resources/${resource}`;

/** Countries plus "other countries" against USGS's own rounded world total (6% for rounding). */
export function sumProblems(ch: UsgsChapter): { column: string; problem: string | null }[] {
  const world = ch.rows.find((r) => r.kind === 'world');
  return ch.columns.map((col) => {
    const total = world?.cells[col.key]?.value;
    if (!world) return { column: col.key, problem: 'no world total row' };
    if (!total || world.cells[col.key]?.moreThan) return { column: col.key, problem: null };
    if (ch.rows.some((r) => r.cells[col.key]?.withheld)) return { column: col.key, problem: null };
    const sum = ch.rows
      .filter((r) => r.kind !== 'world')
      .reduce((n, r) => n + (r.cells[col.key]?.value ?? 0), 0);
    return {
      column: col.key,
      problem:
        Math.abs(sum - total) / total > 0.06
          ? `rows sum to ${sum.toLocaleString('en')}, world total is ${total.toLocaleString('en')}`
          : null,
    };
  });
}

function tableChecks(): CheckResult[] {
  const columns = MCS.flatMap((ch) => {
    const world = ch.rows.find((r) => r.kind === 'world');
    const summable = ch.columns.filter(
      (c) =>
        !world || (world.cells[c.key]?.value && !ch.rows.some((r) => r.cells[c.key]?.withheld)),
    );
    const problems = new Map(sumProblems(ch).map((p) => [p.column, p.problem]));
    return summable.map((c) => ({ ch, column: c.key, problem: problems.get(c.key) ?? null }));
  });
  const energyCells = EIA.flatMap((ch) => {
    const world = ch.rows.find((r) => r.kind === 'world');
    return ch.rows
      .filter((r) => r.kind === 'country')
      .flatMap((r) => ch.columns.map((c) => ({ ch, r, c, world: world?.cells[c.key]?.value })));
  });
  const cells = [...MCS, ...EIA].flatMap((ch) =>
    ch.rows.flatMap((r) => Object.entries(r.cells).map(([key, cell]) => ({ ch, r, key, cell }))),
  );
  const countryRows = [...MCS, ...EIA].flatMap((ch) =>
    ch.rows.filter((r) => r.kind === 'country').map((r) => ({ ch, r })),
  );
  return [
    judge(
      {
        dataset: 'usgs-mcs',
        criterion: 'correctness',
        check: 'usgs-mcs/world-sum',
        label: 'Each column’s countries add up to the printed world total (within 6% rounding)',
      },
      columns,
      ({ ch, column, problem }) =>
        problem
          ? {
              row: `${ch.commodity} ${column}`,
              problem,
              link: ch.url,
              page: resourcePage(ch.resource),
            }
          : null,
    ),
    judge(
      {
        dataset: 'eia-energy',
        criterion: 'correctness',
        check: 'eia-energy/below-world',
        label: 'No country produces more than the world total EIA prints',
      },
      energyCells,
      ({ ch, r, c, world }) =>
        world === undefined || (r.cells[c.key]?.value ?? 0) <= world
          ? null
          : {
              row: `${ch.commodity} ${c.key} ${r.name}`,
              problem: 'exceeds the world total',
              link: ch.url,
            },
    ),
    ...(['usgs-mcs', 'eia-energy'] as const).map((dataset) =>
      judge(
        {
          dataset,
          criterion: 'provenance',
          check: `${dataset}/cell-raw`,
          label:
            'Every value keeps the text it was printed as, and its table names its source and unit',
        },
        cells.filter(({ ch }) => (dataset === 'usgs-mcs') === MCS.includes(ch)),
        ({ ch, r, key, cell }) =>
          typeof cell.raw === 'string' &&
          cell.raw.length > 0 &&
          /^https:\/\//.test(ch.url) &&
          ch.table &&
          ch.unitQuote
            ? null
            : {
                row: `${ch.commodity} ${r.name} ${key}`,
                problem: 'no printed value, source, table or unit',
                link: ch.url,
              },
      ),
    ),
    ...(['usgs-mcs', 'eia-energy'] as const).map((dataset) =>
      judge(
        {
          dataset,
          criterion: 'consistency',
          check: `${dataset}/country-code`,
          label: 'Every country row maps to an ISO country code and a known resource',
        },
        countryRows.filter(({ ch }) => (dataset === 'usgs-mcs') === MCS.includes(ch)),
        ({ ch, r }) =>
          isIso2(r.iso2) && RESOURCE_IDS.has(ch.resource)
            ? null
            : {
                row: `${ch.commodity}: ${r.name}`,
                problem: 'no country code, or unknown resource',
                link: ch.url,
              },
      ),
    ),
  ];
}

export function resourceChecks(): CheckResult[] {
  return [...tableChecks(), ...inventoryChecks()];
}
