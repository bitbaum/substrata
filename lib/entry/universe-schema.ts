/**
 * The candidate shape for company-universe evidence (config/candidates/universe.json):
 * one quoted source and what it establishes for one company — a theme, an
 * identifier, a size figure. The same shape the adapters write to
 * research/universe.json (lib/universe/types.ts). A data agent writes one
 * when a GapTask with box `universe` asks for it, typically a private
 * company's stated round or valuation, or a programme list naming it.
 * Kept beside ./schemas.ts, which lists it in the facet table.
 */
import { z } from 'zod';

import { IDENTITY_KINDS, SIZE_FLOORS, THEME_IDS } from '@/config/universe-themes';
import type { UniverseRow } from '@/lib/universe/types';
import { Candidate } from './common-schema';
import { tuple } from './vocab';

const Ids = z
  .object({
    ...Object.fromEntries(IDENTITY_KINDS.map((k) => [k, z.string().min(1).optional()])),
    exchange: z.string().min(1).optional(),
    cusip: z.string().length(9).optional(),
    sedol: z.string().length(7).optional(),
    isin: z.string().length(12).optional(),
  })
  .strict();

export const UniverseEntrySchema = Candidate.extend({
  company: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'a slug')
    .describe('The company slug: an existing /markets/<slug>, or a new slug of its name.'),
  name: z.string().min(2).describe('The name exactly as the source prints it.'),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe('ISO alpha-2, only when the source states the country.'),
  family: z
    .enum(['fund', 'filing', 'registry', 'statement'])
    .describe('fund holdings | a filing | a registry record | a company or investor statement'),
  establishes: z
    .object({
      theme: z.enum(tuple(THEME_IDS)).optional(),
      themeBasis: z.enum(['fund', 'sic', 'industry-class', 'programme', 'filing']).optional(),
      themeLabel: z
        .string()
        .min(5)
        .optional()
        .describe('Who places it in the theme, e.g. "Named in the DOE ARDP award list".'),
      ids: Ids.optional(),
      size: z
        .object({
          basis: z.enum(tuple(SIZE_FLOORS.map((f) => f.basis))),
          usd: z
            .number()
            .positive()
            .describe('In US dollars, as the source states it; never converted by you.'),
        })
        .strict()
        .optional(),
    })
    .strict()
    .refine((e) => e.theme || e.ids || e.size, 'establish at least one of theme, ids, size'),
}).strict() satisfies z.ZodType<UniverseRow>;
