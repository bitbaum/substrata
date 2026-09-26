/**
 * The freshness page's computed states and ages, spread into METHODS in
 * lib/methods.ts.
 */
import { LEAD_EXPIRY_DAYS, REVIEW_QUEUE_LATE_DAYS, REVIEW_QUEUE_STALE_DAYS } from './lead-expiry';
import type { Method } from './methods';

export const FRESHNESS_METHODS = {
  'freshness-state': {
    title: 'Fresh, late, stale, failing',
    formula:
      'A feed is fresh within one scheduled interval plus half an interval (at least 20 minutes) of its last good run, late up to three intervals, stale beyond; failing when its newest failure is newer than its last good run.',
    explanation:
      'A failure is a run that never finished within 30 minutes, or one in which every look failed; a run where only some looks failed still counts as good. Intervals are declared per feed in config/substrata-freshness.ts to match the server timers. A committed dataset is fresh for three quarters of its declared maximum age, late until the maximum, and stale past it — at which point the build fails.',
    code: ['lib/freshness/status.ts', 'lib/freshness/read.ts', 'config/substrata-freshness.ts'],
  },
  'freshness-age': {
    title: 'Age of a feed or dataset',
    formula:
      'Now minus the finish time of the last good run (feeds), or whole UTC days since the date the committed file records it was checked (datasets).',
    explanation:
      'A dataset’s date is the one it states about itself (checkedOn, generatedOn or generatedAt), and for files with a date per row the oldest row. It says when the contents were last checked, not when the file was last edited.',
    code: ['lib/freshness/status.ts', 'config/substrata-freshness.ts'],
  },
  'lead-expiry': {
    title: 'Open and expired sweep leads',
    formula: `A sweep lead is open while nobody has reviewed it and it was found less than ${LEAD_EXPIRY_DAYS} days ago; unreviewed and ${LEAD_EXPIRY_DAYS} days or older, it is expired. The review queue is open leads only: late when its oldest has waited more than ${REVIEW_QUEUE_LATE_DAYS} days, stale past ${REVIEW_QUEUE_STALE_DAYS}.`,
    explanation:
      'Expiry is applied when the table is read: no job rewrites or deletes a row, an expired lead keeps its empty verdict and stays listed, and a reviewer can still decide on it. Without it the queue’s age only grew, so “stale” meant “nobody reviewed”. With it the oldest open lead cannot pass the expiry, so a stale queue means the expiry or the queue query is broken. A reader’s desk window may reach further back; an expired lead there is labelled “expired, never reviewed”, never as awaiting review.',
    code: ['lib/lead-expiry.ts', 'lib/event-draft-store.ts', 'config/substrata-freshness.ts'],
  },
} as const satisfies Record<string, Method>;
