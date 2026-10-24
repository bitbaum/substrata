/**
 * The candidate shape for a relation (config/candidates/relations.json): two
 * endpoints the site already names, a type from the closed set, and one source
 * whose quote says it. Kept beside ./schemas.ts, which lists it in the facet
 * table. The rules a relation must meet once loaded are lib/graph/validate.ts.
 */
import { z } from 'zod';

import { RELATION_TYPES } from '@/lib/graph/types';
import { SHARE_TYPES, VOLUME_TYPES } from '@/lib/graph/validate';
import type { RelationCandidate } from './candidate';
import { Candidate } from './common-schema';
import { graphEndpoint, tuple } from './vocab';

export const RelationEntry = Candidate.extend({
  from: graphEndpoint.describe('Who or what the relation starts from, as an entity id.'),
  to: graphEndpoint.describe('Who or what it points to, as an entity id.'),
  type: z.enum(tuple(RELATION_TYPES)),
  grade: z
    .enum(['stated', 'lead'])
    .describe('"stated" when the quote says it outright; "lead" when it only suggests it.'),
  share: z
    .object({ value: z.number().gt(0).max(100), unit: z.literal('percent') })
    .strict()
    .optional()
    .describe('Only on owns or finances, and only when the quote states the percentage.'),
  volume: z
    .object({
      value: z.number().positive(),
      unit: z.string().min(1),
      period: z.string().min(1),
      commodity: z.string().optional(),
    })
    .strict()
    .optional()
    .describe('Only on supplies, buys_from or ships_to, and only when the quote states it.'),
})
  .strict()
  .superRefine((row, ctx) => {
    if (row.from === row.to) ctx.addIssue({ code: 'custom', message: 'from and to are the same' });
    if (row.share && !SHARE_TYPES.includes(row.type))
      ctx.addIssue({ code: 'custom', message: `a ${row.type} relation cannot carry a share` });
    if (row.volume && !VOLUME_TYPES.includes(row.type))
      ctx.addIssue({ code: 'custom', message: `a ${row.type} relation cannot carry a volume` });
  }) satisfies z.ZodType<RelationCandidate>;
