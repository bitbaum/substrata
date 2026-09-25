/**
 * Which registrants an hourly filings run fetches. Pure, so the economy is
 * tested rather than assumed.
 *
 * Fetching every registrant every hour was 51 requests an hour for a handful
 * of new filings a day. Instead a run fetches (a) every registrant that
 * appears in EDGAR's latest-filings feeds, which is how a filing reaches the
 * desk within the hour, and (b) a rotating slice, so each registrant is still
 * read in full every ROTATION_HOURS even if a feed page was missed.
 */

/** Every registrant is read in full at least this often. */
export const ROTATION_HOURS = 6;

/** Forms whose latest-filings feed is read every run. The rest arrive via the rotation. */
export const FEED_FORMS = ['8-K', '6-K'] as const;
/** Pages of 100 entries per feed form; a busy hour of 8-Ks runs past one page. */
export const FEED_PAGES = 2;

/** CIKs named in an EDGAR getcurrent Atom feed: titles read "8-K - NAME (0000895419) (Filer)". */
export function ciksInFeed(atom: string): Set<number> {
  const out = new Set<number>();
  for (const m of atom.matchAll(/<title>[^<]*\((\d{10})\)[^<]*<\/title>/g)) out.add(Number(m[1]));
  return out;
}

/** The registrants this hour must read: those in the feeds, plus this hour's slice. */
export function registrantsToFetch<T extends { cik: number }>(
  all: readonly T[],
  inFeeds: ReadonlySet<number>,
  hour: number,
): T[] {
  const slot = hour % ROTATION_HOURS;
  return all.filter((r, i) => inFeeds.has(r.cik) || i % ROTATION_HOURS === slot);
}

export function feedUrl(form: string, page: number): string {
  const params = new URLSearchParams({
    action: 'getcurrent',
    type: form,
    owner: 'include',
    start: String(page * 100),
    count: '100',
    output: 'atom',
  });
  return `https://www.sec.gov/cgi-bin/browse-edgar?${params}`;
}
