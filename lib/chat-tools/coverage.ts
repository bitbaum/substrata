/**
 * `coverage_of`: how much of a country's output the corpus can attribute to
 * named operators — the mass balance in lib/coverage, read by a tool, so
 * "how much of Kazakhstan's uranium can you attribute to named operators?" has
 * a computed, sourced answer instead of a guess.
 *
 * Every number travels with its basis, its caveat (capacity is not production)
 * and both sources; a resource that cannot be computed travels with the reason.
 */
import { SERIES_SPECS } from '../coverage/basis';
import {
  coverageFor,
  coverageOf,
  RATIO_CAVEAT,
  RATIO_LABEL,
  type Coverage,
} from '../coverage/ratio';
import { resolveIn } from '../entities/registry';
import { countryHref } from '@/lib/world/pages';
import { remember } from './ledger';
import { producerResource } from './producers';
import { norm } from './resolve';
import { str, type ChatTool } from './tool';

const MAX_ROWS = 8;

function resourceOf(text: string): string | undefined {
  const viaFacilities = producerResource(text);
  if (viaFacilities) return viaFacilities;
  const q = ` ${norm(text)} `;
  return [...new Set(SERIES_SPECS.map((s) => s.resource))].find((id) =>
    q.includes(` ${norm(id).replace(/s$/, '')}`),
  );
}

function shaped(c: Coverage) {
  const sources = {
    ...(c.national
      ? {
          national: {
            source: c.national.source,
            table: c.national.table,
            url: c.national.url,
            year: c.national.year,
            printed: c.national.printed,
            unit: c.national.unitQuote,
          },
        }
      : {}),
    ...(c.table
      ? { facilities: { source: 'USGS Minerals Yearbook', year: c.table.year, url: c.table.url } }
      : {}),
  };
  const attribution = {
    rows_with_named_operator: `${c.attribution.rowsWithOperator.count} of ${c.attribution.rowsWithOperator.of}`,
    named_operators_with_stated_owner: `${c.attribution.operatorsWithOwner.count} of ${c.attribution.operatorsWithOwner.of}`,
    flows: c.attribution.flows.status === 'cannot' ? c.attribution.flows.reason : 'computed',
  };
  const rows = c.rows.slice(0, MAX_ROWS).map((r) => ({
    location: r.location.slice(0, 140),
    capacity_printed: r.printed.trim() ? `${r.printed.trim()} ${r.unit}` : null,
    operators: r.operators.map((o) => o.name),
    counted:
      r.compared !== true
        ? `not compared: ${r.compared}`
        : r.figure && 'reason' in r.figure
          ? `not added: ${r.figure.reason}`
          : r.operators.length
            ? 'named'
            : 'listed, no stated operator',
  }));
  if (c.status === 'cannot')
    return {
      resource: c.label,
      computed: false,
      cannot_be_computed_because: c.reason,
      attribution,
      sources,
      rows,
    };
  return {
    resource: c.label,
    computed: true,
    ratio: `${Math.round(c.ratio * 100)}%`,
    ratio_is: RATIO_LABEL,
    caveat: RATIO_CAVEAT,
    basis: c.basis,
    working: `${c.named.capacity} ${c.unit} capacity at ${c.named.rows} row(s) with a named operator ÷ ${c.national.value} ${c.unit} national (${c.national.year})`,
    ...(c.yearGap
      ? { year_gap: `facility table ${c.table?.year}, national figure ${c.national.year}` }
      : {}),
    attribution,
    sources,
    rows,
    ...(c.rows.length > MAX_ROWS ? { more_rows: c.rows.length - MAX_ROWS } : {}),
  };
}

export const COVERAGE_TOOLS: ChatTool[] = [
  {
    name: 'coverage_of',
    description:
      "How complete the picture of a country's output is: for each resource (or the one given), the capacity of facilities with a stated operator over the national production figure (USGS, WNA), with the basis, both sources and the row-by-row working — or exactly why it cannot be computed. Also: how many facility rows name an operator and how many operators have a stated owner. Use for 'how much of X's uranium can you attribute to named operators', 'how good is your data on Y'.",
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'Country name, e.g. Kazakhstan' },
        resource: { type: 'string', description: 'e.g. uranium, copper; omit for every resource' },
      },
      required: ['country'],
    },
    label: (a) =>
      `Checking how complete the data is${str(a.resource) ? ` for ${str(a.resource)}` : ''}${str(a.country) ? ` in ${str(a.country)}` : ''}`,
    budget: 6000,
    run: async (a, env) => {
      const country = resolveIn('country', str(a.country));
      if (!country) return { error: `No country called "${str(a.country)}".` };
      const resource = str(a.resource) ? resourceOf(str(a.resource)) : undefined;
      if (str(a.resource) && !resource)
        return { error: `No coverage check is defined for "${str(a.resource)}".` };
      const list = resource ? [coverageFor(country.key, resource)] : coverageOf(country.key);
      remember(env.ledger, {
        title: `How complete is the picture: ${country.name}`,
        href: `${countryHref(country.key)}#coverage`,
        kind: 'country',
        evidence: 'Sourced',
        primary: list
          .flatMap((c) => [c.national?.url, c.table?.url])
          .filter((u): u is string => Boolean(u))
          .slice(0, 4),
      });
      return {
        country: country.name,
        page: `${countryHref(country.key)}#coverage`,
        resources: list.map(shaped),
      };
    },
  },
];
