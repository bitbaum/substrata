/**
 * URL and title filtering for candidate events.
 * Keeps SEO spam, press release wires, and standing reference pages out of the sweep queue.
 */

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
