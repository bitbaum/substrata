/**
 * The candidate shape for a lab (config/candidates/labs.json): an institute,
 * university group or national laboratory, named by its own page or a funder's
 * record, with what it works on as bottleneck names the site already has.
 * Kept beside ./schemas.ts, which lists it in the facet table. Funding is not
 * a field: it is a `finances` relation into `lab:<id>` with its own quote.
 */
import { z } from 'zod';

import { LAB_TYPES, type LabType } from '@/config/substrata-labs';
import type { LabCandidate } from './candidate';
import { Candidate } from './common-schema';
import { bottleneckName, countryPlace, tuple, url } from './vocab';

export const LabEntry = Candidate.extend({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'a slug')
    .describe(
      'A slug of the name as the lab writes it, e.g. "institute-of-nuclear-physics-almaty".',
    ),
  name: z.string().min(3).describe('The name as the lab writes it on its own page.'),
  type: z.enum(tuple<LabType>(LAB_TYPES)),
  place: countryPlace,
  where: z.string().min(2).optional().describe('City or campus, only when the source says.'),
  worksOn: z
    .array(
      z
        .object({
          bottleneck: bottleneckName,
          what: z.string().min(10).describe('The line of work, as the source describes it.'),
        })
        .strict(),
    )
    .min(1)
    .describe('What it works on: each a bottleneck NAME the site has, and the work in one line.'),
  url: url.describe("The lab's own page."),
  join: url
    .nullable()
    .describe('A page where someone applies (vacancies, a doctoral programme), or null.'),
}).strict() satisfies z.ZodType<LabCandidate>;
