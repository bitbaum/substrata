/**
 * What counts as a candidate event, in one place.
 *
 * Extracted from `scripts/research/sweep-events.ts` when the sweep also had to
 * run on a timer in production. A second copy of "what is an event" living in
 * an API route is how the scheduled sweep and the hand-run one would quietly
 * stop agreeing — so the script keeps the CLI, the file IO and the prune, and
 * the judgement lives here.
 */
import { createHash } from 'node:crypto';
import { webSearch, readPage } from '@bitbaum/ai-kit/web';

import { MATERIALS } from '@/config/substrata';
import { CHOKEPOINTS } from '@/config/substrata-coverage';
import type { CandidateEvent, EventEffect } from '@/config/substrata-events';

/** How many results to consider, how many to read, and how much text to keep around a match. */
const RESULTS_PER_NODE = 8;
const PAGES_PER_NODE = 4;
const EXCERPT_RADIUS = 200;

const EVENT_WORDS =
  'shortage OR expansion OR "new plant" OR "lead time" OR export OR licence OR license OR closure OR outage OR contract';

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
export function isNeverAnEvent(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return NEVER_AN_EVENT.some((bad) =>
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

export async function sweep(node: { name: string; term: string }): Promise<CandidateEvent[]> {
  const foundAt = new Date().toISOString();
  const query = `"${node.term}" (${EVENT_WORDS}) 2026`;
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
    .filter((r) => !isNeverAnEvent(r.url))
    .slice(0, PAGES_PER_NODE)) {
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
