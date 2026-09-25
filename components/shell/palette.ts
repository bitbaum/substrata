/**
 * What the command palette offers before the search index answers: every
 * destination the site has, in one list, so the long tail does not need a row
 * in the sidebar to be one keystroke away.
 *
 * Pure, so `test/nav.test.ts` can hold it to "every nav path is in the
 * palette" without a browser.
 */
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

/** Label matches first, then the one-line hint; every word must match somewhere. */
export function filterEntries(list: readonly PaletteEntry[], query: string): PaletteEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...list];
  const scored = list
    .map((e) => {
      const label = e.label.toLowerCase();
      const rest = `${e.group} ${e.hint}`.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (label.startsWith(w)) score += 3;
        else if (label.includes(w)) score += 2;
        else if (rest.includes(w)) score += 1;
        else return null;
      }
      return { e, score };
    })
    .filter((x): x is { e: PaletteEntry; score: number } => x !== null);
  return scored.sort((a, b) => b.score - a.score).map((x) => x.e);
}
