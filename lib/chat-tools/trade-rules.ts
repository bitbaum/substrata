/**
 * Export restrictions and sanctions, read from the research files the country
 * pages already draw (rung 2 of the answer ladder,
 * docs/architecture/2026-10-24-research-systems.md §1):
 *
 * - research/oecd-export-restrictions.json — the OECD inventory of export
 *   restrictions on critical raw materials, one row per recorded measure with
 *   the legal text it points to. Absence means "not recorded in the
 *   inventory", never "unrestricted".
 * - research/sanctions.json — EU Sanctions Map regimes and OFAC country
 *   programs. A regime is scoped by its measures: an asset freeze on listed
 *   persons is not an embargo on a country, so measure types are returned,
 *   never "sanctioned: yes". The person and entity annexes are not read.
 */
import { resolveIn } from '../entities/registry';
import {
  RESTRICTIONS_SOURCE,
  inInventory,
  restrictionSummary,
  restrictionsFor,
  restrictionsOn,
} from '../resources/restrictions';
import {
  SANCTIONS_SOURCE,
  euRegimesFor,
  measureTypes,
  ofacProgramsFor,
  sanctionsOn,
} from '../resources/sanctions';
import { producerResource } from './producers';
import { resourceIn } from './resources';
import { str, type ChatTool } from './tool';

const MAX = 10;

function resourceId(text: string): string | undefined {
  return resourceIn(text)?.resource ?? producerResource(text);
}

export const TRADE_RULE_TOOLS: ChatTool[] = [
  {
    name: 'restrictions_on',
    description:
      'Export restrictions on a raw material, from the OECD inventory of export restrictions on critical raw materials: which country restricts what (ban, quota, licence, tax), since when, the legal document and its link. Give `resource`, `country`, or both.',
    parameters: {
      type: 'object',
      properties: {
        resource: { type: 'string', description: 'e.g. gallium, graphite, nickel' },
        country: { type: 'string', description: 'The exporting country, e.g. China, Indonesia' },
      },
    },
    label: (a) =>
      `Reading export restrictions${str(a.resource) ? ` on ${str(a.resource)}` : ''}${str(a.country) ? ` in ${str(a.country)}` : ''}`,
    run: async (a) => {
      const resource = str(a.resource) ? resourceId(str(a.resource)) : undefined;
      const country = str(a.country) ? resolveIn('country', str(a.country)) : undefined;
      if (str(a.country) && !country) return { error: `No country called "${str(a.country)}".` };
      if (!resource && !country) return { error: 'Give a resource, a country, or both.' };
      if (str(a.resource) && !resource)
        return { error: `The inventory files nothing under "${str(a.resource)}".` };
      const rows = country ? restrictionsFor(country.key, resource) : restrictionsOn(resource!);
      return {
        ...(resource ? { resource } : {}),
        ...(country ? { country: country.name } : {}),
        measures: rows.slice(0, MAX).map((m) => ({
          country: m.iso2.toUpperCase(),
          resource: m.resource,
          measure: restrictionSummary(m),
          introduced: m.introduced,
          ends: m.ends,
          document: m.document,
          link: m.link,
          agency: m.agency,
        })),
        ...(rows.length > MAX ? { more: `${rows.length - MAX} more measures` } : {}),
        ...(country && !inInventory(country.key)
          ? {
              note: `${country.name} is not covered by the inventory at all; that is not "unrestricted".`,
            }
          : !rows.length
            ? { note: 'No measure recorded in the inventory; that is not "unrestricted".' }
            : {}),
        source: { label: RESTRICTIONS_SOURCE.label, url: RESTRICTIONS_SOURCE.url },
        status: 'Sourced (OECD inventory, each measure pointing to its legal text)',
      };
    },
  },
  {
    name: 'sanctions_on',
    description:
      'Sanctions regimes that name a country (EU Sanctions Map regimes and US OFAC programs) and the measures in them, optionally the measures that name a resource. Lists of sanctioned persons and companies are NOT read: for a company, this says so.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'A country, e.g. Russia, Iran' },
        resource: { type: 'string', description: 'Optional: e.g. uranium, diamonds, oil' },
      },
      required: ['name'],
    },
    label: (a) =>
      `Reading sanctions on ${str(a.name)}${str(a.resource) ? ` (${str(a.resource)})` : ''}`,
    run: async (a) => {
      const country = resolveIn('country', str(a.name));
      if (!country)
        return {
          name: str(a.name),
          regimes: [],
          note: `"${str(a.name)}" is not a country. The sanctions file holds country regimes and their measures; the annexes listing sanctioned persons and companies are not read, so whether an entity is listed is not in these sources — the EU Sanctions Map and the OFAC SDN list would settle it.`,
        };
      const resource = str(a.resource) ? resourceId(str(a.resource)) : undefined;
      const eu = euRegimesFor(country.key);
      const us = ofacProgramsFor(country.key);
      return {
        country: country.name,
        eu_regimes: eu.map((r) => ({
          title: r.title,
          amended: r.amended,
          measure_types: measureTypes(r),
          url: r.url,
        })),
        us_programs: us.map((p) => ({ title: p.title, url: p.url })),
        ...(resource
          ? {
              measures_naming_resource: sanctionsOn(country.key, resource)
                .slice(0, 6)
                .map((h) => ({
                  by: h.by,
                  type: h.type,
                  text: h.text.slice(0, 400),
                  regime: h.regime,
                  date: h.date,
                  url: h.url,
                })),
            }
          : {}),
        ...(!eu.length && !us.length
          ? { note: `No EU regime or OFAC program names ${country.name}. UK regimes are not read.` }
          : {}),
        gaps: SANCTIONS_SOURCE.gaps,
        status: `Sourced (EU Sanctions Map, OFAC; retrieved ${SANCTIONS_SOURCE.retrieved})`,
      };
    },
  },
];
