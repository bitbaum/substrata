/**
 * The freshness page's computed states and ages, spread into METHODS in
 * lib/methods.ts.
 */
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
} as const satisfies Record<string, Method>;
