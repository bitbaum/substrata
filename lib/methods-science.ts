/**
 * The science pipeline's computed numbers, spread into METHODS in
 * lib/methods.ts — kept here so that file stays one screen of shared rules.
 */
import type { Method } from './methods';

export const SCIENCE_PIPELINE_METHODS = {
  'science-pipeline': {
    title: 'Science pipeline counts',
    formula:
      'Items per stage = papers, preprints and grants collected for the bottleneck whose relevance score is 2 or more, placed on a stage by the rule in lib/science.ts; judgements are counted separately.',
    explanation:
      'Items come from OpenAlex, arXiv, NSF, OpenAIRE and USAspending (DOE), searched with the phrases in config/substrata-pipeline.ts. Relevance: 3 per phrase in the title, 1 per phrase in the abstract, 1 per context word in the title. The stage rule reads grant programmes and laboratory or pilot wording; it never places an item beyond pilot. Nobody has reviewed these rows. A count is what the feeds found, not all research on the subject.',
    code: [
      'lib/science.ts',
      'lib/science-store.ts',
      'lib/science-read.ts',
      'config/substrata-pipeline.ts',
    ],
  },
  'science-new': {
    title: 'New in the science feed',
    formula: `Items first collected in the last 7 days whose publication or award date is within the last 30 days.`,
    explanation:
      'Both conditions, so a first search that brings in two years of papers does not read as a week of news. Dates are the source\u2019s own.',
    code: ['lib/science-read.ts'],
  },
  'science-orgs': {
    title: 'Institutions and companies in the science feed',
    formula:
      'Items per institution per bottleneck, counting each item once per institution named on it by the source; a company is matched to the directory only when every distinguishing word of both names agrees.',
    explanation:
      'Institution names are exactly as OpenAlex, arXiv, NSF or USAspending report them. The directory match uses the strict rule in lib/listing-match.ts, against the company\u2019s name or the listed parent it trades through, so a near-miss stays unmatched rather than getting someone else\u2019s ticker.',
    code: ['lib/science-pipeline.ts', 'lib/science-read.ts', 'lib/listing-match.ts'],
  },
} satisfies Record<string, Method>;
