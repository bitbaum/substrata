/**
 * The parts of "Update news now" a browser may import: the shapes the two
 * routes answer with, and the numbers the buttons state. No database here.
 */
export type UpdateScope =
  { kind: 'bottleneck'; slug: string } | { kind: 'company'; slug: string } | { kind: 'desk' };

/** Leads one "Summarise with AI" drafts: a page read and up to two calls each, on the reader's key. */
export const SUMMARISE_AT_ONCE = 3;

/**
 * Tokens one draft costs a reader's key: a page excerpt in, a JSON row out.
 * Measured on 2026-09-25 over the drafts the free chain made before drafting
 * moved to readers' keys (project note ai-and-feed-economy). Used for the
 * estimates next to the buttons; the reader's vendor bills what it counts.
 */
export const TOKENS_PER_DRAFT = 3_400;

export interface UpdateLead {
  id: string;
  title: string;
  url: string;
  host: string;
  bottleneck: string;
  bottleneckSlug: string | null;
  foundAt: string;
  draft: {
    status: 'drafted' | 'unusable' | 'could_not_read' | 'duplicate';
    suggestion: 'event' | 'not_an_event' | null;
    headline: string | null;
    date: string | null;
    reason: string;
  } | null;
}

/** What step one answers. */
export interface UpdateResult {
  covered: number;
  swept: number;
  found: number;
  couldNotLook: number;
  cooldownMinutes: number;
  leads: UpdateLead[];
}

/** A lead a summary would still add something to. */
export function needsDraft(lead: UpdateLead): boolean {
  return !lead.draft || lead.draft.status === 'unusable' || lead.draft.status === 'could_not_read';
}
