/**
 * The words a candidate row may use, each checked against the corpus: a
 * bottleneck, company, country or series must already exist on the site
 * (resolved through `resolveIn` or the closed list config keeps). Large
 * vocabularies are refinements rather than enums so the printed shape stays
 * readable. Used by ./schemas.ts.
 */
import { z } from 'zod';

import { COUNTRIES } from '@/config/substrata-countries';
import { COVERAGE } from '@/config/substrata-coverage';
import {
  INDUSTRIES,
  TECHNOLOGIES,
  type IndustryId,
  type TechnologyId,
} from '@/config/substrata-taxonomy';
import { resolveEntity, resolveIn, resolveInDirectory } from '@/lib/entities/registry';
import { ENTITY_KINDS, type EntityId } from '@/lib/entities/types';
import usgsRelations from '../../research/usgs-relations.json';
import { BOTTLENECK_NAMES } from '@/lib/event-rules';
import corpusSeriesFile from '../../research/series.json';

export const tuple = <T extends string>(values: readonly T[]) => values as unknown as [T, ...T[]];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** YYYY, YYYY-MM or YYYY-MM-DD: the precision the source gives, no more. */
const PARTIAL_DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

export const isoDate = z.string().regex(ISO_DATE, 'a YYYY-MM-DD date');
export const factDate = z
  .string()
  .regex(PARTIAL_DATE, 'YYYY, YYYY-MM or YYYY-MM-DD')
  .describe('The date the fact is FOR, at the precision the source gives.');
export const url = z
  .string()
  .regex(/^https?:\/\/\S+$/, 'a web address')
  .describe('The primary source page — publisher, regulator, filing, agency table.');

const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.iso2));
export const iso2Upper = z
  .string()
  .regex(/^[A-Z]{2}$/, 'an upper-case ISO 3166-1 alpha-2 code')
  .refine((code) => COUNTRY_CODES.has(code.toLowerCase()), 'not a country the site knows');
export const countryPlace = z
  .string()
  .regex(/^[a-z]{2}$/, 'a lower-case ISO 3166-1 alpha-2 code')
  .refine((code) => resolveIn('country', code) !== undefined, 'not a country entity on this site')
  .describe('Lower-case ISO 3166-1 alpha-2 of a country entity, e.g. "ne".');

const BOTTLENECK_NAME_SET = new Set(BOTTLENECK_NAMES);
export const bottleneckName = z
  .string()
  .refine((name) => BOTTLENECK_NAME_SET.has(name), 'not a bottleneck name on this site')
  .describe('A bottleneck NAME exactly as the site spells it, e.g. "Gallium, refined".');
export const bottleneckSlug = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'a bottleneck slug')
  .refine((slug) => resolveIn('bottleneck', slug)?.key === slug, 'not a bottleneck slug')
  .describe('A bottleneck SLUG, e.g. "gallium-refined" (the last part of /bottlenecks/<slug>).');
export const companySlug = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'a company slug')
  // Directory only: a stub company (named by the graph, no profile) has no row to extend.
  .refine(
    (slug) => resolveInDirectory('company', slug)?.key === slug,
    'not a company in the directory',
  )
  .describe('A directory company SLUG (the last part of /markets/<slug>).');
export const companyName = z
  .string()
  .refine(
    (name) => resolveInDirectory('company', name) !== undefined,
    'not a company in the directory',
  )
  .describe('A company name exactly as the directory spells it.');

export const COVERED_MATERIALS = new Set(COVERAGE.map((entry) => entry.material));

const SERIES_IDS = new Set((corpusSeriesFile.series as { id: string }[]).map((s) => s.id));
export const seriesId = z
  .string()
  .refine((id) => SERIES_IDS.has(id), 'not a series in research/series.json')
  .describe('The id of a committed series in research/series.json.');

export const technologies = z.array(z.enum(tuple<TechnologyId>(TECHNOLOGIES.map((t) => t.id))));
export const industries = z.array(z.enum(tuple<IndustryId>(INDUSTRIES.map((i) => i.id))));

/**
 * A relation endpoint: an entity on the site — a directory entity, a stub
 * company the graph names, a lab — or a node a committed research file already
 * names (research/usgs-relations.json). A candidate cannot mint a new
 * endpoint: a typo would become a firm.
 */
const GRAPH_NODES = new Set(Object.keys((usgsRelations as { nodes: object }).nodes));
const KIND = new RegExp(`^(${ENTITY_KINDS.join('|')}):[a-z0-9-]+$`);
export const graphEndpoint = z
  .string()
  .regex(KIND, 'an entity id, kind:key, e.g. "company:asml"')
  .refine(
    (id) => resolveEntity(id) !== undefined || GRAPH_NODES.has(id),
    'not an entity on this site, nor a node in research/usgs-relations.json',
  )
  .transform((id) => id as EntityId);
