/**
 * The gate a candidate row passes: one Zod schema per facet.
 *
 * Each schema `satisfies z.ZodType<…Candidate>`, and each candidate type is
 * derived from its config row (`CandidateOf<Row>` in ./candidate.ts), so when a
 * config row gains or changes a field the build fails here before a cheaper
 * model can write the old shape. The vocabularies come from the corpus itself:
 * a bottleneck, company or country a candidate names must resolve through the
 * entity registry (`resolveIn`) or the closed list the config already keeps,
 * so a candidate cannot name something that does not exist.
 *
 * Large vocabularies (bottleneck names, company slugs) are checked with a
 * refinement rather than spelled out as an enum, so `add.ts --schema` prints a
 * shape a model can read instead of four hundred names.
 *
 * Decided: docs/architecture/2026-10-23-knowledge-system.md, §3.2.
 */
import { z } from 'zod';

import { evidenceKey } from '@/config/substrata-evidence';
import { PRODUCER_ROLES, type ProducerRole } from '@/config/substrata-coverage';
import type { FacilityKind } from '@/config/substrata-facilities';
import type { HolderKind, OwnershipStatus } from '@/config/substrata-ownership';
import {
  JURISDICTIONS,
  type InstrumentEffect,
  type InstrumentKind,
  type InstrumentStatus,
  type JurisdictionId,
} from '@/config/substrata-policy';
import type { Stage, Unit } from '@/config/substrata-quantities';
import { TECHNOLOGIES, type TechnologyId } from '@/config/substrata-taxonomy';
import { EVENT_EFFECTS, EVENT_KINDS, eventProblems } from '@/lib/event-rules';
import {
  eventFromCandidate,
  relationCandidateId,
  type EndowmentCandidate,
  type EventCandidate,
  type Facet,
  type FacilityCandidate,
  type InstrumentCandidate,
  type OwnershipCandidate,
  type ProducerCandidate,
  type RelationCandidate,
  type ScienceCandidate,
  type SeriesPointCandidate,
} from './candidate';
import {
  tuple,
  isoDate,
  url,
  iso2Upper,
  countryPlace,
  bottleneckName,
  bottleneckSlug,
  companySlug,
  companyName,
  COVERED_MATERIALS,
  seriesId,
  technologies,
  industries,
} from './vocab';
import { Candidate, Source, SubmittedBy } from './common-schema';
import { RelationEntry } from './relation-schema';

export { RelationEntry };

// =====================================================================
// THE COMMON PART
// =====================================================================

export { Source, SubmittedBy, Candidate };

const Quantity = z.object({
  value: z.number().nonnegative(),
  unit: z.enum(tuple<Unit>(['kg', 't', 'Mcm', 'bcm'])),
  year: z.number().int().min(1900).max(2100).describe('The year the figure describes.'),
  basis: z.enum(['reported', 'estimated', 'withheld']),
});

// =====================================================================
// ONE SCHEMA PER FACET
// =====================================================================

export const ProducerEntry = Candidate.extend({
  material: z
    .string()
    .refine((name) => COVERED_MATERIALS.has(name), 'not a material under coverage')
    .describe('The material NAME the producer row sits under, e.g. "Gallium, refined".'),
  name: z.string().min(2).describe('Company name as it trades.'),
  jurisdictions: z.array(iso2Upper).min(1),
  role: z.enum(tuple<ProducerRole>(PRODUCER_ROLES.map((r) => r.id))),
  aliases: z.array(z.string().min(2)).optional(),
}).strict() satisfies z.ZodType<ProducerCandidate>;

export const EventEntry = Candidate.extend({
  id: z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/, 'the date, then a slug of the headline'),
  date: isoDate.describe('The day it happened or was announced. asOf is the same day.'),
  headline: z.string().min(1).max(120),
  kind: z.enum(tuple(EVENT_KINDS)),
  effect: z.enum(tuple(EVENT_EFFECTS)),
  bottlenecks: z.array(bottleneckName).min(1),
  participants: z.array(z.string()),
  jurisdictions: z.array(iso2Upper),
  primary: z.boolean().describe("True when the source is the organisation's own page or record."),
})
  .strict()
  .superRefine((row, ctx) => {
    if (row.asOf !== row.date) ctx.addIssue({ code: 'custom', message: 'asOf must equal date' });
    if (!row.id.startsWith(row.date))
      ctx.addIssue({ code: 'custom', message: 'id must start with the date' });
    // The same rules the review page and the accept script use (lib/event-rules.ts).
    for (const problem of eventProblems(eventFromCandidate(row as EventCandidate)))
      ctx.addIssue({ code: 'custom', message: problem });
  }) satisfies z.ZodType<EventCandidate>;

export const EndowmentEntry = Candidate.extend({
  material: bottleneckSlug,
  stage: z.enum(tuple<Stage>(['mine', 'refine', 'convert'])),
  describes: z.string().optional().describe('What the figure literally counts, if narrower.'),
  place: countryPlace,
  production: Quantity.optional(),
  reserves: Quantity.optional(),
  note: z.string().optional(),
})
  .strict()
  .refine((row) => row.production || row.reserves || row.note, {
    message: 'give production, reserves, or a note saying why neither is published',
  }) satisfies z.ZodType<EndowmentCandidate>;

export const FacilityEntry = Candidate.extend({
  id: z.string().regex(/^[a-z0-9-]+$/, 'a slug'),
  name: z.string().min(2),
  kind: z.enum(tuple<FacilityKind>(['field', 'plant', 'mine', 'refinery', 'fab'])),
  place: countryPlace,
  where: z.string().min(2).describe('Where in the country, in words.'),
  operator: companyName.nullable(),
  makes: z.array(bottleneckSlug).min(1),
  what: z.string().min(10).describe('What the source actually says about it, in one line.'),
  primary: z.boolean(),
}).strict() satisfies z.ZodType<FacilityCandidate>;

export const InstrumentEntry = Candidate.extend({
  id: z.string().regex(/^[a-z0-9-]+$/, 'a slug'),
  jurisdiction: z.enum(tuple<JurisdictionId>(JURISDICTIONS.map((j) => j.id))),
  title: z.string().min(3),
  body: z.string().min(2).describe('The issuing body, as it names itself.'),
  kind: z.enum(
    tuple<InstrumentKind>([
      'export-control',
      'licence-regime',
      'compute-threshold',
      'tariff',
      'safeguard',
      'permit',
      'procedure',
      'subsidy',
      'standard',
    ]),
  ),
  status: z.enum(
    tuple<InstrumentStatus>(['proposed', 'consulted', 'adopted', 'in-force', 'withdrawn']),
  ),
  statusNote: z.string().optional(),
  date: isoDate,
  effect: z.enum(tuple<InstrumentEffect>(['tightens', 'loosens', 'mixed'])),
  summary: z.string().min(10),
  technologies,
  industries,
  bottlenecks: z.array(bottleneckName),
  primary: z.boolean(),
  proponents: z.array(z.object({ name: z.string(), asked: z.string(), source: url }).strict()),
}).strict() satisfies z.ZodType<InstrumentCandidate>;

export const ScienceEntrySchema = Candidate.extend({
  id: z.string().regex(/^[a-z0-9-]+$/, 'a slug'),
  name: z.string().min(2),
  front: z.enum(tuple<TechnologyId>(TECHNOLOGIES.map((t) => t.id))),
  industries,
  plain: z.string().min(10),
  relieves: z
    .array(z.object({ bottleneck: bottleneckName, mechanism: z.string().min(5) }).strict())
    .min(1),
  readiness: z.number().int().min(1).max(9),
  readinessWhy: z.string().min(5),
  nextMilestone: z.string().nullable(),
}).strict() satisfies z.ZodType<ScienceCandidate>;

export const OwnershipEntry = Candidate.extend({
  company: companySlug,
  status: z.enum(tuple<OwnershipStatus>(['listed', 'private', 'subsidiary', 'state-owned'])),
  parent: z.string().optional(),
  ownedBy: z.string().optional(),
  name: z.string().min(2).describe('The holder, as the document names it.'),
  share: z
    .number()
    .gt(0)
    .max(100)
    .nullable()
    .describe('Per cent, read off the document; null when the document names no figure.'),
  kind: z.enum(tuple<HolderKind>(['founder', 'state', 'fund', 'strategic', 'public-float'])),
  note: z.string().optional(),
}).strict() satisfies z.ZodType<OwnershipCandidate>;

export const SeriesPointEntry = Candidate.extend({
  series: seriesId,
  date: z
    .string()
    .regex(/^\d{4}(-Q[1-4]|-\d{2}(-\d{2})?)?$/, 'YYYY, YYYY-Qn, YYYY-MM or YYYY-MM-DD')
    .describe('The period the value is FOR.'),
  value: z.number(),
  low: z.number().optional().describe('Only when the source states a range: its lower end.'),
  publisher: z.string().min(2),
  published: isoDate.optional(),
  primary: z.boolean(),
  note: z.string().optional(),
}).strict() satisfies z.ZodType<SeriesPointCandidate>;

// =====================================================================
// FACET TABLE
// =====================================================================

/* eslint-disable @typescript-eslint/no-explicit-any -- one table over eight row types */
interface FacetSpec {
  schema: z.ZodType<any>;
  /** The row's identity in its sidecar: duplicates and sort order are by this. */
  key: (row: any) => string;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const FACET_SPECS: Record<Facet, FacetSpec> = {
  producers: {
    schema: ProducerEntry,
    key: (r: ProducerCandidate) => evidenceKey(r.material, r.name),
  },
  events: { schema: EventEntry, key: (r: EventCandidate) => r.id },
  endowments: {
    schema: EndowmentEntry,
    key: (r: EndowmentCandidate) => `${r.material}/${r.place}/${r.stage}`,
  },
  facilities: { schema: FacilityEntry, key: (r: FacilityCandidate) => r.id },
  instruments: { schema: InstrumentEntry, key: (r: InstrumentCandidate) => r.id },
  science: { schema: ScienceEntrySchema, key: (r: ScienceCandidate) => r.id },
  ownership: {
    schema: OwnershipEntry,
    key: (r: OwnershipCandidate) => `${r.company}/${r.name}`,
  },
  'series-points': {
    schema: SeriesPointEntry,
    key: (r: SeriesPointCandidate) => `${r.series}/${r.date}`,
  },
  relations: { schema: RelationEntry, key: (r: RelationCandidate) => relationCandidateId(r) },
};
