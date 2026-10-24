/**
 * The part every candidate row shares: evidence, asOf, one source with its
 * verbatim quote, and who submitted it. Each facet schema extends `Candidate`
 * (./schemas.ts, ./relation-schema.ts).
 */
import { z } from 'zod';

import { factDate, isoDate, url } from './vocab';

export const Source = z.object({
  url,
  quote: z
    .string()
    .min(20)
    .max(400)
    .describe('Copied VERBATIM from the page at url. The gate re-reads the page and looks for it.'),
  readOn: isoDate.describe('The day you read the page: today.'),
  locator: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe('Where in the source, e.g. "page 17" of a PDF. add.ts prints the page it found.'),
});

/** Set by a source adapter (lib/sources), never by hand: which adapter read what, and when. */
export const Provenance = z
  .object({
    adapter: z.string().min(1),
    fetchedAt: z.iso.datetime(),
    url: url.describe('The exact URL the adapter fetched (an API call, a PDF).'),
  })
  .strict();

export const SubmittedBy = z.object({
  agent: z.string().min(1).describe('Who ran it, e.g. "data-agent".'),
  model: z.string().min(1).describe('The model id the run used, exactly as its provider names it.'),
  runId: z.string().min(1).describe('One id per session, the same on every row it writes.'),
});

export const Candidate = z.object({
  evidence: z.literal('candidate'),
  asOf: factDate,
  source: Source,
  submittedBy: SubmittedBy,
  provenance: Provenance.optional(),
});
