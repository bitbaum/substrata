'use client';

/**
 * The /search page's box: it drives the page itself. Typing replaces the URL
 * after a short pause, so the server-rendered results update in place and the
 * address stays shareable; ↓ moves into the results list; "/" focuses it.
 *
 * The header's own search box became the command palette (⌘K, "/", or the
 * search button in the top bar — components/shell/CommandPalette.tsx), which
 * reads the same /api/search index and also jumps to any page.
 */
import { PageSearch } from './search/PageSearch';

export function SearchBox({
  initialQuery = '',
  type = '',
}: {
  initialQuery?: string;
  /** The active type filter, kept when the query changes. */
  type?: string;
}) {
  return <PageSearch initialQuery={initialQuery} type={type} />;
}
