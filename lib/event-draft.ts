/**
 * Draft a CoverageEvent from a sweep lead, for a person to review.
 *
 * The model does the reading a reviewer would otherwise do from scratch: find
 * the date the thing happened, write the line, pick the kind and effect, and
 * copy the sentence that carries the claim. Everything it returns is checked
 * here against the page and the directory, because the model is exactly the
 * thing that cannot be trusted with the site's one promise:
 *
 *   - the quote must occur on the fetched page word for word, or the draft is
 *     refused (one repair attempt, then it is marked unusable);
 *   - bottlenecks and participants are cut to names the site already has;
 *   - a date must be a real past date, and the words it came from must be on
 *     the page too, so "the date of the crawl" cannot pass as "the date of the
 *     event".
 *
 * A draft is never published. It waits in `research_event_drafts` until a
 * reviewer accepts it, and even then it reaches a page only through a commit.
 */
import type { CoverageEvent, EventEffect, EventKind } from '@/config/substrata-events';
import {
  BOTTLENECK_NAMES,
  EVENT_EFFECTS,
  EVENT_KINDS,
  HEADLINE_MAX,
  eventIdFor,
  knownNames,
  participantsMentioned,
  squash,
  verbatimIn,
} from './event-rules';

/** An event row before anyone has accepted it: everything but `acceptedOn`. */
export type DraftEvent = Omit<CoverageEvent, 'acceptedOn'>;

export interface DraftLead {
  id: string;
  bottleneck: string;
  term: string;
  url: string;
  title: string;
}

export type DraftOutcome =
  | {
      status: 'drafted';
      suggestion: 'event' | 'not_an_event';
      reason: string;
      draft: DraftEvent | null;
      /** Things a reviewer should check before accepting: dropped names, an unverified date. */
      notes: string[];
    }
  | { status: 'unusable'; reason: string };

/** Ask a model; returns its text. Injected so the rules can be tested without a network. */
export type AskMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type Ask = (messages: AskMessage[]) => Promise<string>;

/** Characters of page text a model sees: the top (where the date is) and the passage the sweep matched. */
const HEAD_CHARS = 2_500;
const AROUND_CHARS = 2_500;

/** The part of a long page worth a model's budget. */
export function pageWindow(text: string, term: string): string {
  const page = squash(text);
  if (page.length <= HEAD_CHARS + AROUND_CHARS) return page;
  const at = page.toLowerCase().indexOf(term.toLowerCase());
  const head = page.slice(0, HEAD_CHARS);
  if (at < HEAD_CHARS) return page.slice(0, HEAD_CHARS + AROUND_CHARS);
  const start = Math.max(HEAD_CHARS, at - AROUND_CHARS / 2);
  return `${head}\n…\n${page.slice(start, start + AROUND_CHARS)}`;
}

function prompt(lead: DraftLead, pageText: string, today: string): string {
  const people = participantsMentioned(pageText);
  return [
    `Today is ${today}. A web sweep filed this page as a possible event for the bottleneck "${lead.bottleneck}".`,
    'Decide whether the page reports a specific, dated thing that happened (a plant opening or closing, an export control, an outage, a price or lead-time change, a filing, a milestone). Market-size forecasts, explainers, product catalogues, listicles and opinion pieces are NOT events.',
    'Reply with ONE JSON object and nothing else:',
    '{"verdict":"event"|"not_an_event","reason":"one sentence","date":"YYYY-MM-DD or null","date_text":"the words on the page that give that date, copied exactly","headline":"one line, max 120 characters, plain past or present tense, no hype","kind":"capacity|lead-time|price|policy|outage|filing|milestone","effect":"tightens|loosens|neutral","bottlenecks":["names from the list"],"participants":["names from the list"],"jurisdictions":["ISO 3166-1 alpha-2"],"quote":"one or two sentences copied EXACTLY from the page that carry the claim","primary":true|false}',
    'Rules: the date is when the thing happened or was announced, as the page says, never today. The quote must be copied character for character from the page text below — do not paraphrase, translate or join separate sentences. "primary" is true only if the page is the organisation\'s own announcement or an official record. Use only names from these lists; leave a list empty rather than invent.',
    `Bottlenecks: ${JSON.stringify(BOTTLENECK_NAMES)}`,
    `Participants named on this page: ${JSON.stringify(people)}`,
    `Page title: ${lead.title}`,
    `Page URL: ${lead.url}`,
    'Page text:',
    pageWindow(pageText, lead.term),
  ].join('\n');
}

/** The first balanced JSON object in a reply, tolerating fences and a preamble. */
export function firstJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try {
        const parsed: unknown = JSON.parse(text.slice(start, i + 1));
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Turn a model's reply into a draft, or say why it cannot be one.
 * Pure: the page text and today are passed in.
 */
export function readDraft(
  reply: Record<string, unknown>,
  lead: DraftLead,
  pageText: string,
  today: string,
): DraftOutcome {
  const verdict = reply.verdict === 'event' ? 'event' : 'not_an_event';
  const reason = str(reply.reason) || 'The model gave no reason.';
  if (verdict === 'not_an_event')
    return { status: 'drafted', suggestion: verdict, reason, draft: null, notes: [] };

  const quote = verbatimIn(str(reply.quote), pageText);
  if (!quote) return { status: 'unusable', reason: 'The quote is not on the page word for word.' };

  const notes: string[] = [];
  let date = str(reply.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
    notes.push('No usable date on the page — set it by hand.');
    date = '';
  } else {
    const dateText = str(reply.date_text);
    const onPage = dateText.length > 3 && verbatimIn(dateText, pageText) !== null;
    // The words the date came from must be on the page, and carry its year.
    if (!onPage || !dateText.includes(date.slice(0, 4)))
      notes.push(`Date ${date} could not be matched to words on the page — check it.`);
  }

  const bottlenecks = knownNames(reply.bottlenecks, 'bottleneck');
  const participants = knownNames(reply.participants, 'participant');
  if (bottlenecks.dropped.length)
    notes.push(`Dropped unknown bottlenecks: ${bottlenecks.dropped.join(', ')}.`);
  if (participants.dropped.length)
    notes.push(`Dropped names not in the directory: ${participants.dropped.join(', ')}.`);
  // The sweep filed it under a bottleneck for a reason; an empty list falls back to it.
  const named = bottlenecks.kept.length ? bottlenecks.kept : [lead.bottleneck];

  const kind = EVENT_KINDS.includes(reply.kind as EventKind) ? (reply.kind as EventKind) : null;
  const effect = EVENT_EFFECTS.includes(reply.effect as EventEffect)
    ? (reply.effect as EventEffect)
    : 'neutral';
  if (!kind) notes.push('No valid kind — pick one.');
  const headline = str(reply.headline).slice(0, HEADLINE_MAX);
  const jurisdictions = (Array.isArray(reply.jurisdictions) ? reply.jurisdictions : [])
    .map((j) => str(j).toUpperCase())
    .filter((j) => /^[A-Z]{2}$/.test(j));

  return {
    status: 'drafted',
    suggestion: 'event',
    reason,
    notes,
    draft: {
      id: eventIdFor(date || today, headline),
      date,
      headline,
      kind: kind ?? 'milestone',
      effect,
      bottlenecks: named,
      participants: participants.kept,
      jurisdictions: [...new Set(jurisdictions)],
      source: lead.url,
      primary: reply.primary === true,
      quote,
    },
  };
}

/**
 * Draft one lead: ask, check, and if the quote was not verbatim, ask once more
 * with the refusal spelled out. Two calls at most — the budget is shared.
 */
export async function draftLead(
  lead: DraftLead,
  pageText: string,
  ask: Ask,
  today = new Date().toISOString().slice(0, 10),
): Promise<DraftOutcome> {
  const messages: AskMessage[] = [
    {
      role: 'system',
      content:
        'You are a careful research assistant. You copy quotations exactly and answer in JSON only.',
    },
    { role: 'user', content: prompt(lead, pageText, today) },
  ];
  let last: DraftOutcome = { status: 'unusable', reason: 'The model returned no JSON.' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await ask(messages);
    const reply = firstJsonObject(text);
    last = reply
      ? readDraft(reply, lead, pageText, today)
      : { status: 'unusable', reason: 'The model returned no JSON.' };
    if (last.status === 'drafted') return last;
    messages.push({ role: 'assistant', content: text });
    messages.push({
      role: 'user',
      content: `That was refused: ${last.reason} Reply again with the same JSON, copying the quote character for character from the page text.`,
    });
  }
  return last;
}
