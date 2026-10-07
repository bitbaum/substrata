/**
 * Copy for a company's "Ways to take part" section — the labels and the
 * not-advice line. The routes themselves are derived in `lib/take-part.ts`.
 *
 * The not-advice line comes first on purpose: the section names where shares
 * trade, and a reader must meet the limit before the ticker, not after it.
 */
import type { TakePartKind } from '@/lib/take-part';

export const TAKE_PART_LABEL: Record<TakePartKind, string> = {
  work: 'Work there',
  own: 'Own part of it',
  buy: 'Buy from it',
};

export const TAKE_PART_NOT_ADVICE = {
  lead: 'Not investment advice.',
  body:
    'This says how the public can reach a company — a job, its shares, ' +
    'its products — not whether anyone should. It takes no account of anyone’s ' +
    'circumstances, ' +
    'and a company holding a chokepoint is not a reason to own it.',
};

/** Where the full statement of what Substrata is not lives. */
export const TAKE_PART_LIMITS_HREF = '/about';
