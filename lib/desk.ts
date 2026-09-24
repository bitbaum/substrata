/**
 * The desk's news feed, as pure functions.
 *
 * Two sources, never blended into one claim. An EVENT is a row a reviewer
 * read and committed (`config/substrata-events.ts`); a LEAD is a page the sweep
 * found this week and nobody has read yet (`research_sweep_candidates`). The
 * public site shows only events. The desk is a signed-in reader's own working
 * surface, and there the most useful thing is what happened *today* on their
 * rails — so leads are shown too, each one labelled as unread, linking to the
 * page it came from, and never counted as a finding.
 *
 * Kept free of the database and of React so the merge, the de-duplication and
 * the noise rules are tested rather than eyeballed.
 */

import type { CoverageEvent, EventEffect } from '@/config/substrata-events';
import { looksLikeAReference } from '@/lib/sweep';

export interface Lead {
  id: string;
  bottleneck: string;
  /** The phrase the sweep searched for. */
  term?: string;
  url: string;
  title: string;
  published: string | null;
  foundAt: string;
  effectGuess: EventEffect;
}

export type DeskItem =
  | {
      source: 'event';
      id: string;
      /** ISO timestamp the item is ordered by. */
      at: string;
      title: string;
      url: string;
      host: string;
      bottlenecks: string[];
      effect: EventEffect;
      /** The day it happened — an event carries no time of day. */
      dateOnly: true;
    }
  | {
      source: 'lead';
      id: string;
      at: string;
      title: string;
      url: string;
      host: string;
      bottlenecks: string[];
      effect: EventEffect;
      /** Other outlets that carried the same story, collapsed into this row. */
      alsoAt: string[];
      /** True when `at` is the publisher's own date rather than when we found it. */
      dated: boolean;
      dateOnly: false;
    }
  | {
      /** A filing to the SEC by a listed holder of the bottleneck: primary, timestamped. */
      source: 'filing';
      /** The EDGAR accession number. */
      id: string;
      at: string;
      title: string;
      url: string;
      host: string;
      bottlenecks: string[];
      effect: EventEffect;
      form: string;
      dateOnly: false;
    }
  | {
      /** A new dated number on a series on the rail (lib/desk-series.ts). */
      source: 'series';
      /** `<series id>:<period>`. */
      id: string;
      at: string;
      title: string;
      url: string;
      host: string;
      bottlenecks: string[];
      effect: EventEffect;
      /** The move against the prior point passed the alert threshold. */
      moved: boolean;
      /** From an official statistical API rather than read from a page. */
      official: boolean;
      dateOnly: boolean;
    };

/** Leads older than this are not news any more, whenever the sweep found them. */
export const LEAD_MAX_AGE_DAYS = 45;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};

/**
 * A page title as a headline: entities decoded, the publisher's name dropped.
 *
 * "KLA Launches $11 Billion Buyback Cycle: Here&#8217;s What to Expect |
 * TIKR.com" reads as a headline once the entity is a quote mark and the site
 * name — already shown beside it as the host — is gone. The suffix is only cut
 * when what remains is still a sentence, so a short title keeps its tail.
 */
export function cleanTitle(raw: string): string {
  let title = raw
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&[a-z]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
  for (let i = 0; i < 2; i += 1) {
    const cut = title.match(/^(.*\S)\s+(?:\||–|—|-)\s+([^|–—]{2,48})$/);
    if (!cut || cut[1].length < 30) break;
    title = cut[1];
  }
  return title.replace(/\s*\.\.\.$/, '').trim();
}

/**
 * A lead worth a line on the desk. The sweep's own reference-page rule decides
 * most of it — one definition of "not an event" — and it runs again here
 * because rows filed before a rule was added are still in the queue.
 */
export function isStory(title: string): boolean {
  const clean = cleanTitle(title);
  // A title of two or three words ("Grids & Benefits", "Market & News") is a
  // section of a website, not a headline.
  if (clean.split(' ').filter((word) => /[a-z0-9]/i.test(word)).length < 5) return false;
  // Both spellings: tidying a title cuts its tail, and the tail is sometimes
  // the tell ("… — Should I Secure What's Left?").
  return !looksLikeAReference(title) && !looksLikeAReference(clean);
}

/** Same story, different outlet: the wire copy of one press release. */
function storyKey(title: string): string {
  return cleanTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 10)
    .join(' ');
}

function leadTime(lead: Lead): { at: string; dated: boolean } {
  const published = lead.published ? Date.parse(lead.published) : NaN;
  // A publisher date in the future is a parsing accident, not a scoop.
  if (Number.isFinite(published) && published <= Date.parse(lead.foundAt)) {
    return { at: new Date(published).toISOString(), dated: true };
  }
  return { at: lead.foundAt, dated: false };
}

/**
 * Whether a headline names the rail it was filed under.
 *
 * The sweep files a page when its BODY mentions the term, so a trucking
 * logbook that mentions "reduction drive" once lands under precision drives.
 * The headline is what a reader sees, and one that names none of the rail's
 * words is usually that kind of accident. It also drops some real stories
 * ("Rare Earth Trade Report" under a didymium rail), which is why it is a
 * reader's setting and not the sweep's rule.
 */
export function headlineNamesRail(lead: Pick<Lead, 'title' | 'bottleneck' | 'term'>): boolean {
  const railWords = new Set(
    words(`${lead.bottleneck} ${lead.term ?? ''}`).filter(
      (w) => w.length >= 4 && !RAIL_STOPWORDS.has(w),
    ),
  );
  // Whole words, singular: "drives" names "drive", never "driver".
  return words(lead.title).some((w) => railWords.has(w));
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => (w.length > 4 ? w.replace(/ies$/, 'y').replace(/(?<![s])s$/, '') : w));
}

const RAIL_STOPWORDS = new Set([
  'grade',
  'capacity',
  'slots',
  'queues',
  'books',
  'order',
  'metal',
  'feed',
  'refined',
  'high',
  'purity',
  'yield',
]);

export function buildFeed(
  events: readonly CoverageEvent[],
  leads: readonly Lead[],
  now: Date = new Date(),
  leadMaxAgeDays = LEAD_MAX_AGE_DAYS,
  strictLeads = false,
): DeskItem[] {
  const items: DeskItem[] = events.map((event) => ({
    source: 'event',
    id: event.id,
    at: `${event.date}T12:00:00.000Z`,
    title: event.headline,
    url: event.source,
    host: hostOf(event.source),
    bottlenecks: event.bottlenecks,
    effect: event.effect,
    dateOnly: true,
  }));

  // A lead whose page was already filed as an event is that event.
  const known = new Set(events.map((event) => event.source));
  const cutoff = now.getTime() - leadMaxAgeDays * 86_400_000;
  const byStory = new Map<string, Extract<DeskItem, { source: 'lead' }>>();

  for (const lead of leads) {
    if (known.has(lead.url) || !isStory(lead.title)) continue;
    if (strictLeads && !headlineNamesRail(lead)) continue;
    const { at, dated } = leadTime(lead);
    if (Date.parse(at) < cutoff) continue;
    const key = storyKey(lead.title);
    const seen = byStory.get(key);
    if (seen) {
      const host = hostOf(lead.url);
      if (host && host !== seen.host && !seen.alsoAt.includes(host)) seen.alsoAt.push(host);
      if (!seen.bottlenecks.includes(lead.bottleneck)) seen.bottlenecks.push(lead.bottleneck);
      continue;
    }
    byStory.set(key, {
      source: 'lead',
      id: lead.id,
      at,
      title: cleanTitle(lead.title),
      url: lead.url,
      host: hostOf(lead.url),
      bottlenecks: [lead.bottleneck],
      effect: lead.effectGuess,
      alsoAt: [],
      dated,
      dateOnly: false,
    });
  }

  return [...items, ...byStory.values()].sort((a, b) => b.at.localeCompare(a.at));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "just now", "3h ago", "yesterday", "12 Sep", "3 Dec 2025". */
export function whenLabel(iso: string, now: Date = new Date(), dateOnly = false): string {
  const then = new Date(iso);
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000);
  const sameYear = then.getUTCFullYear() === now.getUTCFullYear();
  // Spelled out rather than locale-formatted: `en-GB` writes "Sept" in newer
  // ICU data and "Sep" in older, and the server's Node picks which.
  const calendar = `${then.getUTCDate()} ${MONTHS[then.getUTCMonth()]}${
    sameYear ? '' : ` ${then.getUTCFullYear()}`
  }`;
  if (dateOnly) {
    const days = Math.floor(
      (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate())) /
        86_400_000,
    );
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return calendar;
  }
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 48 * 60) return 'yesterday';
  return calendar;
}
