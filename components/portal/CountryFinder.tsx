'use client';

/**
 * Every country by name — the way to Malta, Singapore or Liechtenstein on a
 * phone, and the keyboard's way to any country at all (the map itself is one
 * control, not 240 tab stops). Matches the start of any word of the name,
 * forgives a slip ("Liechtenstien", "Sinagpore"), and also takes an ISO code.
 */
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { createSearch, type SearchSpec } from '@bitbaum/searchkit';

import { Highlight } from '@/components/portal/Highlight';
import { segments } from '@/lib/search-types';

export interface CountryOption {
  iso: string;
  name: string;
}

const LIMIT = 8;

/** The name first; an ISO code ("cn", "us") is the other way in. */
export const COUNTRY_SEARCH: SearchSpec<CountryOption> = {
  fields: [
    { name: 'name', get: (c) => c.name },
    { name: 'iso', get: (c) => c.iso },
  ],
};

export function CountryFinder({
  countries,
  keep,
  label = 'Find a country',
}: {
  countries: CountryOption[];
  /** Query parameters the link keeps (resource, measure). */
  keep: Record<string, string>;
  label?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const index = useMemo(() => createSearch(countries, COUNTRY_SEARCH), [countries]);
  const matches = useMemo(() => index.search(query, { limit: LIMIT }), [index, query]);

  const href = (iso: string) => {
    const params = new URLSearchParams({ view: 'world', ...keep, country: iso });
    return `/atlas?${params.toString()}`;
  };

  return (
    <div className="country-finder">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        placeholder={label}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-controls={`${id}-list`}
      />
      <ul id={`${id}-list`} aria-live="polite">
        {matches.map(({ item: c, matches: marked }) => (
          <li key={c.iso}>
            <Link href={href(c.iso)} scroll={false} onClick={() => setQuery('')}>
              <span>
                <Highlight segments={segments(c.name, marked.name)} />
              </span>
              <span className="country-finder-iso">{c.iso.toUpperCase()}</span>
            </Link>
          </li>
        ))}
        {query.trim() && matches.length === 0 && <li className="country-finder-none">No match</li>}
      </ul>
    </div>
  );
}
