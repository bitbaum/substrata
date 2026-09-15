/**
 * The words the site uses on screen.
 *
 * The data model's names are precise and unhelpful: "binding", "horizon",
 * "sourced / candidate / unverified". A reader arriving cold should not have
 * to learn a private vocabulary to use a table, so the interface reads from
 * this file instead, and every one of these has a one-line explanation that
 * renders next to it the first time it appears on a page.
 *
 * Changing a label here changes it everywhere. Changing the underlying ids is
 * a data migration and a different job.
 *
 * Created: 2026-09-15
 */

import type { Horizon } from '@/config/substrata-assessment';
import type { Verification } from '@/config/substrata-evidence';

/** The 0–12 score. Called "binding" in the data, "severity" on screen. */
export const SEVERITY = {
  label: 'Severity',
  short: 'How hard it binds, 0 to 12',
  long:
    'Four questions, each scored 0 to 3: how few suppliers qualify, how hard it is to replace, ' +
    'how long new capacity takes, and whether the buyer can walk away. Higher is worse for ' +
    'progress. Judged by hand and dated on every page.',
} as const;

/** When a bottleneck bites. Called "horizon" in the data. */
export const WHEN = {
  label: 'When it bites',
  short: 'Now, within two years, or later',
  long: 'A judgement about when this constraint is expected to be the one holding things up.',
} as const;

export const WHEN_LABEL: Record<Horizon, string> = {
  now: 'Now',
  'two-years': 'Within 2 years',
  beyond: 'Later',
};

/** How well a row is backed. Called "verification" in the data. */
export const EVIDENCE = {
  label: 'Evidence',
  short: 'Verified, source found, or unverified',
  long:
    'Verified means a person opened a source that says so and the link is on the page. Source ' +
    'found means an automated search located a page that appears to say so and nobody has read ' +
    'it yet. Unverified means neither. Only verified rows are findings.',
} as const;

export const EVIDENCE_LABEL: Record<Verification, string> = {
  sourced: 'Verified',
  candidate: 'Source found',
  unverified: 'Unverified',
};

/** Compact form for a tight column. */
export const EVIDENCE_SHORT: Record<Verification, string> = {
  sourced: 'Verified',
  candidate: 'Unchecked',
  unverified: 'Unverified',
};

/** One sentence, used wherever the nine stages are listed. */
export const LOOP_IN_ONE_LINE =
  'Technology improves its own inputs, and the speed of that is set by whatever it waits on ' +
  'longest. These are the things it waits on.';

/** What "relief time" means, used where stages show theirs. */
export const RELIEF_IN_ONE_LINE =
  'Relief time is how long it takes to loosen a constraint once somebody decides to.';
