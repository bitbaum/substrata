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
import { Candidate, Source } from './common-schema';
import { graphEndpoint, tuple } from './vocab';

/** A hand-written quote's ceiling, the same as every facet's. */
export const QUOTE_MAX = 400;
/**
 * An adapter's quote may run longer: it is one record cut by code from a
 * structured response (a UN Comtrade record from reporter through net weight
 * is about 600 characters), never typed. Only a row with `provenance` may.
 */
export const RECORD_QUOTE_MAX = 800;

export const RelationEntry = Candidate.extend({
  source: Source.extend({
    quote: z
      .string()
      .min(20)
      .max(RECORD_QUOTE_MAX)
      .describe(
        `Copied VERBATIM from the page at url. The gate re-reads the page and looks for it. At most ${QUOTE_MAX} characters by hand; only an adapter's record (with provenance) may run longer.`,
      ),
  }),
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
  note: z
    .string()
    .min(1)
    .max(300)
    .optional()
    .describe(
      'What a reviewer must know to read the quote: what a figure measures, or why the row is only a lead. Never a fact the quote does not carry.',
    ),
})
  .strict()
  .superRefine((row, ctx) => {
    if (row.source.quote.length > QUOTE_MAX && !row.provenance)
      ctx.addIssue({
        code: 'custom',
        path: ['source', 'quote'],
        message: `a hand-written quote is at most ${QUOTE_MAX} characters; only an adapter's record may be longer`,
      });
    if (row.from === row.to) ctx.addIssue({ code: 'custom', message: 'from and to are the same' });
    if (row.share && !SHARE_TYPES.includes(row.type))
      ctx.addIssue({ code: 'custom', message: `a ${row.type} relation cannot carry a share` });
    if (row.volume && !VOLUME_TYPES.includes(row.type))
      ctx.addIssue({ code: 'custom', message: `a ${row.type} relation cannot carry a volume` });
  }) satisfies z.ZodType<RelationCandidate>;
