/**
 * What counts as a candidate event, in one place. The box timer's sweep
 * (`lib/sweep-store.ts`) is the only caller; its queue is the only queue.
 */
import { createHash } from 'node:crypto';
import { webSearch, readPage } from '@bitbaum/ai-kit/web';

import { MATERIALS } from '@/config/substrata';
import { CHOKEPOINTS } from '@/config/substrata-coverage';
import type { EventEffect } from '@/config/substrata-events';
import { DEFAULT_SWEEP_SETTINGS, queryFor, type SweepSettings } from '@/lib/sweep-settings';

/** What the sweep files: a page naming a bottleneck's term with words of change. Never a finding. */
export interface CandidateEvent {
  id: string;
  bottleneck: string;
  term: string;
  url: string;
  title: string;
  published: string | null;
  excerpt: string;
  effectGuess: EventEffect;
  foundAt: string;
  status: 'candidate' | 'could_not_look';
}

export {
  DEFAULT_SWEEP_SETTINGS,
  parseSweepSettings,
  queryFor,
  type SweepSettings,
} from '@/lib/sweep-settings';

/** How many results to consider, how many to read, and how much text to keep around a match. */
const RESULTS_PER_NODE = 8;
const EXCERPT_RADIUS = 200;

/**
 * Domains that never carry an event.
 *
 * A triage of the first 77 candidates found 54 were not events at all, and
 * almost all of that noise came from the same handful of sources: market-size
 * forecasts, SEO listicles, press-release wires and "industry outlook"
 * vendors. They rank well for exactly the terms this sweep searches, so they
 * crowd out the announcement that actually happened.
 *
 * This is a blocklist rather than an allowlist on purpose: a real event can
 * appear anywhere, and refusing everything unfamiliar would lose more than it
 * saves.
 */
const NEVER_AN_EVENT = [
  'researchandmarkets',
  'mordorintelligence',
  'precedenceresearch',
  'marketreportsworld',
  'markwideresearch',
  'maximizemarketresearch',
  'datainsightsreports',
  'datamintelligence',
  'globenewswire',
  'einpresswire',
  'linkedin.com',
  'techinsights.com',
  'patsnap.com',
  'gtaic.ai',
  'hdinresearch',
  'x.com',
  'youtube.com',
  'justetf.com',
  'wallstreet-online',
  'pitchbook.com',
  'unjobnet.org',
  'neonscience.org',
];

/**
 * Matched on a host boundary, not a substring.
 *
 * `host.includes('x.com')` is true of `semiconductorx.com` and
 * `simplytronix.com`, so the list was quietly discarding trade press it was
 * never meant to touch — invisibly, because a filtered result leaves no trace.
 *
 * The list mixes two spellings and both have to keep working: a full host
 * (`linkedin.com`) matches that host or a subdomain of it, and a bare name
 * (`researchandmarkets`) matches a whole label, so it catches every TLD the
 * same farm publishes under without also catching a name it is a substring of.
 */
export function isNeverAnEvent(url: string, extra: readonly string[] = []): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return [...NEVER_AN_EVENT, ...extra].some((bad) =>
      bad.includes('.') ? host === bad || host.endsWith(`.${bad}`) : host.split('.').includes(bad),
    );
  } catch {
    return true;
  }
}

/**
 * Pages whose TITLE says they are a reference, not a report.
 *
 * The publisher blocklist above cannot catch these: they come from legitimate
 * trade press and commodity desks, which do report real events. The page is
 * the problem, not the site — a price chart, a historical-data table or a
 * "complete guide" is a standing page that is republished forever and describes
 * no moment in time.
 *
 * Measured on the first scheduled run: 4 of 11 candidates were this shape
 * ("Tin - Price - Chart - Historical Data - News", "Neon Gas in
 * Semiconductors: Complete Guide & Applications"). Every one of them costs a
 * reviewer a read to reject.
 *
 * Deliberately narrow. "Polysilicon Industry Is Risking New Shortage" is an
 * analysis of something happening and must survive, so this matches the
 * vocabulary of reference pages rather than any mention of a price or a market.
 */
const REFERENCE_PAGE_TITLE = new RegExp(
  [
    // A price series: chart, index, history, trend, forecast, live quote.
    String.raw`\bprice\s*[-–—|:,]?\s*(trend|chart|history|index|forecast|today)\b`,
    String.raw`\bhistorical\s+data\b`,
    String.raw`\b(live|spot|current)\s+price\b`,
    // Explainers and evergreen SEO pages.
    String.raw`\b(complete|ultimate|comprehensive|beginner'?s|buyer'?s)\s+guide\b`,
    String.raw`\bguide\s*(&|and)\s*applications\b`,
    String.raw`^\s*what\s+is\b`,
    String.raw`^\s*how\s+to\b`,
    // Market-research packaging that is not on the publisher blocklist.
    String.raw`\bmarket\s+(size|share|report|outlook|analysis|research)\b`,
    String.raw`\b(industry|market)\s+(outlook|forecast)\s+20\d\d\b`,
    // Measured on the desk once leads were shown there: a site's homepage, a
    // "market worth $X by 2033" release, a stock-picking newsletter, a buying
    // guide, a preprint id and a newsroom index. None of them describes something that happened.
    String.raw`^\s*home\s*page\b`,
    String.raw`\bmarket\s+worth\b`,
    String.raw`\bmarket\s*\(20\d\d`,
    String.raw`\bmarket\s+data\b`,
    String.raw`\bstock\s+picks?\b`,
    String.raw`\bshould\s+i\b`,
    String.raw`\b(buyer|procurement)\s+guide\b`,
    String.raw`\bhow\s+to\s+buy\b`,
    String.raw`^\s*\[\d{4}\.\d{4,5}\]`,
    // A publisher's listing of its own announcements, not one of them.
    String.raw`\bnews\s+(and|&)\s+press\s+releases\b`,
  ].join('|'),
  'i',
);

/**
 * True when the title advertises a standing reference page.
 *
 * Title-shaped rather than host-shaped, because the same publisher files both
 * an announcement and a price chart. An empty title is NOT treated as a
 * reference page: it is more often a reader failure than an SEO page, and
 * discarding it would hide a real event behind a parsing bug.
 */
export function looksLikeAReference(title: string): boolean {
  return REFERENCE_PAGE_TITLE.test(title.trim());
}

const TIGHTENS =
  /shortag|delay|cut|halt|suspend|ban|restrict|control|licen[cs]e requir|liquidat|clos(e|ure|ing)|outage|fire|explosion|strike|sanction|tariff|backlog|sold out|wait(ing)? list|years? of lead/i;
const LOOSENS =
  /expan|new plant|new facilit|capacity|open(s|ed|ing)|commission|ramp|second source|agreement|approv|granted|breakthrough|recycl|ease|resum/i;

export function nodes(): Array<{ name: string; term: string }> {
  return [
    ...MATERIALS.map((m) => ({ name: m.title, term: m.search })),
    ...CHOKEPOINTS.map((c) => ({ name: c.name, term: chokepointTerm(c.name) })),
  ];
}

/** "Large power transformer slots" → "large power transformer"; the last word is usually the count noun we added. */
function chokepointTerm(name: string): string {
  return name
    .replace(
      /\b(slots|order books|queues|capacity|yield|formulation|engineers|sintering|drives)\b/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function guessEffect(text: string): EventEffect {
  const tight = TIGHTENS.test(text);
  const loose = LOOSENS.test(text);
  if (tight && !loose) return 'tightens';
  if (loose && !tight) return 'loosens';
  return 'neutral';
}

function excerptAround(text: string, term: string): string | null {
  const lower = text.toLowerCase();
  const at = lower.indexOf(term.toLowerCase());
  if (at < 0) return null;
  const start = Math.max(0, at - EXCERPT_RADIUS);
  const end = Math.min(text.length, at + term.length + EXCERPT_RADIUS);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function idFor(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 12);
}

export async function sweep(
  node: { name: string; term: string },
  settings: SweepSettings = DEFAULT_SWEEP_SETTINGS,
): Promise<CandidateEvent[]> {
  const foundAt = new Date().toISOString();
  // The year is today's, not a literal: a hardcoded "2026" would quietly
  // narrow every search to last year from January on.
  const query = queryFor(node.term, settings.eventWords, new Date().getUTCFullYear());
  const search = await webSearch(query, { limit: RESULTS_PER_NODE, timeoutMs: 15_000 });

  if (search.status === 'could_not_look') {
    return [
      {
        id: idFor(`could_not_look:${node.name}:${foundAt}`),
        bottleneck: node.name,
        term: node.term,
        url: '',
        title: '',
        published: null,
        excerpt: '',
        effectGuess: 'neutral',
        foundAt,
        status: 'could_not_look',
      },
    ];
  }
  if (search.status === 'nothing') return [];

  const out: CandidateEvent[] = [];
  for (const result of search.results
    .filter((r) => !isNeverAnEvent(r.url, settings.blockedHosts))
    .slice(0, settings.pagesPerNode)) {
    const page = await readPage(result.url, { timeoutMs: 15_000, maxChars: 60_000 });
    if (!page.ok) continue;
    const excerpt = excerptAround(page.text, node.term);
    if (!excerpt) continue;
    const title = page.title || result.title;
    // Checked here, not on the search result, because the reader often returns
    // a truer title than the snippet did.
    if (looksLikeAReference(title)) continue;
    out.push({
      id: idFor(page.url),
      bottleneck: node.name,
      term: node.term,
      url: page.url,
      title,
      published: result.published ?? null,
      excerpt,
      effectGuess: guessEffect(excerpt),
      foundAt,
      status: 'candidate',
    });
  }
  return out;
}
