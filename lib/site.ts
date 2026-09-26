/**
 * Substrata's own identity and link helper.
 *
 * Replaces what the renderers used to import from OrangeCat (`siteHref`,
 * `siteCanonicalHost`, a `HostedSite` record). Substrata is not hosted inside
 * another application any more, so a link is just a path and the canonical host
 * is a constant.
 */
export const SITE = {
  name: 'Substrata',
  host: 'substrata.orangecat.ch',
  repo: 'https://github.com/bitbaum/substrata',
} as const;

/**
 * The correction intake: a prefilled public issue, no account on this site.
 * "Being told when a row is wrong by someone who works in that chain" is the
 * stated reason the research is free, so the route to tell us has to be one
 * click and cannot ask for anything first.
 */
export function correctionUrl(
  about: string,
  known?: { problem?: string; source?: string },
): string {
  const params = new URLSearchParams({
    title: `Correction: ${about}`,
    labels: 'correction',
    body: [
      '**Which row** (material and company, or the page and section):',
      known ? about : '',
      '**What is wrong**:',
      known?.problem ?? '',
      '**Source** (a link that shows it — the row cannot change without one):',
      known?.source ?? '',
    ].join('\n'),
  });
  return `${SITE.repo}/issues/new?${params.toString()}`;
}

/** An in-site link. Root is '/', everything else '/segment'. */
export function href(path = ''): string {
  const clean = path.replace(/^\/+|\/+$/g, '');
  return clean ? `/${clean}` : '/';
}
