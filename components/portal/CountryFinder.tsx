'use client';

/**
 * Every country by name — the way to Malta, Singapore or Liechtenstein on a
 * phone, and the keyboard's way to any country at all (the map itself is one
 * control, not 240 tab stops). Matches a name's start first, then anywhere,
 * and also takes an ISO code.
 */
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';

export interface CountryOption {
  iso: string;
  name: string;
}

const LIMIT = 8;

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
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const starts = countries.filter((c) => c.name.toLowerCase().startsWith(q) || c.iso === q);
    const within = countries.filter((c) => !starts.includes(c) && c.name.toLowerCase().includes(q));
    return [...starts, ...within].slice(0, LIMIT);
  }, [countries, query]);

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
        {matches.map((c) => (
          <li key={c.iso}>
            <Link href={href(c.iso)} scroll={false} onClick={() => setQuery('')}>
              {c.name}
              <span>{c.iso.toUpperCase()}</span>
            </Link>
          </li>
        ))}
        {query.trim() && matches.length === 0 && <li className="country-finder-none">No match</li>}
      </ul>
    </div>
  );
}
