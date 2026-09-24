'use client';

/**
 * The search box, in two shapes from one component.
 *
 * `popover` (the header): results drop down as you type — grouped by type,
 * matched words marked — with ↑↓ to move, Enter to open, Esc to close, and
 * Enter on nothing selected (or the last row) going to the full results page.
 *
 * `page` (/search): the box drives the page itself. Typing replaces the URL
 * after a short pause, so the server-rendered results update in place and the
 * address stays shareable; ↓ moves into the results list.
 *
 * Either way "/" focuses the box from anywhere that is not a text field. Only
 * one box is mounted per page: the header hides itself on /search.
 */
import { usePathname } from 'next/navigation';

import { PageSearch } from './search/PageSearch';
import { PopoverSearch } from './search/PopoverSearch';

export function SearchBox({
  mode = 'popover',
  initialQuery = '',
  type = '',
}: {
  mode?: 'popover' | 'page';
  initialQuery?: string;
  /** Page mode: the active type filter, kept when the query changes. */
  type?: string;
}) {
  const path = usePathname();
  if (mode === 'popover' && path === '/search') return null;
  return mode === 'page' ? (
    <PageSearch initialQuery={initialQuery} type={type} />
  ) : (
    <PopoverSearch />
  );
}
