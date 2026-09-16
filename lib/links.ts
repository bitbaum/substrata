/**
 * Every internal URL on this site, in one place.
 *
 * Before this module there were 29 hand-built template literals across the
 * pages, in twelve shapes, and `/bottlenecks/${slugOf(name)}` alone appeared
 * nine times. Worse than the repetition was the fork it hid: some call sites
 * slugified a name, others passed an already-slugged field, and which one was
 * correct depended on where you were standing. Nothing tested any of it.
 *
 * So: one function per destination, each accepting either form, and a single
 * list of what a valid internal link can point at — which is what makes
 * `test/links.test.ts` able to assert that every link the site renders
 * resolves to something that exists.
 *
 * Created: 2026-09-15
 */

/** The shared slug rule. Anything addressable by name uses this and only this. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Accepts a display name or an already-computed slug.
 *
 * Slugifying an existing slug is a no-op, so one function serves both and the
 * caller no longer has to know which it is holding.
 */
function slugOrName(value: string): string {
  return slugify(value);
}

// ---------------------------------------------------------------------------
// Entity pages
// ---------------------------------------------------------------------------

export function bottleneckHref(nameOrSlug: string): string {
  return `/bottlenecks/${slugOrName(nameOrSlug)}`;
}

export function marketHref(nameOrSlug: string): string {
  return `/markets/${slugOrName(nameOrSlug)}`;
}

export function policyHref(jurisdiction: string): string {
  return `/policy/${jurisdiction}`;
}

export function scienceHref(id: string): string {
  return `/science/${id}`;
}

export function capitalHref(id: string): string {
  return `/capital/${id}`;
}

export function noteHref(slug: string): string {
  return `/notes/${slug}`;
}

export function learnHref(slug: string): string {
  return `/learn/${slug}`;
}

/** A definition on the Learn page. The anchor is the slugified term. */
export function glossaryHref(term: string): string {
  return `/learn#${slugify(term)}`;
}

/** A thesis claim, which calls link to so the view they test is one click away. */
export function thesisHref(claimId?: string): string {
  return claimId ? `/thesis#${claimId}` : '/thesis';
}

// ---------------------------------------------------------------------------
// Filtered lists
// ---------------------------------------------------------------------------

/**
 * A narrowed board. The key must be one of the facets the list spec declares,
 * which is why these are named functions rather than a string builder.
 */
export function bottlenecksBy(
  facet: 'stage' | 'tech' | 'industry' | 'horizon' | 'state',
  value: string,
): string {
  return `/bottlenecks?${facet}=${value}`;
}

export function marketsBy(facet: 'industry' | 'layer' | 'grade', value: string): string {
  return `/markets?${facet}=${value}`;
}

// ---------------------------------------------------------------------------
// Section roots
// ---------------------------------------------------------------------------

export const SECTIONS = {
  today: '/',
  bottlenecks: '/bottlenecks',
  markets: '/markets',
  policy: '/policy',
  science: '/science',
  capital: '/capital',
  events: '/events',
  notes: '/notes',
  learn: '/learn',
  calls: '/calls',
  research: '/research',
  thesis: '/thesis',
  about: '/about',
  join: '/join',
  api: '/api/map',
  atlas: '/atlas',
  world: '/world',
  search: '/search',
  talent: '/talent',
  chat: '/chat',
  account: '/account',
  data: '/data',
  development: '/development',
  roadmap: '/roadmap',
  changelog: '/changelog',
} as const;

/**
 * Every route the site serves, as patterns. `test/links.test.ts` checks each
 * rendered link against this plus the set of generated entity slugs, so a
 * typo in a path becomes a failing build rather than a 404 nobody clicks.
 */
export const ROUTES = [
  '/atlas',
  '/world',
  '/search',
  '/talent',
  '/chat',
  '/account',
  '/data',
  '/development',
  '/roadmap',
  '/changelog',
  '/blog',
  '/api/research/export',
  '/',
  '/bottlenecks',
  '/bottlenecks/:slug',
  '/markets',
  '/markets/:slug',
  '/policy',
  '/policy/:jurisdiction',
  '/science',
  '/science/:slug',
  '/capital',
  '/capital/:slug',
  '/events',
  '/notes',
  '/notes/:slug',
  '/learn',
  '/learn/:slug',
  '/calls',
  '/research',
  '/thesis',
  '/about',
  '/join',
  '/api/map',
  '/api/events',
  '/api/health',
] as const;

/** Strip the query and fragment, leaving the path a route has to match. */
export function pathOf(href: string): string {
  return href.split(/[?#]/)[0];
}

/** Does this href point inside the site? */
export function isInternal(href: string): boolean {
  return href.startsWith('/');
}
