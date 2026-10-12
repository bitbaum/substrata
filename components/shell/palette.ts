/**
 * What the command palette offers before the search index answers: every
 * destination the site has, in one list, so the long tail does not need a row
 * in the sidebar to be one keystroke away.
 *
 * Pure, so `test/nav.test.ts` can hold it to "every nav path is in the
 * palette" without a browser.
 */
import { createSearch, type Hit, type SearchSpec } from '@bitbaum/searchkit';

import {
  ACCOUNT_NAV,
  FOOTER_NAV,
  HOME_LINK,
  NAV_SECTIONS,
  PALETTE_EXTRA,
  READER_VIEWS,
  type NavLink,
} from '@/config/site-nav';

export interface PaletteEntry {
  key: string;
  label: string;
  hint: string;
  href: string;
  /** Where it sits, shown beside the label: "Explore", "For you", "Account". */
  group: string;
}

function entries(group: string, links: readonly NavLink[]): PaletteEntry[] {
  return links.map((l) => ({ key: `${group}:${l.href}`, group, ...l }));
}

export function paletteEntries({
  signedIn,
  reviewer,
}: {
  signedIn: boolean;
  reviewer: boolean;
}): PaletteEntry[] {
  const account = signedIn
    ? [ACCOUNT_NAV.desk, ACCOUNT_NAV.settings, ...(reviewer ? [ACCOUNT_NAV.inbox] : [])]
    : [];
  const all = [
    ...entries('Account', account),
    ...entries('Home', [HOME_LINK]),
    ...NAV_SECTIONS.flatMap((s) => entries(s.label, s.items)),
    ...entries('For you', READER_VIEWS),
    ...entries('Data', PALETTE_EXTRA),
    ...entries('About', FOOTER_NAV),
  ];
  // One row per destination, even where two lists share a page.
  return all.filter((e, i) => all.findIndex((o) => o.href === e.href) === i);
}

/** The label first, then where it sits and the one-line hint. */
const SPEC: SearchSpec<PaletteEntry> = {
  fields: [
    { name: 'label', get: (e) => e.label },
    { name: 'hint', get: (e) => [e.group, e.hint] },
  ],
};

/**
 * The pages matching what was typed, best first, forgiving a slip ("expsoure"
 * is still Exposure), with the ranges to mark in each label.
 */
export function searchEntries(list: readonly PaletteEntry[], query: string): Hit<PaletteEntry>[] {
  return createSearch(list, SPEC).search(query);
}

export function filterEntries(list: readonly PaletteEntry[], query: string): PaletteEntry[] {
  return query.trim() ? searchEntries(list, query).map((h) => h.item) : [...list];
}
