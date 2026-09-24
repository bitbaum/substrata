/**
 * What makes an event row acceptable, written once.
 *
 * Three callers need the same answer: the drafter (is this model output worth
 * showing a reviewer?), the review page's Accept (may this edited row enter
 * the queue for git?) and the accept script (may this row be written into the
 * corpus file?). If each kept its own copy, a row the page accepted could be
 * refused by the tests after it was committed — or worse, pass a looser copy
 * and reach a page. `test/events.test.ts` checks the committed corpus against
 * the same vocabularies.
 */
import { MATERIALS } from '@/config/substrata';
import { CHOKEPOINTS, COVERAGE } from '@/config/substrata-coverage';
import { PARTICIPANTS } from '@/config/substrata-participants';
import type { CoverageEvent, EventEffect, EventKind } from '@/config/substrata-events';

export const EVENT_KINDS: readonly EventKind[] = [
  'capacity',
  'lead-time',
  'price',
  'policy',
  'outage',
  'filing',
  'milestone',
];
export const EVENT_EFFECTS: readonly EventEffect[] = ['tightens', 'loosens', 'neutral'];

/** Every bottleneck name an event may bear on. */
export const BOTTLENECK_NAMES: readonly string[] = [
  ...MATERIALS.map((m) => m.title),
  ...CHOKEPOINTS.map((c) => c.name),
];

/** Every organisation name the directory has: participants and producer rows. */
export const PARTICIPANT_NAMES: readonly string[] = [
  ...new Set([
    ...PARTICIPANTS.map((p) => p.name),
    ...COVERAGE.flatMap((entry) => entry.producers.map((p) => p.name)),
  ]),
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const HEADLINE_MAX = 120;

/**
 * One character in, one character out: typographic quotes, dashes and odd
 * spaces fold to their plain forms. Keeping the length fixed is what lets a
 * match found in the folded text be cut from the ORIGINAL text at the same
 * offsets, so the stored quote is the page's own characters, not the model's.
 */
function fold(text: string): string {
  return text
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/[   ]/g, ' ');
}

/** Collapse runs of whitespace — readPage already does this; model output may not. */
export function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The quote exactly as it stands on the page, or null when it does not.
 *
 * Case matters and so do words: a paraphrase is the thing this exists to
 * refuse. Only typography and whitespace are forgiven, because a model
 * reliably straightens a curly apostrophe and a reader would never call that
 * a misquote.
 */
export function verbatimIn(quote: string, pageText: string): string | null {
  const needle = fold(squash(quote));
  if (needle.length < 12) return null;
  const page = squash(pageText);
  const at = fold(page).indexOf(needle);
  return at < 0 ? null : page.slice(at, at + needle.length);
}

/** The passage around a quote, split so the quote itself can be marked; null when it is not there. */
export function contextAround(
  quote: string,
  pageText: string,
  radius = 400,
): { before: string; quote: string; after: string } | null {
  const page = squash(pageText);
  const needle = fold(squash(quote));
  const at = needle.length ? fold(page).indexOf(needle) : -1;
  if (at < 0) return null;
  const end = at + needle.length;
  const start = Math.max(0, at - radius);
  const stop = Math.min(page.length, end + radius);
  return {
    before: `${start > 0 ? '… ' : ''}${page.slice(start, at)}`,
    quote: page.slice(at, end),
    after: `${page.slice(end, stop)}${stop < page.length ? ' …' : ''}`,
  };
}

/** `2026-07-17-sk-siltron-liquidates-css` — date plus the headline's first words. */
export function eventIdFor(date: string, headline: string): string {
  const slug = headline
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .split('-')
    .filter(Boolean)
    .slice(0, 6)
    .join('-');
  return `${date}-${slug || 'event'}`;
}

function inSet(names: readonly string[]): (name: string) => boolean {
  const set = new Set(names);
  return (name) => set.has(name);
}
const isBottleneck = inSet(BOTTLENECK_NAMES);
const isParticipant = inSet(PARTICIPANT_NAMES);

/**
 * Everything wrong with an event row, as sentences a reviewer can act on.
 * Empty means acceptable. `pageText`, when given, is the text the quote must
 * occur in verbatim.
 */
export function eventProblems(event: CoverageEvent, pageText?: string): string[] {
  const out: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  if (!ISO_DATE.test(event.date)) out.push('The date is not a YYYY-MM-DD date.');
  else if (event.date > today) out.push('The date is in the future.');
  if (!ISO_DATE.test(event.acceptedOn)) out.push('The acceptance date is missing.');
  else if (event.date > event.acceptedOn) out.push('Accepted before it happened.');
  if (!event.headline.trim()) out.push('The headline is empty.');
  if (event.headline.length > HEADLINE_MAX)
    out.push(`The headline is longer than ${HEADLINE_MAX} characters.`);
  if (!EVENT_KINDS.includes(event.kind)) out.push(`Unknown kind "${event.kind}".`);
  if (!EVENT_EFFECTS.includes(event.effect)) out.push(`Unknown effect "${event.effect}".`);
  if (event.bottlenecks.length === 0) out.push('It names no bottleneck.');
  for (const name of event.bottlenecks)
    if (!isBottleneck(name)) out.push(`"${name}" is not a bottleneck on this site.`);
  for (const name of event.participants)
    if (!isParticipant(name)) out.push(`"${name}" is not in the participant directory.`);
  for (const code of event.jurisdictions)
    if (!/^[A-Z]{2}$/.test(code)) out.push(`"${code}" is not a two-letter country code.`);
  if (!/^https?:\/\//.test(event.source)) out.push('The source is not a web address.');
  if (typeof event.primary !== 'boolean')
    out.push('It does not say whether the source is primary.');
  if (event.quote.trim().length <= 10) out.push('The quote is too short to carry a claim.');
  else if (pageText !== undefined && verbatimIn(event.quote, pageText) === null)
    out.push('The quote does not occur word for word on the source page.');
  return out;
}

/** Keep only names the site has; report the ones dropped so nobody wonders where they went. */
export function knownNames(
  names: unknown,
  kind: 'bottleneck' | 'participant',
): { kept: string[]; dropped: string[] } {
  const list = Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : [];
  const ok = kind === 'bottleneck' ? isBottleneck : isParticipant;
  const kept = [...new Set(list.map((n) => n.trim()).filter(ok))];
  const dropped = list.filter((n) => !ok(n.trim()));
  return { kept, dropped };
}

/** Participant names that actually occur in a page's text — the only ones worth offering a model. */
export function participantsMentioned(pageText: string): string[] {
  const lower = pageText.toLowerCase();
  return PARTICIPANT_NAMES.filter((name) => name.length > 2 && lower.includes(name.toLowerCase()));
}
