/**
 * The ways a reader can take part in a company: work there, own part of it,
 * buy from it. Derived from rows the page already carries — its hiring
 * record, its listing, its filings, its own page on its role — so a route
 * appears only where there is a fact behind it, and says so where there is
 * not.
 *
 * Every route is a fact about access, never a view on whether to use it. The
 * section that renders these leads with the not-advice line (see
 * `config/substrata-take-part.ts`).
 */
import type { Listing } from './listings';
import { terminalTicker } from './listings';

export type TakePartKind = 'work' | 'own' | 'buy';

export interface TakePartLink {
  label: string;
  href: string;
  external: boolean;
}

export interface TakePartRoute {
  kind: TakePartKind;
  /** One plain sentence: how the route works for this company, or why there is none. */
  text: string;
  links: TakePartLink[];
}

export interface TakePartInput {
  slug: string;
  name: string;
  /** What it does in the chain, from the directory. */
  role: string | null;
  listing: Listing | null;
  /** The company's own page naming its role — where its products are described. */
  ownPage: string | null;
  hiring: { careersUrl: string | null; live: boolean; total: number } | null;
  hasFilings: boolean;
}

function work({ slug, name, hiring }: TakePartInput): TakePartRoute {
  if (!hiring) {
    return {
      kind: 'work',
      text: `No careers page is recorded for ${name} yet; its own site is the place to look.`,
      links: [{ label: 'Careers across the chain', href: '/careers', external: false }],
    };
  }
  const links: TakePartLink[] = [];
  if (hiring.live)
    links.push({
      label: `${hiring.total} open roles`,
      href: `/careers?company=${slug}`,
      external: false,
    });
  if (hiring.careersUrl)
    links.push({ label: 'Official careers page', href: hiring.careersUrl, external: true });
  return {
    kind: 'work',
    text: hiring.live
      ? 'Its open roles are read daily from its public job board, and listed here.'
      : 'It publishes its roles on its own careers page.',
    links,
  };
}

function own({ name, listing, hasFilings }: TakePartInput): TakePartRoute {
  const filings: TakePartLink[] = hasFilings
    ? [{ label: 'Its SEC filings', href: '#filings', external: false }]
    : [];
  if (!listing || listing.status === 'none-found') {
    return {
      kind: 'own',
      text: `No public listing was found for ${name}${listing ? ` (checked ${listing.checkedOn})` : ''}; there may be no way for the public to own its shares.`,
      links: [],
    };
  }
  if (listing.status === 'private') {
    return {
      kind: 'own',
      text: `Its shares are not traded on a public exchange. ${listing.note}`,
      links: [],
    };
  }
  const refs = [listing.primary, listing.us].filter(
    (r, i, all): r is NonNullable<typeof r> =>
      Boolean(r) &&
      all.findIndex((o) => o?.ticker === r?.ticker && o?.exchange === r?.exchange) === i,
  );
  const quoted = refs.length ? ` as ${refs.map((r) => terminalTicker(r)).join(' and ')}` : '';
  const where =
    listing.status === 'parent'
      ? `Not listed on its own: it is part of ${listing.parent}, whose shares trade publicly${quoted}. Owning those is owning the whole group, of which this is one part.`
      : `Its shares trade publicly${quoted}, bought and sold through a broker that reaches that exchange.`;
  return {
    kind: 'own',
    text: where,
    links: [
      ...refs.map((r) => ({
        label: `${terminalTicker(r)} listing record`,
        href: r.source,
        external: true,
      })),
      ...filings,
    ],
  };
}

function buy({ role, ownPage }: TakePartInput): TakePartRoute {
  const what = role ? `What it does in the chain: ${role}. ` : '';
  return {
    kind: 'buy',
    text:
      `${what}At this depth of the chain most sales are to other businesses, under contract. ` +
      (ownPage
        ? 'Its own page describes what it offers.'
        : 'No page of its own is recorded here yet.'),
    links: ownPage ? [{ label: 'Its own page', href: ownPage, external: true }] : [],
  };
}

/** Work, own, buy — always all three, in that order, so every profile reads the same. */
export function takePartRoutes(input: TakePartInput): TakePartRoute[] {
  return [work(input), own(input), buy(input)];
}
